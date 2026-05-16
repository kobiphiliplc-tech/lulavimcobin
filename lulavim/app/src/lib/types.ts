export type LengthType = 'ארוך' | 'רגיל' | 'קצר'
export type FreshnessType = 'מוקדם' | 'טרי'
export type GradeGroup = 'high' | 'mid' | 'low' | 'reject'

export interface Grade {
  id: number
  name: string
  color: string
  text_color: string
  group_name: GradeGroup
  sort_order: number
}

export interface SortingEvent {
  id: number
  sort_serial: number
  receiving_serial: string | null
  warehouse_code: string | null
  sorted_date: string
  field_id: number | null
  field_name: string | null
  length_type: LengthType
  freshness_type: FreshnessType
  supplier_id: number | null
  status_type: string
  notes: string | null
  created_at: string
  sorting_quantities?: SortingQuantity[]
}

export interface SortingQuantity {
  id?: number
  sorting_event_id?: number
  grade: string
  quantity: number
}

export interface ReceivingOrder {
  id: number
  serial_no: string
  order_type: string
  received_date: string
  supplier_id: number | null
  field_id: number | null
  field_plot: string | null
  length_type: LengthType
  freshness_type: FreshnessType
  harvest_date: string | null
  pallet_count: number | null
  total_quantity: number | null
  returns_quantity: number
  category: string
  status: string
  price_per_unit: number | null
  total_price: number | null
  order_currency: string
  notes: string | null
  created_at: string
  suppliers?: { name: string } | null
  fields?: { name: string } | null
}

export interface FieldForecast {
  id?: number
  field_id: number
  season: string
  expected_early: number
  expected_fresh: number
  fields?: { name: string; supplier_id: number | null } | null
}

export interface Supplier { id: number; name: string; contact_phone: string | null; notes: string | null }

export interface SupplierPayment {
  id: number
  supplier_id: number
  season: string
  payment_date: string
  method: 'העברה בנקאית' | 'שיק' | 'מזומן' | 'מטבע חוץ'
  amount: number
  currency: string
  check_number: string | null
  check_due_date: string | null
  notes: string | null
  created_at: string
}
export interface Field    { id: number; name: string; short_code: string | null; supplier_id: number | null }

export interface Warehouse { id: number; name: string; location: string | null }

export interface InventoryRow {
  id: number
  grade: string
  length_type: LengthType
  freshness_type: FreshnessType
  quantity: number
  warehouse_id: number | null
  updated_at: string
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  country: string
  market: 'ישראל' | 'חו"ל'
  currency: 'ILS' | 'USD' | 'EUR'
  notes: string | null
}

export interface SaleOrder {
  id: number
  season: string
  customer_id: number
  order_date: string
  status: 'pending' | 'ready' | 'packed' | 'shipped' | 'cancelled'
  currency: string
  total_amount: number | null
  notes: string | null
  created_at: string
  customers?: { name: string; market: string } | null
  sale_order_items?: SaleOrderItem[]
}

export interface SaleOrderItem {
  id?: number
  order_id?: number
  grade: string
  length_type: LengthType
  freshness_type: FreshnessType
  quantity_ordered: number
  quantity_ready: number
  quantity_packed: number
  unit_price: number | null
  total_price: number | null
  notes: string | null
}

export interface CustomerPayment {
  id: number
  customer_id: number
  order_id: number | null
  season: string
  payment_date: string
  method: 'העברה בנקאית' | 'שיק' | 'מזומן' | 'מטבע חוץ'
  amount: number
  currency: string
  check_number: string | null
  check_due_date: string | null
  notes: string | null
  created_at: string
}

export interface Season {
  id: number
  year: string
  start_date: string | null
  end_date: string | null
  label: string | null
  created_at: string
}

export interface TeamMember {
  id: number
  name: string
  supabase_user_id: string | null
  created_at: string
}

export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
}

export interface Task {
  id: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'done'
  priority: 'normal' | 'urgent'
  task_type: 'task' | 'note'
  due_date?: string
  due_time?: string
  reminder_days_before_season?: number
  season_context: 'current' | 'next' | 'timeless'
  season_year?: string
  is_recurring: boolean
  recurring_expires_year?: number
  linked_entity_type?: string
  linked_entity_id?: string
  linked_entity_name?: string
  linked_module?: string
  linked_sub_module?: string
  linked_record_id?: string
  linked_record_label?: string
  linked_deep_link_path?: string
  assigned_to_member_id?: number
  assigned_to_name?: string
  is_private: boolean
  created_by_user_id?: string
  created_at: string
  updated_at: string
}
