-- Supploxi — Complete Supabase Schema
-- Supply chain management for US e-commerce sellers

-- ─── Enable extensions ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ──────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'operator', 'viewer')),
  permissions JSONB DEFAULT '["dashboard","orders","purchase_orders","suppliers","products","inventory","shipments","financials","settings","subscription"]',
  avatar_url TEXT DEFAULT '',
  subscription_plan TEXT DEFAULT 'trial' CHECK (subscription_plan IN ('trial', 'starter', 'growth', 'scale')),
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  subscription_end_date TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Suppliers ─────────────────────────────────────────────────
CREATE TABLE suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  country TEXT DEFAULT 'CN',
  city TEXT DEFAULT '',
  address TEXT DEFAULT '',
  website TEXT DEFAULT '',
  payment_terms TEXT DEFAULT 'Net 30',
  lead_time_days INTEGER DEFAULT 14,
  currency TEXT DEFAULT 'USD',
  notes TEXT DEFAULT '',
  categories JSONB DEFAULT '[]',
  price_tables JSONB DEFAULT '[]',
  extra_costs JSONB DEFAULT '{}',
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Products ──────────────────────────────────────────────────
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT DEFAULT '',
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  unit_cost NUMERIC(12,2) DEFAULT 0,
  price_usd NUMERIC(12,2) DEFAULT 0,
  weight_kg NUMERIC(8,3) DEFAULT 0,
  hs_code TEXT DEFAULT '',
  country_of_origin TEXT DEFAULT 'CN',
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  variants JSONB DEFAULT '[]',
  min_order_qty INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Customers ─────────────────────────────────────────────────
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  zip TEXT DEFAULT '',
  country TEXT DEFAULT 'US',
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  first_order_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Orders ────────────────────────────────────────────────────
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT DEFAULT 'shopify',
  platform_order_id TEXT,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'Paid',
  financial_status TEXT DEFAULT 'Paid',
  fulfillment_status TEXT DEFAULT 'Unfulfilled',
  customer_name TEXT DEFAULT '',
  customer_email TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  customer_address TEXT DEFAULT '',
  customer_city TEXT DEFAULT '',
  customer_state TEXT DEFAULT '',
  customer_zip TEXT DEFAULT '',
  customer_country TEXT DEFAULT 'US',
  subtotal NUMERIC(12,2) DEFAULT 0,
  shipping NUMERIC(12,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  payment_method TEXT DEFAULT '',
  gateway_fee NUMERIC(12,2) DEFAULT 0,
  product_cost NUMERIC(12,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  customs_duty NUMERIC(12,2) DEFAULT 0,
  adjustments NUMERIC(12,2) DEFAULT 0,
  profit NUMERIC(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Order Items ───────────────────────────────────────────────
CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  customization JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Purchase Orders ───────────────────────────────────────────
CREATE TABLE purchase_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  po_number TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL NOT NULL,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Confirmed', 'In Production', 'Shipped', 'Delivered', 'Cancelled')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  duties_estimate NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  payment_terms TEXT DEFAULT 'Net 30',
  expected_delivery DATE,
  actual_delivery DATE,
  notes TEXT DEFAULT '',
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Purchase Order Items ──────────────────────────────────────
CREATE TABLE purchase_order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  received_qty INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Shipments (Tracking) ─────────────────────────────────────
CREATE TABLE shipments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT DEFAULT '',
  status TEXT DEFAULT 'Pending',
  last_event TEXT DEFAULT '',
  last_update TIMESTAMPTZ,
  origin_country TEXT DEFAULT 'CN',
  destination_country TEXT DEFAULT 'US',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  estimated_delivery DATE,
  registered_17track BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Inventory Movements ──────────────────────────────────────
CREATE TABLE inventory_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase_in', 'sale_out', 'adjustment', 'return_in', 'damage_out', 'transfer')),
  quantity INTEGER NOT NULL,
  reference_type TEXT DEFAULT '',
  reference_id UUID,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Expenses ──────────────────────────────────────────────────
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  recurring BOOLEAN DEFAULT FALSE,
  recurring_period TEXT CHECK (recurring_period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Invitations ───────────────────────────────────────────────
CREATE TABLE invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'operator' CHECK (role IN ('operator', 'viewer')),
  permissions JSONB DEFAULT '["dashboard","orders"]',
  token TEXT NOT NULL UNIQUE,
  accepted BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tags ──────────────────────────────────────────────────────
CREATE TABLE tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#00d4aa',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ─── Tariff Watches ────────────────────────────────────────────
CREATE TABLE tariff_watches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hs_code TEXT NOT NULL,
  description TEXT DEFAULT '',
  country_of_origin TEXT DEFAULT 'CN',
  current_rate NUMERIC(6,2) DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  alert_threshold NUMERIC(6,2) DEFAULT 5,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Webhook Configs ───────────────────────────────────────────
CREATE TABLE webhook_configs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events JSONB DEFAULT '["order.created"]',
  secret TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Activity Log ──────────────────────────────────────────────
CREATE TABLE activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Settings (KV store) ──────────────────────────────────────
CREATE TABLE settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  value JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);

CREATE INDEX idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX idx_suppliers_active ON suppliers(user_id, active);

CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_sku ON products(user_id, sku);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_shopify ON products(shopify_product_id);

CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_email ON customers(user_id, email);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_platform ON orders(user_id, platform_order_id);
CREATE INDEX idx_orders_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(user_id, status);
CREATE INDEX idx_orders_supplier ON orders(supplier_id);
CREATE INDEX idx_orders_number ON orders(user_id, order_number);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE INDEX idx_purchase_orders_user ON purchase_orders(user_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(user_id, status);
CREATE INDEX idx_purchase_orders_number ON purchase_orders(user_id, po_number);

CREATE INDEX idx_po_items_po ON purchase_order_items(purchase_order_id);

CREATE INDEX idx_shipments_user ON shipments(user_id);
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_po ON shipments(purchase_order_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_status ON shipments(user_id, status);

CREATE INDEX idx_inventory_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_user ON inventory_movements(user_id);
CREATE INDEX idx_inventory_created ON inventory_movements(created_at DESC);

CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(user_id, date DESC);
CREATE INDEX idx_expenses_category ON expenses(user_id, category);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);

CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

CREATE INDEX idx_settings_user_key ON settings(user_id, key);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Suppliers: user_id scoped
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (auth.uid() = user_id);

-- Products: user_id scoped
CREATE POLICY "products_select" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_update" ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "products_delete" ON products FOR DELETE USING (auth.uid() = user_id);

-- Customers: user_id scoped
CREATE POLICY "customers_select" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "customers_delete" ON customers FOR DELETE USING (auth.uid() = user_id);

-- Orders: user_id scoped
CREATE POLICY "orders_select" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (auth.uid() = user_id);

-- Order Items: via order
CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "order_items_update" ON order_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "order_items_delete" ON order_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

-- Purchase Orders: user_id scoped
CREATE POLICY "po_select" ON purchase_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "po_delete" ON purchase_orders FOR DELETE USING (auth.uid() = user_id);

-- PO Items: via purchase_order
CREATE POLICY "po_items_select" ON purchase_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.purchase_order_id AND purchase_orders.user_id = auth.uid())
);
CREATE POLICY "po_items_insert" ON purchase_order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.purchase_order_id AND purchase_orders.user_id = auth.uid())
);
CREATE POLICY "po_items_update" ON purchase_order_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.purchase_order_id AND purchase_orders.user_id = auth.uid())
);
CREATE POLICY "po_items_delete" ON purchase_order_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.purchase_order_id AND purchase_orders.user_id = auth.uid())
);

