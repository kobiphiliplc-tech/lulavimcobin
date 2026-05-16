-- fix_supplier_duplicates.sql
-- מנקה כפיליות ספקים ומוסיף unique constraint
-- יש להריץ ב-Supabase SQL Editor

BEGIN;

-- 1. נרמול שמות — הסרת רווחים מיותרים
UPDATE suppliers SET name = TRIM(name) WHERE name != TRIM(name);

-- 2. עדכון sorting_events — הפניית supplier_id לרשומה השרודה (MIN id)
UPDATE sorting_events se
SET supplier_id = keeper.id
FROM suppliers dup
JOIN (
  SELECT name, MIN(id) AS id
  FROM suppliers
  GROUP BY name
  HAVING COUNT(*) > 1
) keeper ON dup.name = keeper.name
WHERE se.supplier_id = dup.id
  AND dup.id <> keeper.id;

-- 3. עדכון receiving_orders — אותו דבר
UPDATE receiving_orders ro
SET supplier_id = keeper.id
FROM suppliers dup
JOIN (
  SELECT name, MIN(id) AS id
  FROM suppliers
  GROUP BY name
  HAVING COUNT(*) > 1
) keeper ON dup.name = keeper.name
WHERE ro.supplier_id = dup.id
  AND dup.id <> keeper.id;

-- 4. עדכון fields — אותו דבר
UPDATE fields f
SET supplier_id = keeper.id
FROM suppliers dup
JOIN (
  SELECT name, MIN(id) AS id
  FROM suppliers
  GROUP BY name
  HAVING COUNT(*) > 1
) keeper ON dup.name = keeper.name
WHERE f.supplier_id = dup.id
  AND dup.id <> keeper.id;

-- 5. מחיקת הכפיליות (שמור את ה-id הנמוך ביותר לכל שם)
DELETE FROM suppliers
WHERE id NOT IN (
  SELECT MIN(id)
  FROM suppliers
  GROUP BY name
);

-- 5. הוספת unique constraint
ALTER TABLE suppliers ADD CONSTRAINT suppliers_name_key UNIQUE (name);

COMMIT;
