import { createClient } from '@supabase/supabase-js';
import express from 'express';

const app = express();
app.use(express.json());

// Initialize Supabase Client using environment variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. HEALTH CHECK: Verify database state immediately on load and return explicit diagnostics
app.get('/api/health', async (req, res) => {
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return res.status(500).json({ 
                status: 'disconnected', 
                reason: 'Missing credentials. Check Vercel environment variables configuration.' 
            });
        }
        
        // Ping a basic schema look up to check link viability
        const { error } = await supabase.from('pillars').select('id').limit(1);
        
        if (error) {
            return res.status(500).json({ 
                status: 'disconnected', 
                reason: `Supabase returned a structural error: ${error.message}. Your database project might be paused, deleted, or tables have changed.` 
            });
        }

        return res.json({ status: 'connected' });
    } catch (err) {
        return res.status(500).json({ 
            status: 'disconnected', 
            reason: `System runtime connection exception: ${err.message}` 
        });
    }
});

// 2. GET: Generate random identity (Unified Last Name, Company, and Clean Email structure)
app.get('/api/generate-identity', async (req, res) => {
    try {
        const { data: firstNames, error: e1 } = await supabase.from('random_first_names').select('name');
        const { data: lastNames, error: e2 } = await supabase.from('random_last_names').select('name');
        
        if (e1 || e2) throw new Error('Could not pull random names from generation seed tables.');

        const first = firstNames[Math.floor(Math.random() * firstNames.length)].name;
        const last = lastNames[Math.floor(Math.random() * lastNames.length)].name;

        // Unified corporate identity using the exact same last name
        const suffixes = ['Solutions', 'Tech', 'Holdings', 'Logistics', 'Networks', '& Co.'];
        const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        const companyName = `${last} ${randomSuffix}`;

        // Sanitize the company name to create a clean email domain
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

// 3. GET: Fetch pillars (Core Focus) to populate Step 1 dropdown on page load
app.get('/api/pillars', async (req, res) => {
    try {
        const { data, error } = await supabase.from('pillars').select('id, name');
        if (error) throw error;
        return res.json({ pillars: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 4. GET: Fetch industries to populate Step 1 dropdown on page load
app.get('/api/industries', async (req, res) => {
    try {
        const { data, error } = await supabase.from('industries').select('id, name');
        if (error) throw error;
        return res.json({ industries: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 5. POST: Submit Lead mapping data directly to your ordered schema layout
app.post('/api/submit-lead', async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            email, 
            companyName, 
            companySize, 
            industryId, 
            pillarId, 
            painPointIds 
        } = req.body;

        // Strict field validation rules
        if (!firstName || !lastName || !email || !companyName || !companySize || !pillarId) {
            return res.status(400).json({ error: 'Missing required profile fields.' });
        }

        // Phase A: Insert into 'leads' following your exact ordered database columns
        const { data: leadData, error: leadError } = await supabase
            .from('leads')
            .insert([
                { 
                    first_name: firstName, 
                    last_name: lastName, 
                    email: email,
                    company_name: companyName,
                    company_size: companySize,
                    industry_id: industryId ? parseInt(industryId) : null,
                    pillar_id: parseInt(pillarId),
                    completed_step: 2
                }
            ])
            .select();

        if (leadError) throw leadError;
        
        const newLead = leadData[0];

        // Phase B: Map checked items down into the relational 'lead_answers' junction table
        if (painPointIds && painPointIds.length > 0) {
            const answerRows = painPointIds.map(painId => ({
                lead_id: newLead.id,
                pain_point_id: painId
            }));

            const { error: answersError } = await supabase
                .from('lead_answers')
                .insert(answerRows);

            if (answersError) throw answersError;
        }

        return res.status(201).json({ success: true, leadId: newLead.id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 6. GET: Fetch pain points filtering directly by the selected pillar_id
app.get('/api/pain-points', async (req, res) => {
    try {
        const { pillarId } = req.query;
        if (!pillarId) return res.status(400).json({ error: 'Missing pillarId parameter.' });

        const { data, error } = await supabase
            .from('pain_points')
            .select('id, label')
            .eq('pillar_id', parseInt(pillarId));

        if (error) throw error;
        return res.json({ painPoints: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Discovery Engine server listening on port ${PORT}`);
});