# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## תיאור הפרויקט

מערכת ניהול מלאי לולבים לחג הסוכות.  
כוללת: קבלת סחורה, מיון לפי רמות איכות, מלאי חי, מכירות ישראל וחו"ל, אריזות, משלוחים וממונות.  
המערכת עובדת גם offline בשטח ללא אינטרנט, ומסתנכרנת לענן אוטומטית כשחוזר חיבור.

**משתמשים:** 2–3 (משפחה/עובדים) — מחשב + טלפון  
**שפה:** עברית בלבד, ממשק RTL מלא

## סטאק טכנולוגי

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | Next.js 14 App Router + TypeScript |
| Backend / DB | Supabase (PostgreSQL + Realtime + Auth) |
| עיצוב | Tailwind CSS + shadcn/ui (RTL מלא) |
| טבלאות | TanStack Table v8 |
| טפסים | React Hook Form + Zod |
| Offline sync | Dexie.js |
| גרפים | Recharts |

## מבנה הפרויקט

```
app/src/
├── app/(app)/          # דפים ראשיים (App Router)
│   ├── page.tsx        # דשבורד
│   ├── miuinim/        # מיון לולבים לפי איכות
│   ├── kabala/         # קבלת סחורה / אריזה / משלוח
│   ├── malay/          # מכירות (ישראל + חו"ל)
│   ├── suppliers/      # ניהול ספקים
│   └── settings/       # הגדרות מערכת
├── components/
│   ├── layout/         # AppShell, Sidebar, OnlineIndicator
│   ├── miuinim/        # SortingForm, GradeBadge, WhatsAppShare
│   ├── providers/      # SyncProvider (offline sync)
│   └── ui/             # shadcn/ui primitives
├── lib/
│   ├── constants.ts    # grades, lengths, freshness — כל ההגדרות הקבועות
│   ├── types.ts        # TypeScript interfaces
│   ├── db/offline.ts   # Dexie.js — DB מקומי לעבודה offline
│   ├── supabase/       # client.ts + server.ts
│   └── context/        # SeasonContext (עונה פעילה)
app/supabase/schema.sql  # סכמת DB מלאה
app/migration.sql        # migration לDB קיים
```

## טרמינולוגיה עסקית (עברית ↔ קוד)

| עברית | משמעות | שם בקוד |
|-------|---------|---------|
| מיון | סיווג לולבים לפי איכות | `sorting_events`, `sorting_quantities` |
| קבלה | קבלת סחורה מספק | `receiving_orders` |
| מלאי | מלאי חי | `inventory` |
| ענפים | לולבים שנשברו/פסולים כענף | grade: `ענף` |
| כשר | כשר אך לא מהדרין | grade: `כשר` |
| עובש | פסול לחלוטין | grade: `עובש` |
| ארוך/רגיל/קצר | סוג אורך | `LengthType` = `'ארוך' \| 'רגיל' \| 'קצר'` |
| מוקדם/טרי | סוג טריות | `FreshnessType` = `'מוקדם' \| 'טרי'` |

## רמות איכות (Grades)

```
GradeGroup.high:   לבן, ירוק, כסף
GradeGroup.mid:    כסף2, כתום
GradeGroup.low:    כשר, שחור
GradeGroup.reject: עובש, ענף
```

מוגדר ב-`lib/constants.ts` — **לא ליצור grade חדש בלי לעדכן שם ובטבלת `grades` ב-Supabase**.

## ארכיטקטורת Offline-First

- **Dexie.js** (`lib/db/offline.ts`) — IndexedDB מקומי בדפדפן, מחזיק פעולות pending
- **SyncProvider** (`components/providers/`) — מאזין לאירועי חיבור רשת
- כשחוזר אינטרנט: כל הפעולות ב-queue נשלחות ל-Supabase אוטומטית עם toast
- **כלל חובה:** כל פעולת כתיבה חייבת לעבור דרך SyncProvider — לא לכתוב ישירות ל-Supabase client בקומפוננטות

## כללי קידוד חובה

- **RTL בלבד** — `dir="rtl"` ב-layout הראשי, אסור לשבור את הכיוון
- **אין טקסט אנגלי בממשק** — כל labels, placeholders, הודעות שגיאה — בעברית
- **Multi-season** — כל query ל-DB חייב לסנן לפי `season` מ-`SeasonContext`
- **shadcn/ui ראשון** — לבדוק `components/ui/` לפני יצירת קומפוננטה חדשה
- **טפסים** — React Hook Form + Zod לכל טופס, ללא יוצא מן הכלל
- **אין לערבב** `@base-ui/react` עם shadcn/ui באותה קומפוננטה

## טבלאות DB מרכזיות

| טבלה | תפקיד |
|------|--------|
| `receiving_orders` | קבלת סחורה מספק |
| `sorting_events` | אירועי מיון (header) |
| `sorting_quantities` | פירוט כמויות לפי grade לכל מיון |
| `inventory` | מלאי חי — unique: `(season, grade, length_type, freshness_type, warehouse_id)` |
| `inventory_movements` | audit trail של כל תנועת מלאי |
| `grades` | רשימת רמות איכות |
| `suppliers` + `fields` | ספקים ושדות גידול |
| `settings` | קונפיגורציה כולל `active_season` |

## Gotchas ידועים

- migration `sorting_receiving_links` חייב לרוץ לפני שמירת מיון חדש — ראה `app/migration.sql`
- inventory מחויב unique על `(season, grade, length_type, freshness_type, warehouse_id)` — upsert ולא insert
- `@base-ui/react` מותקן אך shadcn/ui הוא הסטנדרט — לא לערבב

## פקודות פיתוח

```bash
cd app
npm run dev        # dev server — http://localhost:3000
npm run build      # בדיקת build
npm run lint       # ESLint
```

**משתני סביבה נדרשים** (`app/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Claude Configuration

תחת `.claude/` יושבים הגדרות מותאמות לפרויקט:

- `.claude/agents/` — הגדרות sub-agents לפרויקט
- `.claude/skills/` — skills ייעודיים לפרויקט
- `.claude/commands/` — פקודות slash מותאמות
