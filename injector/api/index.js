import express from 'express';
import { createClient } from '@supabase/supabase-js';
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
