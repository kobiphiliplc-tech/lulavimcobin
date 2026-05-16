export const GRADES = [
  { name: 'לבן',   color: '#F8F0DC', textColor: '#333', isReject: false },
  { name: 'ירוק',  color: '#4CAF50', textColor: '#fff', isReject: false },
  { name: 'כסף',   color: '#C0C0C0', textColor: '#333', isReject: false },
  { name: 'כסף2',  color: '#A0A0A0', textColor: '#fff', isReject: false },
  { name: 'כתום',  color: '#FF9800', textColor: '#fff', isReject: false },
  { name: 'כשר',   color: '#2196F3', textColor: '#fff', isReject: false },
  { name: 'שחור',  color: '#333333', textColor: '#fff', isReject: false },
  { name: 'עובש',  color: '#9E1010', textColor: '#fff', isReject: true  },
  { name: 'ענף',   color: '#795548', textColor: '#fff', isReject: true  },
]

export const LENGTH_TYPES = ['ארוך', 'רגיל', 'קצר'] as const
export const FRESHNESS_TYPES = ['מוקדם', 'טרי'] as const

export const GRADE_NAMES = GRADES.map(g => g.name)
export const NON_REJECT_GRADES = GRADES.filter(g => !g.isReject).map(g => g.name)
export const REJECT_GRADES = GRADES.filter(g => g.isReject).map(g => g.name)

export const GRADE_GROUP_TOP    = ['לבן', 'ירוק', 'כסף']
export const GRADE_GROUP_MID    = ['כסף2', 'כתום']
export const GRADE_GROUP_LOWER  = ['כשר', 'שחור']
export const GRADE_GROUP_REJECT = ['עובש', 'ענף']

export function getGradeColor(name: string): string {
  return GRADES.find(g => g.name === name)?.color ?? '#eee'
}

export function getGradeTextColor(name: string): string {
  return GRADES.find(g => g.name === name)?.textColor ?? '#333'
}
