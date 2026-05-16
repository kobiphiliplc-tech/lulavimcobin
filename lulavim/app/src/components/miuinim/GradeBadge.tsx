import { getGradeColor, getGradeTextColor } from '@/lib/constants'

export function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: getGradeColor(grade), color: getGradeTextColor(grade) }}
    >
      {grade}
    </span>
  )
}
