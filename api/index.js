import { createClient } from '@supabase/supabase-js';
import express from 'express';

const app = express();
app.use(express.json());

// Initialize Supabase Client using environment variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. HEALTH CHECK: Handles both Vercel serverless formats
app.get(['/api/health', '/health'], async (req, res) => {
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return res.status(500).json({ 
                status: 'disconnected', 
                reason: 'Missing credentials. Check Vercel environment variables configuration.' 
            });
        }
        const { error } = await supabase.from('pillars').select('id').limit(1);
        if (error) {
            return res.status(500).json({ 
                status: 'disconnected', 
                reason: `Supabase structural error: ${error.message}` 
            });
        }
        return res.json({ status: 'connected' });
    } catch (err) {
        return res.status(500).json({ status: 'disconnected', reason: err.message });
    }
});

// 2. GET: Generate identity
app.get(['/api/generate-identity', '/generate-identity'], async (req, res) => {
    try {
        const { data: firstNames, error: e1 } = await supabase.from('random_first_names').select('name');
        const { data: lastNames, error: e2 } = await supabase.from('random_last_names').select('name');
        
        if (e1 || e2) throw new Error('Could not pull random names from generation seed tables.');

        const first = firstNames[Math.floor(Math.random() * firstNames.length)].name;
        const last = lastNames[Math.floor(Math.random() * lastNames.length)].name;

        const suffixes = ['Solutions', 'Tech', 'Holdings', 'Logistics', 'Networks', '& Co.'];
        const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        const companyName = `${last} ${randomSuffix}`;

        const sanitizedDomain = companyName
            .toLowerCase()
            .replace(/&/g, '')
            .replace(/\./g, '')
            .replace(/\s+/g, '');
        
        const email = `${first.toLowerCase()}@${sanitizedDomain}.com`;

        return res.json({ firstName: first, lastName: last, email, companyName });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 3. GET: Fetch pillars (Core Focus)
app.get(['/api/pillars', '/pillars'], async (req, res) => {
    try {
        const { data, error } = await supabase.from('pillars').select('id, name');
        if (error) throw error;
        return res.json({ pillars: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. GET: Fetch industries
app.get(['/api/industries', '/industries'], async (req, res) => {
    try {
        const { data, error } = await supabase.from('industries').select('id, name');
        if (error) throw error;
        return res.json({ industries: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 5. POST: Submit Lead data & Return Top 3 Ranked Recommendations
app.post(['/api/submit-lead', '/submit-lead'], async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            email, 
            companyName, 
            companySize, 
            industryId, 
            pillarId, 
            intentionIds 
        } = req.body;

        if (!firstName || !lastName || !email || !companyName || !companySize || !pillarId || !industryId) {
            return res.status(400).json({ error: 'Missing required profile fields, including Industry.' });
        }

        // Insert new lead into the database
        const { data: leadData, error: leadError } = await supabase
            .from('leads')
            .insert([
                { 
                    first_name: firstName, 
                    last_name: lastName, 
                    email: email,
                    company_name: companyName,
                    company_size: companySize,
                    industry_id: parseInt(industryId),
                    pillar_id: parseInt(pillarId),
                    completed_step: 2
                }
            ])
            .select();

        if (leadError) throw leadError;
        const newLead = leadData[0];

        // Save selected intentions to lead_answers table
        if (intentionIds && intentionIds.length > 0) {
            const answerRows = intentionIds.map(intentId => ({
                lead_id: newLead.id,
                intention_id: parseInt(intentId)
            }));

            const { error: answersError } = await supabase
                .from('lead_answers')
                .insert(answerRows);

            if (answersError) throw answersError;
        }

        // RECOMMENDATION ENGINE LOGIC:
        // Step A: Find all products permitted by the Lead's selected industry
        const { data: industryProducts, error: indError } = await supabase
            .from('product_industries')
            .select('product_id')
            .eq('industry_id', parseInt(industryId));

        if (indError) throw indError;
        const targetProductIds = industryProducts.map(p => p.product_id);

        if (targetProductIds.length === 0 || !intentionIds || intentionIds.length === 0) {
            return res.status(201).json({ success: true, leadId: newLead.id, recommendations: [] });
        }

        // Step B: Grab scores, justifications, and parent metadata for the valid products matching selected intentions
        const { data: scoringData, error: scoringError } = await supabase
            .from('product_intentions')
            .select(`
                product_id,
                score,
                justification,
                products (
                    id,
                    company_name,
                    product_name,
                    product_url,
                    logo_url
                )
            `)
            .in('intention_id', intentionIds.map(id => parseInt(id)))
            .in('product_id', targetProductIds);

        if (scoringError) throw scoringError;

        // Step C: Aggregate and compute cumulative scores per product in JavaScript
        const scoreTracker = {};
        scoringData.forEach(row => {
            if (!row.products) return;
            const pId = row.product_id;
            
            if (!scoreTracker[pId]) {
                scoreTracker[pId] = {
                    product_id: pId,
                    product_name: row.products.product_name,
                    company_name: row.products.company_name,
                    product_url: row.products.product_url,
                    logo_url: row.products.logo_url,
                    total_score: 0,
                    justifications: []
                };
            }
            scoreTracker[pId].total_score += (row.score || 0);
            if (row.justification) {
                scoreTracker[pId].justifications.push(row.justification);
            }
        });

        // Step D: Sort down descending by score and slice off the top 3
        const topRecommendations = Object.values(scoreTracker)
            .sort((a, b) => b.total_score - a.total_score)
            .slice(0, 3);

        return res.status(201).json({ 
            success: true, 
            leadId: newLead.id, 
            recommendations: topRecommendations 
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 6. GET: Fetch intentions filtering directly by the selected pillar_id via the junction table
app.get(['/api/intentions', '/intentions'], async (req, res) => {
    try {
        const { pillarId } = req.query;
        if (!pillarId) return res.status(400).json({ error: 'Missing pillarId parameter.' });

        const { data, error } = await supabase
            .from('intention_pillars')
            .select(`
                intention_id,
                intentions (
                    id,
                    label,
                    type
                )
            `)
            .eq('pillar_id', parseInt(pillarId));

        if (error) throw error;

        // Extract and flatten the internal object definitions mapped out by relational query
        const matchingIntentions = data
            .filter(item => item.intentions !== null)
            .map(item => item.intentions);

        return res.json({ intentions: matchingIntentions });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default app;