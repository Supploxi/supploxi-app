-- =============================================
-- SUPPLOXI DATABASE SCHEMA
-- Safe to run multiple times (IF NOT EXISTS)
-- Run this in Supabase SQL Editor
-- =============================================

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT DEFAULT 'China',
  city TEXT,
  category TEXT,
  payment_terms TEXT,
  lead_time_days INTEGER DEFAULT 30,
  moq INTEGER,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  status TEXT DEFAULT 'active',
  score INTEGER DEFAULT 100,
  on_time_rate DECIMAL DEFAULT 100,
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  description TEXT,
  selling_price DECIMAL,
  cost_price DECIMAL,
  shipping_cost_estimate DECIMAL DEFAULT 0,
  duties_estimate DECIMAL DEFAULT 0,
  landed_cost DECIMAL,
  margin_percent DECIMAL,
  stock_quantity INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  avg_daily_sales DECIMAL DEFAULT 1,
  primary_supplier_id UUID REFERENCES suppliers(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT DEFAULT 'draft',
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  payment_terms TEXT,
  shipping_method TEXT,
  total_value DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS po_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL NOT NULL,
  total_price DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  carrier TEXT,
  supplier_id UUID REFERENCES suppliers(id),
  po_id UUID REFERENCES purchase_orders(id),
  status TEXT DEFAULT 'processing',
  ship_date DATE,
  estimated_arrival DATE,
  actual_arrival DATE,
  shipping_method TEXT,
  origin_country TEXT DEFAULT 'CN',
  destination_country TEXT DEFAULT 'US',
  num_packages INTEGER DEFAULT 1,
  weight_kg DECIMAL,
  shipping_cost DECIMAL DEFAULT 0,
  insurance_cost DECIMAL DEFAULT 0,
  customs_duty DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracking Events
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  event_date TIMESTAMPTZ,
  location TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Settings
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  currency TEXT DEFAULT 'USD',
  fiscal_year_start TEXT DEFAULT 'January',
  default_shipping_method TEXT DEFAULT 'Sea Freight',
  shopify_store_url TEXT,
  shopify_api_key TEXT,
  woo_url TEXT,
  woo_consumer_key TEXT,
  woo_consumer_secret TEXT,
  track17_api_key TEXT,
  alert_email TEXT,
  notify_low_stock BOOLEAN DEFAULT true,
  notify_shipment_updates BOOLEAN DEFAULT true,
  notify_po_confirmation BOOLEAN DEFAULT true,
  notify_customs_delays BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to avoid duplicates)
DROP POLICY IF EXISTS "Users see own suppliers" ON suppliers;
CREATE POLICY "Users see own suppliers" ON suppliers FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own products" ON products;
CREATE POLICY "Users see own products" ON products FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own POs" ON purchase_orders;
CREATE POLICY "Users see own POs" ON purchase_orders FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own shipments" ON shipments;
CREATE POLICY "Users see own shipments" ON shipments FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own settings" ON user_settings;
CREATE POLICY "Users see own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own tracking" ON tracking_events;
CREATE POLICY "Users see own tracking" ON tracking_events FOR ALL
  USING (shipment_id IN (SELECT id FROM shipments WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users see own PO items" ON po_items;
CREATE POLICY "Users see own PO items" ON po_items FOR ALL
  USING (po_id IN (SELECT id FROM purchase_orders WHERE user_id = auth.uid()));

-- =============================================
-- 17TRACK INTEGRATION COLUMNS
-- =============================================

-- Add 17Track tracking columns to shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS track17_registered BOOLEAN DEFAULT false;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS last_tracking_update TIMESTAMPTZ;

-- Add source column to tracking_events (manual vs 17track)
ALTER TABLE tracking_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
