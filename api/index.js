import { createClient } from '@supabase/supabase-js';
import express from 'express';

const app = express();
app.use(express.json());

// Initialize Supabase Client using environment variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. GET: Generate random identity (With unified Last Name, Company, and Email structure)
app.get('/api/generate-identity', async (req, res) => {
    try {
        // Fetch raw pool data from name tables
        const { data: firstNames, error: e1 } = await supabase.from('random_first_names').select('name');
        const { data: lastNames, error: e2 } = await supabase.from('random_last_names').select('name');
        
        if (e1 || e2) throw new Error('Failed to fetch random names from database tables.');

        // Select the core names randomly
        const first = firstNames[Math.floor(Math.random() * firstNames.length)].name;
        const last = lastNames[Math.floor(Math.random() * lastNames.length)].name;

        // Use the EXACT same last name to generate the company name
        const suffixes = ['Solutions', 'Tech', 'Holdings', 'Logistics', 'Networks', '& Co.'];
        const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        const companyName = `${last} ${randomSuffix}`;

        // Sanitize the company name to create the email domain
        const sanitizedDomain = companyName
            .toLowerCase()
            .replace(/&/g, '')
            .replace(/\./g, '')
            .replace(/\s+/g, '');
        
        // Formulated precisely as: lowercase_firstname@sanitizeddomain.com
        const email = `${first.toLowerCase()}@${sanitizedDomain}.com`;

        return res.json({ 
            firstName: first, 
            lastName: last, 
            email,
            companyName 
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 2. GET: Fetch pillars to populate Step 1 dropdown on page load
app.get('/api/pillars', async (req, res) => {
    try {
        const { data, error } = await supabase.from('pillars').select('id, name');
        if (error) throw error;
        return res.json({ pillars: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 3. POST: Submit Lead mapping data directly to the new ordered schema layout
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

        // Validation rule check
        if (!firstName || !lastName || !email || !companyName || !pillarId) {
            return res.status(400).json({ error: 'Missing required profile fields.' });
        }

        // Phase A: Insert into 'leads' following your exact column-sequence pattern
        const { data: leadData, error: leadError } = await supabase
            .from('leads')
            .insert([
                { 
                    first_name: firstName, 
                    last_name: lastName, 
                    email: email,
                    company_name: companyName,
                    company_size: companySize || null,
                    industry_id: industryId ? parseInt(industryId) : null,
                    pillar_id: parseInt(pillarId),
                    completed_step: 2
                }
            ])
            .select();

        if (leadError) throw leadError;
        
        const newLead = leadData[0];

        // Phase B: Write selection items down to junction 'lead_answers' record matrix
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

// 4. GET: Fetch pain points filtering directly by the selected pillar_id
app.get('/api/pain-points', async (req, res) => {
    try {
        const { pillarId } = req.query;
        
        if (!pillarId) {
            return res.status(400).json({ error: 'Missing pillarId parameter.' });
        }

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

// Start application runtime listening services
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Discovery Engine server listening on port ${PORT}`);
});