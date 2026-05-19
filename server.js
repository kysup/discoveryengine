import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Initialize Supabase Client using your environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Endpoint to generate random identity + corporate email
app.get('/api/generate-identity', async (req, res) => {
    try {
        // 1. Fetch name asset pools from Supabase
        const { data: firstNames, error: firstErr } = await supabase.from('random_first_names').select('name');
        const { data: lastNames, error: lastErr } = await supabase.from('random_last_names').select('name');

        if (firstErr || lastErr) {
            throw new Error(`Database error: ${firstErr?.message || lastErr?.message}`);
        }

        // Fallbacks in case the tables are completely empty
        const firstName = firstNames.length > 0 
            ? firstNames[Math.floor(Math.random() * firstNames.length)].name 
            : 'Alex';
        const lastName = lastNames.length > 0 
            ? lastNames[Math.floor(Math.random() * lastNames.length)].name 
            : 'Smith';

        // 2. Select a random corporate domain
        const corporateDomains = ['enterprise.io', 'techcorp.com', 'saasops.co', 'globalops.net'];
        const randomDomain = corporateDomains[Math.floor(Math.random() * corporateDomains.length)];

        // 3. Assemble the dynamic enterprise email
        const generatedEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomDomain}`;

        // 4. Send the identity back to the frontend form state
        res.json({
            firstName,
            lastName,
            email: generatedEmail
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Discovery Engine API running on port ${PORT}`);
});