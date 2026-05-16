-- ====== DB Schema: מערכת ניהול מלאי לולבים ======

create table grades (
  id serial primary key,
  name text not null,
  is_reject boolean default false,
  sort_order int,
  sell_price_early numeric,
  sell_price_fresh numeric
);

create table suppliers (
  id serial primary key,
  name text not null,
  contact_phone text,
  notes text
);

create table fields (
  id serial primary key,
  supplier_id int references suppliers(id),
  name text not null,
  short_code text
);

create table customers (
  id serial primary key,
  name text not null,
  phone text,
  country text default 'IL',
  type text default 'regular',
  notes text
);

create table warehouses (
  id serial primary key,
  name text not null,
  location text
);

-- הגדרות מערכת (כולל עונה פעילה)
create table settings (
  id serial primary key,
  key text unique not null,
  value text not null
);

create table receiving_orders (
  id serial primary key,
  serial_no text unique not null,
  season text not null default '2025',
  received_date date not null,
  supplier_id int references suppliers(id),
  field_id int references fields(id),
  field_plot text,
  length_type text check (length_type in ('ארוך', 'רגיל', 'קצר')),
  freshness_type text check (freshness_type in ('מוקדם', 'טרי')),
  harvest_date date,
  pallet_count int,
  total_quantity int,
  returns_quantity int default 0,
  category text default 'לולבים למיון',
  status text default 'pending',
  price_per_unit numeric,
  total_price numeric,
  notes text,
  created_at timestamptz default now()
);

create table sorting_events (
  id serial primary key,
  sort_serial int unique not null,
  season text not null default '2025',
  receiving_serial text references receiving_orders(serial_no),
  sorted_date date not null,
  field_id int references fields(id),
  field_name text,
  length_type text check (length_type in ('ארוך', 'רגיל', 'קצר')),
  freshness_type text check (freshness_type in ('מוקדם', 'טרי')),
  supplier_id int references suppliers(id),
  status_type text default 'בסיסי',
  notes text,
  created_at timestamptz default now()
);

create table sorting_quantities (
  id serial primary key,
  sorting_event_id int references sorting_events(id) on delete cascade,
  grade text not null,
  quantity int not null default 0
);

create table inventory (
  id serial primary key,
  season text not null default '2025',
  grade text not null,
  length_type text not null,
  freshness_type text not null,
  quantity int not null default 0,
  warehouse_id int references warehouses(id),
  updated_at timestamptz default now(),
  unique(season, grade, length_type, freshness_type, warehouse_id)
);

create table inventory_movements (
  id serial primary key,
  season text not null default '2025',
  movement_date timestamptz default now(),
  movement_type text not null,
  grade_from text,
  grade_to text,
  length_type text,
  freshness_type text,
  quantity int not null,
  reference_id int,
  reference_type text,
  notes text,
  created_by text
);

create table grade_changes (
  id serial primary key,
  change_date date not null,
  grade_from text not null,
  length_from text,
  freshness_from text,
  quantity int not null,
  grade_to text not null,
  length_to text,
  freshness_to text,
  reason text,
  notes text,
  created_at timestamptz default now()
);

-- Seed: רמות ברירת מחדל
insert into grades (name, is_reject, sort_order, sell_price_early, sell_price_fresh) values
  ('לבן',   false, 1, null, null),
  ('ירוק',  false, 2, null, null),
  ('כסף',   false, 3, null, null),
  ('כסף2',  false, 4, null, null),
  ('כתום',  false, 5, null, null),
  ('כשר',   false, 6, null, null),
  ('שחור',  false, 7, null, null),
  ('עובש',  true,  8, null, null),
  ('ענף',   true,  9, null, null);

-- Seed: מחסן ברירת מחדל
insert into warehouses (name, location) values ('מחסן ראשי', '');

-- Seed: הגדרות ברירת מחדל
insert into settings (key, value) values ('active_season', '2025');

-- ====== Migration: הוסף season לטבלאות קיימות ======
-- (הרץ את זה אם הטבלאות כבר קיימות ב-Supabase)
-- הרץ את זה ב-Supabase SQL Editor אם הטבלאות כבר קיימות:
alter table receiving_orders    add column if not exists season text not null default '2025';
alter table sorting_events      add column if not exists season text not null default '2025';
alter table inventory           add column if not exists season text not null default '2025';
alter table inventory_movements add column if not exists season text not null default '2025';

create table if not exists settings (
  id    serial primary key,
  key   text unique not null,
  value text not null
);

alter table inventory drop constraint if exists inventory_grade_length_type_freshness_type_warehouse_id_key;
alter table inventory add constraint inventory_season_grade_length_freshness_warehouse_key
  unique (season, grade, length_type, freshness_type, warehouse_id);

insert into settings (key, value) values ('active_season', '2025') on conflict (key) do nothing;

-- ====== Migration: מודול מכירות ======
alter table customers
  add column if not exists currency text default 'ILS',
  add column if not exists market   text default 'ישראל';

create table if not exists sale_orders (
  id           serial primary key,
  season       text not null,
  customer_id  int references customers(id),
  order_date   date not null,
  status       text default 'pending',
  currency     text default 'ILS',
  total_amount numeric,
  notes        text,
  created_at   timestamptz default now()
);

create table if not exists sale_order_items (
  id               serial primary key,
  order_id         int references sale_orders(id) on delete cascade,
  grade            text not null,
  length_type      text not null,
  freshness_type   text not null,
  quantity_ordered int not null default 0,
  quantity_ready   int not null default 0,
  quantity_packed  int not null default 0,
  unit_price       numeric,
  total_price      numeric,
  notes            text
);

create table if not exists customer_payments (
  id             serial primary key,
  customer_id    int references customers(id),
  order_id       int references sale_orders(id),
  season         text not null,
  payment_date   date not null,
  method         text,
  amount         numeric not null,
  currency       text default 'ILS',
  check_number   text,
  check_due_date date,
  notes          text,
  created_at     timestamptz default now()
);
