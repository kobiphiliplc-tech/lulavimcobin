// Demo seed script — run once: node seed.mjs
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://swavjijwfkqkohxgnkvf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXZqaWp3Zmtxa29oeGdua3ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5ODAyMDQsImV4cCI6MjA5MzU1NjIwNH0.94NOuEUPOPSEY2lRSpmA2WiGPhhHHpliD4gQIWyZOvo'
)

async function seed() {
  console.log('🌱 מכניס נתוני דמו...')

  // ── ספקים ────────────────────────────────────────────────
  const { data: suppliers, error: supErr } = await supabase
    .from('suppliers')
    .insert([
      { name: 'משה לוי',      contact_phone: '050-1111111', notes: 'ספק ותיק' },
      { name: 'דוד כהן',      contact_phone: '052-2222222', notes: '' },
      { name: 'יוסף מזרחי',   contact_phone: '054-3333333', notes: 'לולבים ארוכים בלבד' },
      { name: 'אברהם ישראלי', contact_phone: '058-4444444', notes: '' },
      { name: 'שמעון פרץ',    contact_phone: '053-5555555', notes: 'שדה בגוש עציון' },
    ])
    .select()

  if (supErr) {
    console.error('❌ שגיאה בספקים:', supErr.message)
    return
  }
  console.log(`✅ הוכנסו ${suppliers.length} ספקים`)

  // ── שדות (קשורים לספקים) ─────────────────────────────────
  const [s1, s2, s3] = suppliers
  const { data: fields, error: fldErr } = await supabase
    .from('fields')
    .insert([
      { name: 'שדה א׳ — גוש עציון',   short_code: 'GE-A', supplier_id: s1.id },
      { name: 'שדה ב׳ — גוש עציון',   short_code: 'GE-B', supplier_id: s1.id },
      { name: 'שדה ירדן — יריחו',      short_code: 'JR-1', supplier_id: s2.id },
      { name: 'שדה הר חברון',          short_code: 'HC-1', supplier_id: s3.id },
      { name: 'שדה עמק יזרעאל',        short_code: 'YZ-1', supplier_id: s3.id },
    ])
    .select()

  if (fldErr) {
    console.error('❌ שגיאה בשדות:', fldErr.message)
    return
  }
  console.log(`✅ הוכנסו ${fields.length} שדות`)

  console.log('\n✨ סיום! עכשיו פתח מיון חדש — תראה ספקים ושדות ברשימות.')
  console.log('\n⚠️  אם עדיין יש שגיאת season — הרץ את migration.sql ב-Supabase SQL Editor.')
}

seed().catch(console.error)
