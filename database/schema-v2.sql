-- =============================================
-- SUPPLOXI V2 — COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- WARNING: Drops all existing tables first!
-- =============================================

DROP TABLE IF EXISTS tracking_events CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS po_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS tariff_watches CASCADE;

-- =============================================
-- USER PROFILES
-- =============================================
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  company_name TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  currency TEXT DEFAULT 'USD',
  onboarding_completed BOOLEAN DEFAULT false,
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  plan TEXT DEFAULT 'trial',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SUPPLIERS
-- =============================================
CREATE TABLE suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  country TEXT DEFAULT 'China',
  city TEXT,
  category TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  lead_time_days INTEGER DEFAULT 30,
  moq INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'USD',
  website TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  score INTEGER DEFAULT 100,
  on_time_rate DECIMAL DEFAULT 100,
  defect_rate DECIMAL DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL DEFAULT 0,
  avg_lead_time_actual DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRODUCTS
-- =============================================
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category TEXT,
  description TEXT,
  image_url TEXT,
  selling_price DECIMAL DEFAULT 0,
  cost_price DECIMAL DEFAULT 0,
  shipping_cost_estimate DECIMAL DEFAULT 0,
  duties_estimate DECIMAL DEFAULT 0,
  landed_cost DECIMAL DEFAULT 0,
  margin_percent DECIMAL DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  avg_daily_sales DECIMAL DEFAULT 1,
  primary_supplier_id UUID REFERENCES suppliers(id),
  platform_shopify_id TEXT,
  platform_woo_id TEXT,
  platform_bigcommerce_id TEXT,
  weight_kg DECIMAL,
  dimensions TEXT,
  hts_code TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INVENTORY MOVEMENTS
-- =============================================
CREATE TABLE inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  quantity_before INTEGER,
  quantity_after INTEGER,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PURCHASE ORDERS
-- =============================================
CREATE TABLE purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT DEFAULT 'draft',
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  payment_terms TEXT,
  payment_status TEXT DEFAULT 'pending',
  shipping_method TEXT,
  total_value DECIMAL DEFAULT 0,
  amount_paid DECIMAL DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PO LINE ITEMS
-- =============================================
CREATE TABLE po_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_price DECIMAL NOT NULL,
  total_price DECIMAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SHIPMENTS
-- =============================================
CREATE TABLE shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  carrier TEXT DEFAULT 'auto',
  carrier_detected TEXT,
  supplier_id UUID REFERENCES suppliers(id),
  po_id UUID REFERENCES purchase_orders(id),
  status TEXT DEFAULT 'processing',
  ship_date DATE,
  estimated_arrival DATE,
  actual_arrival DATE,
  origin_country TEXT DEFAULT 'CN',
  destination_country TEXT DEFAULT 'US',
  destination_state TEXT,
  shipping_method TEXT,
  num_packages INTEGER DEFAULT 1,
  weight_kg DECIMAL,
  shipping_cost DECIMAL DEFAULT 0,
  insurance_cost DECIMAL DEFAULT 0,
  customs_duty DECIMAL DEFAULT 0,
  customs_status TEXT,
  last_event TEXT,
  last_event_location TEXT,
  last_synced_at TIMESTAMPTZ,
  days_in_transit INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TRACKING EVENTS
-- =============================================
CREATE TABLE tracking_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  event_time TIMESTAMPTZ,
  location TEXT,
  description TEXT,
  status_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USER SETTINGS
-- =============================================
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  shopify_store_url TEXT,
  shopify_access_token TEXT,
  shopify_last_sync TIMESTAMPTZ,
  woo_url TEXT,
  woo_consumer_key TEXT,
  woo_consumer_secret TEXT,
  woo_last_sync TIMESTAMPTZ,
  bigcommerce_store_hash TEXT,
  bigcommerce_access_token TEXT,
  default_shipping_method TEXT DEFAULT 'sea_freight',
  default_origin_country TEXT DEFAULT 'CN',
  default_lead_time_buffer INTEGER DEFAULT 15,
  alert_email TEXT,
  notify_low_stock BOOLEAN DEFAULT true,
  notify_shipment_updates BOOLEAN DEFAULT true,
  notify_customs_alerts BOOLEAN DEFAULT true,
  notify_po_reminders BOOLEAN DEFAULT true,
  notify_weekly_report BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  reference_id UUID,
  reference_type TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TARIFF WATCHES
-- =============================================
CREATE TABLE tariff_watches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  hts_code TEXT NOT NULL,
  product_description TEXT,
  origin_country TEXT DEFAULT 'CN',
  base_rate DECIMAL DEFAULT 0,
  section301_rate DECIMAL DEFAULT 0,
  total_rate DECIMAL DEFAULT 0,
  rate_last_updated DATE,
  alert_on_change BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_watches ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================
CREATE POLICY "own_profiles" ON user_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_suppliers" ON suppliers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_products" ON products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_movements" ON inventory_movements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_pos" ON purchase_orders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_shipments" ON shipments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_tariffs" ON tariff_watches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_po_items" ON po_items FOR ALL USING (
  po_id IN (SELECT id FROM purchase_orders WHERE user_id = auth.uid())
);
CREATE POLICY "own_tracking_events" ON tracking_events FOR ALL USING (
  shipment_id IN (SELECT id FROM shipments WHERE user_id = auth.uid())
);
