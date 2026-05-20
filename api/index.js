import { createClient } from '@supabase/supabase-js';
import express from 'express';

const app = express();
app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. GET: Generate random identity
app.get('/api/generate-identity', async (req, res) => {
    try {
        const { data: firstNames, error: e1 } = await supabase.from('random_first_names').select('name');
        const { data: lastNames, error: e2 } = await supabase.from('random_last_names').select('name');
        
        if (e1 || e2) throw new Error('Failed to fetch random names');

        const first = firstNames[Math.floor(Math.random() * firstNames.length)].name;
        const last = lastNames[Math.floor(Math.random() * lastNames.length)].name;
        const email = `${first.toLowerCase()}.${last.toLowerCase()}@enterprise.com`;

        return res.json({ firstName: first, lastName: last, email });
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

// 3. POST: Submit Lead with Pillar Association (Step 1)
app.post('/api/submit-lead', async (req, res) => {
    try {
        const { firstName, lastName, email, pillarId } = req.body;

        if (!firstName || !lastName || !email || !pillarId) {
            return res.status(400).json({ error: 'Missing required fields or pillar selection.' });
        }

        // Maps perfectly to your ER diagram: inserts the foreign key 'pillar_id'
        const { data, error } = await supabase
            .from('leads')
            .insert([
                { 
                    first_name: firstName, 
                    last_name: lastName, 
                    email: email,
                    pillar_id: parseInt(pillarId),
                    completed_step: 1
                }
            ])
            .select();

        if (error) throw error;
        return res.status(201).json({ success: true, lead: data[0] });
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
            .select('label')
            .eq('pillar_id', parseInt(pillarId));

        if (error) throw error;

        const painPointsList = data.map(item => item.label);
        return res.json({ painPoints: painPointsList });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default app;