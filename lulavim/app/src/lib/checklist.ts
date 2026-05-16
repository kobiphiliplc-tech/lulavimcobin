import type { ChecklistItem } from '@/lib/types'

const MARKER = '{"__type":"checklist"'

export function isChecklist(description?: string): boolean {
  return !!description?.startsWith(MARKER)
}

export function parseChecklist(description?: string): ChecklistItem[] {
  if (!description) return []
  try {
    const parsed = JSON.parse(description)
    if (parsed.__type === 'checklist' && Array.isArray(parsed.items)) {
      return parsed.items as ChecklistItem[]
    }
  } catch {
    // not valid JSON
  }
  return []
}

export function serializeChecklist(items: ChecklistItem[]): string {
  return JSON.stringify({ __type: 'checklist', items })
}

export function newItem(text = ''): ChecklistItem {
  return { id: crypto.randomUUID(), text, checked: false }
}

export function checklistProgress(description?: string): { done: number; total: number } | null {
  if (!isChecklist(description)) return null
  const items = parseChecklist(description)
  return { done: items.filter(i => i.checked).length, total: items.length }
}

export function textToChecklist(text: string): ChecklistItem[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => newItem(line))
}
