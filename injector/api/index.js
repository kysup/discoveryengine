import { createClient } from '@supabase/supabase-js';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(express.json());
app.use(express.static('public'));

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

// ============================================================================
// STEP 1: Add a record to products table
// Required fields: company_name, product_name
// ============================================================================
app.post('/api/products', async (req, res) => {
  try {
    const { company_name, product_name } = req.body;

    if (!company_name || !product_name) {
      return res.status(400).json({
        error: 'Missing required fields: company_name and product_name'
      });
    }

    const { data, error } = await supabase
      .from('products')
      .insert([{ company_name, product_name }])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STEP 2: Fetch industries
// Returned fields: industries.id, industries.name
// ============================================================================
app.get('/api/industries', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('industries')
      .select('id, name');

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STEP 3: Add a record to product_industries table
// Required fields: industry_id, product_id
// ============================================================================
app.post('/api/product-industries', async (req, res) => {
  try {
    const { industry_id, product_id } = req.body;

    if (!industry_id || !product_id) {
      return res.status(400).json({
        error: 'Missing required fields: industry_id and product_id'
      });
    }

    const { data, error } = await supabase
      .from('product_industries')
      .insert([{ industry_id, product_id }])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STEP 4: Add a record to intentions table
// Required fields: label, type
// ============================================================================
app.post('/api/intentions', async (req, res) => {
  try {
    const { label, type } = req.body;

    if (!label || !type) {
      return res.status(400).json({
        error: 'Missing required fields: label and type (pain_point or initiative)'
      });
    }

    if (!['pain_point', 'initiative'].includes(type)) {
      return res.status(400).json({
        error: 'Type must be either "pain_point" or "initiative"'
      });
    }

    const { data, error } = await supabase
      .from('intentions')
      .insert([{ label, type }])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STEP 5: Fetch pillars
// Returned fields: pillars.id, pillars.name
// ============================================================================
app.get('/api/pillars', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pillars')
      .select('id, name');

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STEP 6: Add a record to intention_pillars table
// Required fields: pillar_id, intention_id
// ============================================================================
app.post('/api/intention-pillars', async (req, res) => {
  try {
    const { pillar_id, intention_id } = req.body;

    if (!pillar_id || !intention_id) {
      return res.status(400).json({
        error: 'Missing required fields: pillar_id and intention_id'
      });
    }

    const { data, error } = await supabase
      .from('intention_pillars')
      .insert([{ pillar_id, intention_id }])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STEP 7: Fetch products
// Returned fields: products.id, products.company_name, products.product_name
// ============================================================================
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, company_name, product_name');

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STEP 8: Fetch intentions
// Returned fields: intentions.id, intentions.label
// ============================================================================
app.get('/api/intentions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('intentions')
      .select('id, label');

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STEP 9: Add a record to product_intentions table
// Required fields: product_id, intention_id, score
// ============================================================================
app.post('/api/product-intentions', async (req, res) => {
  try {
    const { product_id, intention_id, score } = req.body;

    if (!product_id || !intention_id || score === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: product_id, intention_id, and score'
      });
    }

    const { data, error } = await supabase
      .from('product_intentions')
      .insert([{ product_id, intention_id, score }])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET one / DELETE — products (identity id -> sequence reset)
// ============================================================================
app.get('/api/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, company_name, product_name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Product not found' });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', requireTestToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    await resetSequence('products');
    res.status(200).json({ success: true, deleted: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET one / DELETE — intentions (identity id -> sequence reset)
// ============================================================================
app.get('/api/intentions/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('intentions')
      .select('id, label, type')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Intention not found' });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/intentions/:id', requireTestToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('intentions')
      .delete()
      .eq('id', req.params.id)
      .select();
    if (error) throw error;
    await resetSequence('intentions');
    res.status(200).json({ success: true, deleted: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET (filterable) / DELETE — product_industries (composite key, no sequence)
// ============================================================================
app.get('/api/product-industries', async (req, res) => {
  try {
    let query = supabase.from('product_industries').select('product_id, industry_id');
    if (req.query.product_id) query = query.eq('product_id', req.query.product_id);
    if (req.query.industry_id) query = query.eq('industry_id', req.query.industry_id);
    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/product-industries', requireTestToken, async (req, res) => {
  try {
    const product_id = req.body.product_id ?? req.query.product_id;
    const industry_id = req.body.industry_id ?? req.query.industry_id;
    if (!product_id || !industry_id) {
      return res.status(400).json({ error: 'Missing required keys: product_id and industry_id' });
    }
    const { data, error } = await supabase
      .from('product_industries')
      .delete()
      .eq('product_id', product_id)
      .eq('industry_id', industry_id)
      .select();
    if (error) throw error;
    res.status(200).json({ success: true, deleted: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET (filterable) / DELETE — intention_pillars (composite key, no sequence)
// ============================================================================
app.get('/api/intention-pillars', async (req, res) => {
  try {
    let query = supabase.from('intention_pillars').select('intention_id, pillar_id');
    if (req.query.intention_id) query = query.eq('intention_id', req.query.intention_id);
    if (req.query.pillar_id) query = query.eq('pillar_id', req.query.pillar_id);
    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/intention-pillars', requireTestToken, async (req, res) => {
  try {
    const intention_id = req.body.intention_id ?? req.query.intention_id;
    const pillar_id = req.body.pillar_id ?? req.query.pillar_id;
    if (!intention_id || !pillar_id) {
      return res.status(400).json({ error: 'Missing required keys: intention_id and pillar_id' });
    }
    const { data, error } = await supabase
      .from('intention_pillars')
      .delete()
      .eq('intention_id', intention_id)
      .eq('pillar_id', pillar_id)
      .select();
    if (error) throw error;
    res.status(200).json({ success: true, deleted: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET (filterable) / DELETE — product_intentions (composite key, no sequence)
// ============================================================================
app.get('/api/product-intentions', async (req, res) => {
  try {
    let query = supabase
      .from('product_intentions')
      .select('product_id, intention_id, score, justification');
    if (req.query.product_id) query = query.eq('product_id', req.query.product_id);
    if (req.query.intention_id) query = query.eq('intention_id', req.query.intention_id);
    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/product-intentions', requireTestToken, async (req, res) => {
  try {
    const product_id = req.body.product_id ?? req.query.product_id;
    const intention_id = req.body.intention_id ?? req.query.intention_id;
    if (!product_id || !intention_id) {
      return res.status(400).json({ error: 'Missing required keys: product_id and intention_id' });
    }
    const { data, error } = await supabase
      .from('product_intentions')
      .delete()
      .eq('product_id', product_id)
      .eq('intention_id', intention_id)
      .select();
    if (error) throw error;
    res.status(200).json({ success: true, deleted: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  // Give the injector its own distinct local port (like 8081 or 3001)
  const PORT = process.env.PORT || 8081; 
  app.listen(PORT, () => {
    console.log(`🚀 Injector Local server alive at http://localhost:${PORT}`);
  });
}

export default app;