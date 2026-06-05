import { createClient } from '@supabase/supabase-js';
import express from 'express';
import path from 'path';
import Fuse from 'fuse.js';
import { Resend } from 'resend';

const app = express();
app.use(express.json());

// Initialize Supabase Client using environment variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// Test-harness helpers (shared by the DELETE routes below)
// ============================================================================
// Guard destructive routes with a shared secret (x-test-token === TEST_API_TOKEN).
function requireTestToken(req, res, next) {
    const expected = process.env.TEST_API_TOKEN;
    if (!expected || req.get('x-test-token') !== expected) {
        return res.status(403).json({ error: 'Forbidden: valid x-test-token header required.' });
    }
    next();
}

// Repoint a table's identity sequence to MAX(id) — see db/reset_id_sequence.sql.
// Non-fatal: logs and continues if the helper function isn't installed yet.
async function resetSequence(table) {
    const { error } = await supabase.rpc('reset_id_sequence', { p_table: table });
    if (error) console.warn(`reset_id_sequence(${table}) failed: ${error.message}`);
}

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

// 3. GET: Fetch pillars (Core Focus), flagged by whether any intentions are tied to
// them and sorted so empty pillars sink to the bottom of the list.
app.get(['/api/pillars', '/pillars'], async (req, res) => {
    try {
        const { data: pillars, error } = await supabase.from('pillars').select('id, name');
        if (error) throw error;

        // Which pillars have at least one intention tied to them?
        const { data: links, error: linkError } = await supabase
            .from('intention_pillars')
            .select('pillar_id');
        if (linkError) throw linkError;

        const pillarsWithIntentions = new Set(links.map(l => l.pillar_id));

        const sortedPillars = pillars
            .map(p => ({ ...p, hasIntentions: pillarsWithIntentions.has(p.id) }))
            .sort((a, b) => {
                // Pillars with intentions first, then alphabetical within each group
                if (a.hasIntentions !== b.hasIntentions) return a.hasIntentions ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

        return res.json({ pillars: sortedPillars });
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

        // Step B: Grab scores, justifications, owning intention, and parent metadata for
        // the valid products matching selected intentions
        const { data: scoringData, error: scoringError } = await supabase
            .from('product_intentions')
            .select(`
                product_id,
                intention_id,
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

        // Step C: Compute each selected intention's blended score, mirroring step 2.
        // productAffinity = sum of product_intentions.score across this industry's
        // products (scoringData is already industry- and selection-filtered).
        const selectedIntentionIds = intentionIds.map(id => parseInt(id));

        const affinityMap = {};
        scoringData.forEach(row => {
            if (!row.products) return;
            affinityMap[row.intention_id] = (affinityMap[row.intention_id] || 0) + (row.score || 0);
        });

        const { data: engagementScores, error: engError } = await supabase
            .from('intention_scores')
            .select('intention_id, engagement_score')
            .in('intention_id', selectedIntentionIds);

        if (engError) throw engError;

        const engagementMap = {};
        engagementScores.forEach(es => {
            engagementMap[es.intention_id] = es.engagement_score || 0;
        });

        const blendedMap = {};
        selectedIntentionIds.forEach(iId => {
            blendedMap[iId] = ((affinityMap[iId] || 0) + (engagementMap[iId] || 0)) / 2;
        });

        // Step D: Aggregate per-product scores, weighting each product_intentions.score
        // by its intention's blended score (product affinity x engagement signal).
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
            const weight = blendedMap[row.intention_id] || 0;
            scoreTracker[pId].total_score += (row.score || 0) * weight;
            if (row.justification) {
                scoreTracker[pId].justifications.push(row.justification);
            }
        });

        // Step E: Sort descending by blended score, take the top 3, round for display
        const topRecommendations = Object.values(scoreTracker)
            .sort((a, b) => b.total_score - a.total_score)
            .slice(0, 3)
            .map(p => ({ ...p, total_score: Math.round(p.total_score) }));

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

        // Filter by search query if provided, using fuzzy matching
        if (search && search.trim()) {
            const fuse = new Fuse(matchingIntentions, {
                keys: ['label'],
                threshold: 0.3,
                includeScore: true
            });
            matchingIntentions = fuse.search(search).map(result => result.item);
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

        // Step B: Find which products belong to the Lead's industry
        const { data: industryProducts, error: indError } = await supabase
            .from('product_industries')
            .select('product_id')
            .eq('industry_id', parseInt(industryId));

        if (indError) throw indError;
        const validProductIds = new Set(industryProducts.map(p => p.product_id));

        // Get product affinity scores per intention, keeping product_id so we can
        // restrict the sum to products that actually serve this industry.
        const { data: productIntentions, error: prodError } = await supabase
            .from('product_intentions')
            .select('intention_id, product_id, score')
            .in('intention_id', intentionIds);

        if (prodError) throw prodError;

        // Aggregate product affinity per intention, counting ONLY products in this
        // industry. An intention with no industry products never gets a key here, so
        // it is treated as industry-ineligible in step D.
        const productAffinityMap = {};
        productIntentions.forEach(pi => {
            if (!validProductIds.has(pi.product_id)) return;
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

        // Step D: Build scored intentions list and calculate blended scores.
        // Industry hard-filter: only keep intentions that have at least one product in
        // this industry (an entry in productAffinityMap). These are the only intentions
        // that can yield product suggestions in step 3, so dead-ends are excluded.
        const scoredIntentions = pillarIntentions
            .filter(item => item.intentions !== null)
            .filter(item => productAffinityMap.hasOwnProperty(item.intention_id))
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

        // Return both top 4 and all industry-eligible intentions (used for search)
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

// 9. POST: Email the recommended stack to the user via Resend
app.post(['/api/email-recommendations', '/email-recommendations'], async (req, res) => {
    try {
        const { email, firstName, companyName, recommendations } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Missing email address.' });
        }
        if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
            return res.status(400).json({ error: 'No recommendations to send.' });
        }
        if (!process.env.RESEND_API_KEY) {
            return res.status(500).json({ error: 'Email service is not configured (missing RESEND_API_KEY).' });
        }

        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

        const cardsHtml = recommendations.map((prod, i) => {
            const logo = prod.logo_url
                ? `<img src="${prod.logo_url}" alt="${prod.product_name}" style="max-height:40px; max-width:120px; object-fit:contain; margin-bottom:8px;">`
                : '';
            // Logo + name + company wrapped in one clickable, content-sized container
            const bundleInner = `
                            ${logo}
                            <div style="font-size:18px; font-weight:600; color:#1d1d1f;">${prod.product_name}</div>`;
            const bundle = prod.product_url
                ? `<a href="${prod.product_url}" target="_blank" style="display:inline-block; padding:8px 16px; border-radius:10px; background:#f5f5f7; text-decoration:none; color:inherit;">${bundleInner}</a>`
                : `<div style="display:inline-block; padding:8px 16px;">${bundleInner}</div>`;
            return `
                <tr><td style="padding:0 0 16px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d2d2d7; border-radius:12px;">
                        <tr><td style="padding:20px; text-align:center; font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
                            <div style="font-size:12px; color:#86868b; font-weight:600;">#${i + 1}</div>
                            <div style="text-align:center;">${bundle}</div>
                            <div style="display:inline-block; margin-top:8px; background:#e8e8ed; color:#1d1d1f; font-size:12px; padding:4px 10px; border-radius:12px; font-weight:600;">Score: ${prod.total_score}</div>
                        </td></tr>
                    </table>
                </td></tr>`;
        }).join('');

        const html = `
            <div style="background:#f5f5f7; padding:32px 0; font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td align="center">
                        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
                            <tr><td style="padding:0 20px 8px 20px; text-align:center;">
                                <h1 style="font-size:22px; color:#1d1d1f; margin:0 0 4px 0;">Your Recommended Stack</h1>
                                <p style="font-size:14px; color:#86868b; margin:0 0 20px 0;">
                                    ${firstName ? `Hi ${firstName}, here` : 'Here'} are your top matches${companyName ? ` for ${companyName}` : ''}.
                                </p>
                            </td></tr>
                            <tr><td style="padding:0 20px;">
                                <table width="100%" cellpadding="0" cellspacing="0">${cardsHtml}</table>
                            </td></tr>
                        </table>
                    </td></tr>
                </table>
            </div>`;

        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
            from: `Discovery Engine <${fromEmail}>`,
            to: [email],
            subject: 'Your Recommended Software Stack',
            html
        });

        if (error) throw new Error(error.message || 'Resend failed to send the email.');

        return res.json({ success: true, id: data?.id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// GET one / DELETE — leads (identity id; cascades lead_answers; sequence reset)
// ============================================================================
app.get(['/api/leads/:id', '/leads/:id'], async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Lead not found' });
        return res.json({ lead: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete(['/api/leads/:id', '/leads/:id'], requireTestToken, async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        // Remove dependent lead_answers first (FK), then the lead itself.
        const { error: answersError } = await supabase
            .from('lead_answers')
            .delete()
            .eq('lead_id', leadId);
        if (answersError) throw answersError;

        const { data, error } = await supabase
            .from('leads')
            .delete()
            .eq('id', leadId)
            .select();
        if (error) throw error;

        await resetSequence('leads');
        await resetSequence('lead_answers');

        return res.json({ success: true, deleted: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// GET one / DELETE — intention_scores (keyed by intention_id; no sequence)
// ============================================================================
app.get(['/api/intention-scores/:intentionId', '/intention-scores/:intentionId'], async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('intention_scores')
            .select('*')
            .eq('intention_id', req.params.intentionId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Intention score not found' });
        return res.json({ intentionScore: data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete(['/api/intention-scores/:intentionId', '/intention-scores/:intentionId'], requireTestToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('intention_scores')
            .delete()
            .eq('intention_id', req.params.intentionId)
            .select();
        if (error) throw error;
        return res.json({ success: true, deleted: data });
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