-- Shipments: user_id scoped
CREATE POLICY "shipments_select" ON shipments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "shipments_insert" ON shipments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shipments_update" ON shipments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "shipments_delete" ON shipments FOR DELETE USING (auth.uid() = user_id);

-- Inventory Movements: user_id scoped
CREATE POLICY "inventory_select" ON inventory_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inventory_insert" ON inventory_movements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Expenses: user_id scoped
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (auth.uid() = user_id);

-- Invitations: invited_by scoped + public read by token
CREATE POLICY "invitations_select" ON invitations FOR SELECT USING (TRUE);
CREATE POLICY "invitations_insert" ON invitations FOR INSERT WITH CHECK (auth.uid() = invited_by);
CREATE POLICY "invitations_update" ON invitations FOR UPDATE USING (TRUE);

-- Tags: user_id scoped
CREATE POLICY "tags_select" ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tags_insert" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tags_delete" ON tags FOR DELETE USING (auth.uid() = user_id);

-- Tariff Watches: user_id scoped
CREATE POLICY "tariff_select" ON tariff_watches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tariff_insert" ON tariff_watches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tariff_update" ON tariff_watches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tariff_delete" ON tariff_watches FOR DELETE USING (auth.uid() = user_id);

-- Webhook Configs: user_id scoped
CREATE POLICY "webhook_select" ON webhook_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "webhook_insert" ON webhook_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "webhook_update" ON webhook_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "webhook_delete" ON webhook_configs FOR DELETE USING (auth.uid() = user_id);

-- Activity Log: user_id scoped
CREATE POLICY "activity_select" ON activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activity_insert" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Settings: user_id scoped
CREATE POLICY "settings_select" ON settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "settings_insert" ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update" ON settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "settings_delete" ON settings FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_purchase_orders_updated BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_shipments_updated BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate next PO number
CREATE OR REPLACE FUNCTION next_po_number(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(po_number, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  INTO next_num
  FROM purchase_orders
  WHERE user_id = p_user_id;
  RETURN 'PO-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Calculate product inventory from movements
CREATE OR REPLACE FUNCTION get_product_stock(p_product_id UUID)
RETURNS INTEGER AS $$
DECLARE
  stock INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('purchase_in', 'return_in', 'adjustment') THEN quantity
      WHEN type IN ('sale_out', 'damage_out') THEN -quantity
      ELSE 0
    END
  ), 0) INTO stock
  FROM inventory_movements
  WHERE product_id = p_product_id;
  RETURN stock;
END;
$$ LANGUAGE plpgsql;
