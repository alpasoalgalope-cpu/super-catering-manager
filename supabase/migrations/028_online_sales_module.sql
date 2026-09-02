-- ============================================================
-- MIGRACIÓN 028: MÓDULO DE VENTA ONLINE CON MERCADO PAGO
-- ============================================================
-- Permite a los pasajeros de los micros comprar combos
-- directamente desde su celular vía link/QR, pagando con
-- Mercado Pago. Se integra con el sistema de ventas,
-- stock y tesorería existente.
-- ============================================================

-- ============================================================
-- 1. TABLA DE CLIENTES ONLINE (Base de datos de pasajeros)
-- ============================================================
-- Almacena datos de cada pasajero que compra online.
-- Email es la clave de tracking principal para CRM.
CREATE TABLE IF NOT EXISTS online_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    dni TEXT,
    city TEXT,
    notes TEXT,
    -- Métricas automáticas (se actualizan con triggers/actions)
    total_orders INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    first_order_at TIMESTAMPTZ,
    last_order_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. TIENDA ONLINE POR EVENTO
-- ============================================================
-- Cada evento puede tener una tienda online asociada.
-- Configura el menú, precios, fechas y datos de presentación.
CREATE TABLE IF NOT EXISTS online_store_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_master_id UUID NOT NULL REFERENCES events_master(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,

    -- Presentación
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    banner_image_url TEXT,

    -- Estado
    is_active BOOLEAN DEFAULT true,
    sales_deadline TIMESTAMPTZ,

    -- Fechas de viaje disponibles (array de fechas)
    available_dates DATE[] NOT NULL DEFAULT '{}',

    -- Menú: Combos disponibles con precios y descripciones
    combo_trad_enabled BOOLEAN DEFAULT true,
    combo_trad_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    combo_trad_name TEXT DEFAULT 'Combo Tradicional + Agua',
    combo_trad_desc TEXT,

    combo_veg_enabled BOOLEAN DEFAULT true,
    combo_veg_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    combo_veg_name TEXT DEFAULT 'Combo Vegetariano + Agua',
    combo_veg_desc TEXT,

    combo_sintacc_enabled BOOLEAN DEFAULT true,
    combo_sintacc_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    combo_sintacc_name TEXT DEFAULT 'Combo Sin TACC + Agua',
    combo_sintacc_desc TEXT,

    combo_vegan_enabled BOOLEAN DEFAULT false,
    combo_vegan_price NUMERIC(12,2) DEFAULT 0,
    combo_vegan_name TEXT DEFAULT 'Combo Vegano + Agua',
    combo_vegan_desc TEXT,

    -- Vinculación con reglas comerciales (opcional, para heredar precios)
    commercial_rule_id UUID REFERENCES commercial_rules(id),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. PEDIDOS ONLINE
-- ============================================================
-- Cada pedido de un pasajero. Puede contener múltiples combos
-- de distintos tipos, sin límite de cantidad.
CREATE TABLE IF NOT EXISTS online_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Relaciones
    store_event_id UUID NOT NULL REFERENCES online_store_events(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES online_customers(id),

    -- Contexto del viaje
    travel_date DATE NOT NULL,
    bus_identifier TEXT,

    -- Cantidades por tipo de combo (sin límite)
    qty_tradicional INT NOT NULL DEFAULT 0 CHECK (qty_tradicional >= 0),
    qty_vegetariano INT NOT NULL DEFAULT 0 CHECK (qty_vegetariano >= 0),
    qty_sintacc INT NOT NULL DEFAULT 0 CHECK (qty_sintacc >= 0),
    qty_vegano INT NOT NULL DEFAULT 0 CHECK (qty_vegano >= 0),

    -- Precios snapshot al momento de la compra
    price_trad_unit NUMERIC(12,2) DEFAULT 0,
    price_veg_unit NUMERIC(12,2) DEFAULT 0,
    price_sintacc_unit NUMERIC(12,2) DEFAULT 0,
    price_vegan_unit NUMERIC(12,2) DEFAULT 0,

    -- Total
    total_amount NUMERIC(12,2) NOT NULL,

    -- Mercado Pago
    mp_preference_id TEXT,
    mp_payment_id TEXT,
    mp_status TEXT DEFAULT 'pending',
    mp_detail TEXT,

    -- Estado del pedido
    status TEXT NOT NULL DEFAULT 'pending_payment'
        CHECK (status IN (
            'pending_payment',
            'paid',
            'cancelled',
            'refunded'
        )),

    -- Sincronización con el sistema de ventas existente
    synced_to_header_id UUID REFERENCES event_sales_headers(id),
    synced_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_online_customers_email ON online_customers(email);
CREATE INDEX IF NOT EXISTS idx_online_store_slug ON online_store_events(slug);
CREATE INDEX IF NOT EXISTS idx_online_store_event_master ON online_store_events(event_master_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_store ON online_orders(store_event_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_customer ON online_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_online_orders_mp_preference ON online_orders(mp_preference_id);

-- ============================================================
-- 5. FUNCIÓN: Actualizar métricas del cliente tras pago
-- ============================================================
CREATE OR REPLACE FUNCTION update_online_customer_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actuar cuando el pedido pasa a 'paid'
    IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
        UPDATE online_customers SET
            total_orders = total_orders + 1,
            total_spent = total_spent + NEW.total_amount,
            first_order_at = COALESCE(first_order_at, now()),
            last_order_at = now(),
            updated_at = now()
        WHERE id = NEW.customer_id;
    END IF;
    
    -- Si se reembolsa, revertir métricas
    IF NEW.status = 'refunded' AND OLD.status = 'paid' THEN
        UPDATE online_customers SET
            total_orders = GREATEST(total_orders - 1, 0),
            total_spent = GREATEST(total_spent - NEW.total_amount, 0),
            updated_at = now()
        WHERE id = NEW.customer_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_customer_metrics
    AFTER UPDATE OF status ON online_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_online_customer_metrics();

-- ============================================================
-- 6. RLS (Row Level Security)
-- ============================================================
-- Tiendas: lectura pública para tiendas activas
ALTER TABLE online_store_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read store events"
    ON online_store_events FOR SELECT
    USING (true);

CREATE POLICY "Public can insert store events"
    ON online_store_events FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Authenticated users manage stores"
    ON online_store_events FOR ALL
    USING (auth.role() = 'authenticated');

-- Customers: creación pública (para que el pasajero se registre sin auth)
ALTER TABLE online_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert customers"
    ON online_customers FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public can read own customer by email"
    ON online_customers FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users manage customers"
    ON online_customers FOR ALL
    USING (auth.role() = 'authenticated');

-- Orders: creación pública, lectura del admin
ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert orders"
    ON online_orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public can read own orders"
    ON online_orders FOR SELECT
    USING (true);

CREATE POLICY "Public can update own orders"
    ON online_orders FOR UPDATE
    USING (true);

CREATE POLICY "Authenticated users manage orders"
    ON online_orders FOR ALL
    USING (auth.role() = 'authenticated');

-- ============================================================
-- FIN DE MIGRACIÓN 028
-- ============================================================
