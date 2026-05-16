import { cn } from '@/lib/utils'

interface SwitchProps {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

function Switch({ id, checked, onCheckedChange, disabled, className }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700',
        className
      )}
    >
      <span
        style={{ left: checked ? '22px' : '2px' }}
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200"
      />
    </button>
  )
}

export { Switch }
