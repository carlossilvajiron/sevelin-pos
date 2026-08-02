-- ============================================================
-- SEVELIN POS — Control de stock, alertas e importación de ventas
-- Archivo: sql/03-stock-alertas-importacion.sql
-- Ejecutar en Supabase → SQL Editor, después del 01 y del 02.
-- Es idempotente: puede correrse varias veces sin efectos secundarios.
-- ============================================================

-- 1. Control de stock por producto
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS stock_minimo NUMERIC DEFAULT 3,
  ADD COLUMN IF NOT EXISTS alerta_stock BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS stock_actualizado_en TIMESTAMP WITH TIME ZONE NULL;

-- Los productos ya existentes quedan con la alerta activa y un mínimo base
UPDATE productos SET alerta_stock = TRUE  WHERE alerta_stock IS NULL;
UPDATE productos SET stock_minimo = 3     WHERE stock_minimo IS NULL;

-- 2. Índice para las consultas de bajo stock
CREATE INDEX IF NOT EXISTS idx_productos_stock ON productos (stock);

-- 3. El correlativo de ventas debe poder recibir un número explícito al
--    importar respaldos. Se ajusta la secuencia para que continúe después
--    del mayor número existente y no choque con las ventas importadas.
DO $$
DECLARE
  maximo BIGINT;
  secuencia TEXT;
BEGIN
  SELECT pg_get_serial_sequence('ventas', 'numero_orden') INTO secuencia;
  IF secuencia IS NOT NULL THEN
    SELECT COALESCE(MAX(numero_orden), 0) INTO maximo FROM ventas;
    PERFORM setval(secuencia, GREATEST(maximo, 1));
  END IF;
END $$;

-- 4. Comprobaciones rápidas (descomenta para revisar)
-- SELECT nombre, stock, stock_minimo, alerta_stock, stock_actualizado_en
--   FROM productos WHERE alerta_stock AND stock <= stock_minimo ORDER BY stock;
-- SELECT SUM(stock * costo_unitario) AS costo_inventario,
--        SUM(stock * precio_unitario) AS venta_estimada FROM productos;
