-- ============================================================
-- SEVELIN POS — Ajustes de base de datos
-- Ejecutar en Supabase → SQL Editor (una sola vez)
-- ============================================================

-- 1. Campos de medidas y descripción (estándar Tiendanube)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS peso_kg NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alto_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ancho_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profundidad_cm NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- 2. Al borrar una venta, su detalle se borra solo
ALTER TABLE venta_items DROP CONSTRAINT IF EXISTS venta_items_venta_id_fkey;
ALTER TABLE venta_items
  ADD CONSTRAINT venta_items_venta_id_fkey
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE;

-- 3. SEGURIDAD: ahora que existe un backend, el navegador ya no debe poder
--    entrar directo. Activamos RLS y NO creamos políticas públicas: el backend
--    usa la service_role key, que omite RLS, así que sigue funcionando.
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items  ENABLE ROW LEVEL SECURITY;

-- Si antes creaste políticas abiertas para la anon key, elimínalas.
-- Revisa cuáles existen con:
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- Y bórralas una a una, por ejemplo:
--   DROP POLICY IF EXISTS "acceso publico productos" ON productos;

-- 4. Índices útiles para el historial por fechas
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta_id ON venta_items (venta_id);

-- 5. Comprobación rápida de las columnas nuevas
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'productos' ORDER BY ordinal_position;
