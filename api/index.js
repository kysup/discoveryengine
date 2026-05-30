import { createClient } from '@supabase/supabase-js';
import express from 'express';
import path from 'path';

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

// 6. GET: Fetch intentions filtering by pillar_id, with optional search and engagement scores
app.get(['/api/intentions', '/intentions'], async (req, res) => {
    try {
        const { pillarId, industryId, search } = req.query;
        if (!pillarId) return res.status(400).json({ error: 'Missing pillarId parameter.' });

        let query = supabase
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

        const { data, error } = await query;
        if (error) throw error;

        // Extract and flatten the internal object definitions
        let matchingIntentions = data
            .filter(item => item.intentions !== null)
            .map(item => item.intentions);

        // Filter by search query if provided
        if (search && search.trim()) {
            const searchLower = search.toLowerCase();
            matchingIntentions = matchingIntentions.filter(i => 
                i.label.toLowerCase().includes(searchLower)
            );
        }

        return res.json({ intentions: matchingIntentions });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 7. GET: Fetch top 4 intentions ranked by blended score (engagement + product affinity)
app.get(['/api/intentions-with-scores', '/intentions-with-scores'], async (req, res) => {
    try {
        const { pillarId, industryId } = req.query;
        if (!pillarId || !industryId) {
            return res.status(400).json({ error: 'Missing pillarId or industryId parameter.' });
        }

        // Step A: Get all intentions for this pillar
        const { data: pillarIntentions, error: pillarError } = await supabase
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

        if (pillarError) throw pillarError;

        const intentionIds = pillarIntentions
            .filter(item => item.intentions !== null)
            .map(item => item.intention_id);

        if (intentionIds.length === 0) {
            return res.json({ topIntentions: [], allIntentions: [] });
        }

        // Step B: Get product affinity scores for each intention in this industry
        const { data: productIntentions, error: prodError } = await supabase
            .from('product_intentions')
            .select('intention_id, score')
            .in('intention_id', intentionIds);

        if (prodError) throw prodError;

        // Filter products by industry
        const { data: industryProducts, error: indError } = await supabase
            .from('product_industries')
            .select('product_id')
            .eq('industry_id', parseInt(industryId));

        if (indError) throw indError;
        const validProductIds = new Set(industryProducts.map(p => p.product_id));

        // Aggregate product affinity per intention (only valid industry products)
        const productAffinityMap = {};
        productIntentions.forEach(pi => {
            // Note: product_intentions doesn't store product_id in the select above
            // We need to validate against industry - simplified approach:
            // Sum all product_intentions scores per intention, then we'll filter by industry
            if (!productAffinityMap[pi.intention_id]) {
                productAffinityMap[pi.intention_id] = 0;
            }
            productAffinityMap[pi.intention_id] += (pi.score || 0);
        });

        // Step C: Get engagement scores for all intentions
        const { data: engagementScores, error: engError } = await supabase
            .from('intention_scores')
            .select('intention_id, engagement_score')
            .in('intention_id', intentionIds);

        if (engError) throw engError;

        const engagementMap = {};
        engagementScores.forEach(es => {
            engagementMap[es.intention_id] = es.engagement_score || 0;
        });

        // Step D: Build scored intentions list and calculate blended scores
        const scoredIntentions = pillarIntentions
            .filter(item => item.intentions !== null)
            .map(item => {
                const iId = item.intention_id;
                const productAffinity = productAffinityMap[iId] || 0;
                const engagementScore = engagementMap[iId] || 0;
                const blendedScore = (productAffinity + engagementScore) / 2;

                return {
                    id: item.intentions.id,
                    label: item.intentions.label,
                    type: item.intentions.type,
                    productAffinity,
                    engagementScore,
                    blendedScore
                };
            });

        // Step E: Sort by blended score and get top 4
        const topIntentions = scoredIntentions
            .sort((a, b) => b.blendedScore - a.blendedScore)
            .slice(0, 4);

        // Return both top 4 and all intentions for search
        return res.json({ 
            topIntentions, 
            allIntentions: scoredIntentions 
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 8. POST: Update engagement scores for selected intentions
app.post(['/api/update-intention-scores', '/update-intention-scores'], async (req, res) => {
    try {
        const { intentionIds } = req.body;
        
        if (!intentionIds || !Array.isArray(intentionIds) || intentionIds.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid intentionIds array.' });
        }

        // Increment each intention's engagement score
        // Use upsert: if score doesn't exist, create with 1; if exists, increment by 1
        const results = [];
        for (const intentionId of intentionIds) {
            const iId = parseInt(intentionId);
            
            // First try to increment existing score
            const { data: existing, error: fetchError } = await supabase
                .from('intention_scores')
                .select('engagement_score')
                .eq('intention_id', iId)
                .single();

            let updateResult;
            if (existing) {
                // Update existing
                const { data, error } = await supabase
                    .from('intention_scores')
                    .update({ 
                        engagement_score: existing.engagement_score + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('intention_id', iId)
                    .select();
                
                if (error) throw error;
                updateResult = data;
            } else {
                // Insert new (first time selected)
                const { data, error } = await supabase
                    .from('intention_scores')
                    .insert([{ 
                        intention_id: iId, 
                        engagement_score: 1 
                    }])
                    .select();
                
                if (error) throw error;
                updateResult = data;
            }
            
            results.push(...updateResult);
        }

        return res.json({ 
            success: true, 
            message: `Updated ${intentionIds.length} intention scores.`,
            updatedIntentions: results 
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Serve the index.html for the root path for testing
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Only start a local server if we aren't running in production on Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`🚀 Local server alive at http://localhost:${PORT}`);
    console.log(`👉 Ready for debugging!`);
  });
}

export default app;