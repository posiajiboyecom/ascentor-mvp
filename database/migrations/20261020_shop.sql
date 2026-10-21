-- 20261020_shop.sql
-- Shop (public site + member app + admin), built to the Ascentor App / Admin prototypes. NGN only.
--
--   products          extended: slug, shop category, fulfilment kind, naira price, stock, sizes, private file
--   shop_orders       one row per paid checkout (ASC-10xxx), shipping + status the admin moves along
--   shop_order_items  what was in the order, with the price AT THE TIME
--   shop_leads        name + email captured for free items (lead magnet)
--   payment_attempts  gains order_id so the existing settlement path can fulfil shop orders
--   storage           private bucket `shop-files` for PDFs (delivered by signed link only)
--
-- Safe to re-run. Nothing here is applied automatically: run it with scripts/apply-migration.ts.

-- ── products ────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug          text,
  ADD COLUMN IF NOT EXISTS shop_category text NOT NULL DEFAULT 'Digital',   -- Apparel | Accessories | Books and journals | Digital | Courses
  ADD COLUMN IF NOT EXISTS fulfilment    text NOT NULL DEFAULT 'ship',      -- ship | digital | learn
  ADD COLUMN IF NOT EXISTS price_ngn     integer NOT NULL DEFAULT 0,        -- whole naira; 0 = free
  ADD COLUMN IF NOT EXISTS stock         integer,                           -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS sizes         text[],                            -- NULL = no sizes
  ADD COLUMN IF NOT EXISTS file_path     text,                              -- path in the private shop-files bucket
  ADD COLUMN IF NOT EXISTS lead_capture  boolean NOT NULL DEFAULT false,    -- free items: ask for name + email first
  ADD COLUMN IF NOT EXISTS sold_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_plan      text;                              -- learn items: seeker | builder

-- Carry the old numeric price across once (only rows never priced in the new column).
UPDATE public.products SET price_ngn = ROUND(price)::int
  WHERE price_ngn = 0 AND price > 0 AND COALESCE(currency, 'NGN') = 'NGN';

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug) WHERE slug IS NOT NULL;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products FOR SELECT USING (published = true);
DROP POLICY IF EXISTS products_admin_all ON public.products;
CREATE POLICY products_admin_all ON public.products FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── orders ──────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.shop_order_seq START 10300;

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no      text NOT NULL UNIQUE DEFAULT ('ASC-' || nextval('public.shop_order_seq')),
  user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email         text NOT NULL,
  full_name     text,
  phone         text,
  status        text NOT NULL DEFAULT 'pending',     -- pending | paid | packing | shipped | delivered | cancelled | ready (digital)
  shipping_key  text,                                 -- lagos | ng | summit | none
  shipping_fee  integer NOT NULL DEFAULT 0,
  subtotal      integer NOT NULL DEFAULT 0,
  total         integer NOT NULL DEFAULT 0,
  address       jsonb,
  reference     text UNIQUE,
  paid_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_orders_user_idx ON public.shop_orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name        text NOT NULL,
  size        text,
  qty         integer NOT NULL CHECK (qty > 0),
  unit_price  integer NOT NULL,
  fulfilment  text NOT NULL DEFAULT 'ship'
);
CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON public.shop_order_items (order_id);

CREATE TABLE IF NOT EXISTS public.shop_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid REFERENCES public.products(id) ON DELETE SET NULL,
  email       text NOT NULL,
  full_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_leads_email_idx ON public.shop_leads (lower(email));

-- Members read their own orders; everything else goes through the server (service role) or admins.
ALTER TABLE public.shop_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_leads       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_orders_own ON public.shop_orders;
CREATE POLICY shop_orders_own ON public.shop_orders FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS shop_orders_admin ON public.shop_orders;
CREATE POLICY shop_orders_admin ON public.shop_orders FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS shop_items_own ON public.shop_order_items;
CREATE POLICY shop_items_own ON public.shop_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shop_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS shop_items_admin ON public.shop_order_items;
CREATE POLICY shop_items_admin ON public.shop_order_items FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS shop_leads_admin ON public.shop_leads;
CREATE POLICY shop_leads_admin ON public.shop_leads FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── payments: shop orders settle through the same payment_attempts path ─────
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.shop_orders(id) ON DELETE SET NULL;

-- ── private bucket for PDFs ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-files', 'shop-files', false)
  ON CONFLICT (id) DO UPDATE SET public = false;

-- ── stock: one atomic step per sold line (never below zero) ─────────────────
CREATE OR REPLACE FUNCTION public.shop_after_sale(p_product uuid, p_qty integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.products
     SET stock      = CASE WHEN stock IS NULL THEN NULL ELSE GREATEST(stock - p_qty, 0) END,
         sold_count = sold_count + p_qty
   WHERE id = p_product;
$$;
REVOKE ALL ON FUNCTION public.shop_after_sale(uuid, integer) FROM PUBLIC, anon, authenticated;
