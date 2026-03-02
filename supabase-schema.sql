-- =============================================
-- SUPPLOXI v2 — Complete Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USER PROFILES
-- =============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. USER SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  currency TEXT DEFAULT 'USD',
  notification_settings JSONB DEFAULT '{}',
  customs_buffer_days INTEGER DEFAULT 15,
  safety_stock_days INTEGER DEFAULT 7,
  default_origin TEXT DEFAULT 'CN',
  low_margin_threshold INTEGER DEFAULT 20,
  ai_reorder_enabled BOOLEAN DEFAULT TRUE,
  include_customs_buffer BOOLEAN DEFAULT TRUE,
  shopify_store_url TEXT,
  shopify_access_token TEXT,
  woo_store_url TEXT,
  woo_consumer_key TEXT,
  woo_consumer_secret TEXT,
  bigcommerce_store_hash TEXT,
  bigcommerce_access_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. SUPPLIERS
-- =============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
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
  on_time_rate NUMERIC DEFAULT 100,
  defect_rate NUMERIC DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  avg_lead_time_actual INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. PRODUCTS
-- =============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  hts_code TEXT,
  category TEXT,
  selling_price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  shipping_cost_estimate NUMERIC DEFAULT 0,
  duties_estimate NUMERIC DEFAULT 0,
  landed_cost NUMERIC DEFAULT 0,
  margin_percent NUMERIC DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  avg_daily_sales NUMERIC DEFAULT 1,
  weight_kg NUMERIC,
  primary_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. PURCHASE ORDERS
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  po_number TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_date DATE,
  expected_delivery DATE,
  payment_terms TEXT,
  shipping_method TEXT,
  notes TEXT,
  status TEXT DEFAULT 'draft',
  total_value NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. PO ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS po_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  quantity_received INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. SHIPMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tracking_number TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  carrier TEXT,
  carrier_detected TEXT,
  shipping_method TEXT,
  ship_date DATE,
  estimated_arrival DATE,
  actual_arrival DATE,
  num_packages INTEGER DEFAULT 1,
  weight_kg NUMERIC,
  shipping_cost NUMERIC DEFAULT 0,
  insurance_cost NUMERIC DEFAULT 0,
  customs_duty NUMERIC DEFAULT 0,
  customs_status TEXT,
  origin_country TEXT DEFAULT 'CN',
  destination_country TEXT DEFAULT 'US',
  destination_state TEXT,
  status TEXT DEFAULT 'processing',
  days_in_transit INTEGER DEFAULT 0,
  last_event TEXT,
  last_event_location TEXT,
  last_synced_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. TRACKING EVENTS
-- =============================================
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE NOT NULL,
  event_time TIMESTAMPTZ,
  location TEXT,
  description TEXT,
  status_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. INVENTORY MOVEMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT,
  title TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. TARIFF WATCHES
-- =============================================
CREATE TABLE IF NOT EXISTS tariff_watches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hts_code TEXT NOT NULL,
  description TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  base_rate NUMERIC DEFAULT 0,
  section301_rate NUMERIC DEFAULT 0,
  annual_import_value NUMERIC DEFAULT 0,
  alert_on_change BOOLEAN DEFAULT TRUE,
  rate_changed BOOLEAN DEFAULT FALSE,
  rate_direction TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================
-- Enable RLS on all tables

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_watches ENABLE ROW LEVEL SECURITY;

-- ---- USER PROFILES ----
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ---- USER SETTINGS ----
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ---- SUPPLIERS ----
CREATE POLICY "Users can view own suppliers"
  ON suppliers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers"
  ON suppliers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suppliers"
  ON suppliers FOR DELETE
  USING (auth.uid() = user_id);

-- ---- PRODUCTS ----
CREATE POLICY "Users can view own products"
  ON products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
  ON products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
  ON products FOR DELETE
  USING (auth.uid() = user_id);

-- ---- PURCHASE ORDERS ----
CREATE POLICY "Users can view own POs"
  ON purchase_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own POs"
  ON purchase_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own POs"
  ON purchase_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own POs"
  ON purchase_orders FOR DELETE
  USING (auth.uid() = user_id);

-- ---- PO ITEMS ----
-- PO Items access via the parent PO's user_id
CREATE POLICY "Users can view own PO items"
  ON po_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE purchase_orders.id = po_items.po_id
    AND purchase_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own PO items"
  ON po_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE purchase_orders.id = po_items.po_id
    AND purchase_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own PO items"
  ON po_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE purchase_orders.id = po_items.po_id
    AND purchase_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own PO items"
  ON po_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE purchase_orders.id = po_items.po_id
    AND purchase_orders.user_id = auth.uid()
  ));

-- ---- SHIPMENTS ----
CREATE POLICY "Users can view own shipments"
  ON shipments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shipments"
  ON shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shipments"
  ON shipments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shipments"
  ON shipments FOR DELETE
  USING (auth.uid() = user_id);

-- ---- TRACKING EVENTS ----
-- Access via the parent shipment's user_id
CREATE POLICY "Users can view own tracking events"
  ON tracking_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM shipments
    WHERE shipments.id = tracking_events.shipment_id
    AND shipments.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own tracking events"
  ON tracking_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM shipments
    WHERE shipments.id = tracking_events.shipment_id
    AND shipments.user_id = auth.uid()
  ));

-- ---- INVENTORY MOVEMENTS ----
CREATE POLICY "Users can view own movements"
  ON inventory_movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movements"
  ON inventory_movements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---- NOTIFICATIONS ----
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ---- TARIFF WATCHES ----
CREATE POLICY "Users can view own tariff watches"
  ON tariff_watches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tariff watches"
  ON tariff_watches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tariff watches"
  ON tariff_watches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tariff watches"
  ON tariff_watches FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(primary_supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_po_id ON shipments(po_id);
CREATE INDEX IF NOT EXISTS idx_shipments_supplier_id ON shipments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment_id ON tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_user_id ON inventory_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_tariff_watches_user_id ON tariff_watches(user_id);
