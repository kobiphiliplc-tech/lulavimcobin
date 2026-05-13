-- ====================================================
-- הרץ את הכל ב-Supabase Dashboard → SQL Editor
-- https://app.supabase.com → SQL Editor → New Query
-- ====================================================

-- 1. הוספת עמודת season לטבלאות קיימות
alter table receiving_orders    add column if not exists season text not null default '2025';
alter table sorting_events      add column if not exists season text not null default '2025';
alter table inventory           add column if not exists season text not null default '2025';
alter table inventory_movements add column if not exists season text not null default '2025';

-- 2. יצירת טבלת settings אם לא קיימת
create table if not exists settings (
  id    serial primary key,
  key   text unique not null,
  value text not null
);

-- 3. תיקון unique constraint על inventory
alter table inventory drop constraint if exists inventory_grade_length_type_freshness_type_warehouse_id_key;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'inventory_season_grade_length_freshness_warehouse_key'
  ) then
    alter table inventory add constraint inventory_season_grade_length_freshness_warehouse_key
      unique (season, grade, length_type, freshness_type, warehouse_id);
  end if;
end $$;

-- 4. הגדרת עונה פעילה
insert into settings (key, value) values ('active_season', '2025') on conflict (key) do nothing;

-- 5. נתוני דמו — ספקים
insert into suppliers (name, contact_phone, notes) values
  ('משה לוי',      '050-1111111', 'ספק ותיק'),
  ('דוד כהן',      '052-2222222', ''),
  ('יוסף מזרחי',   '054-3333333', 'לולבים ארוכים בלבד'),
  ('אברהם ישראלי', '058-4444444', ''),
  ('שמעון פרץ',    '053-5555555', 'שדה בגוש עציון')
on conflict do nothing;

-- 6. נתוני דמו — שדות (מקושרים לספקים לפי שם)
with sup as (
  select id, name from suppliers
  where name in ('משה לוי','יוסף מזרחי','שמעון פרץ')
)
insert into fields (name, short_code, supplier_id)
select f.name, f.code, sup.id
from (values
  ('שדה א׳ — גוש עציון', 'GE-A', 'משה לוי'),
  ('שדה ב׳ — גוש עציון', 'GE-B', 'משה לוי'),
  ('שדה ירדן — יריחו',   'JR-1', 'יוסף מזרחי'),
  ('שדה הר חברון',        'HC-1', 'יוסף מזרחי'),
  ('שדה עמק יזרעאל',     'YZ-1', 'שמעון פרץ')
) as f(name, code, sup_name)
join sup on sup.name = f.sup_name
on conflict do nothing;
