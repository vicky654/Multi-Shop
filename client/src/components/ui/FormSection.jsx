/**
 * FormSection — groups related form fields under a titled, colored card.
 *
 * Props:
 *   title    – section heading
 *   icon     – lucide-react icon component
 *   color    – 'blue' | 'purple' | 'green' | 'amber' | 'gray' (default: 'gray')
 *   children – form fields inside
 *   className – extra classes on the outer div
 */

const THEMES = {
  blue:   { wrap: 'bg-blue-50   border-blue-200',   head: 'text-blue-800'   },
  purple: { wrap: 'bg-purple-50 border-purple-200', head: 'text-purple-800' },
  green:  { wrap: 'bg-green-50  border-green-200',  head: 'text-green-800'  },
  amber:  { wrap: 'bg-amber-50  border-amber-200',  head: 'text-amber-800'  },
  gray:   { wrap: 'bg-gray-50   border-gray-200',   head: 'text-gray-700'   },
};

export function FormSection({ title, icon: Icon, color = 'gray', children, className = '' }) {
  const theme = THEMES[color] || THEMES.gray;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${theme.wrap} ${className}`}>
      {title && (
        <p className={`text-sm font-semibold flex items-center gap-1.5 ${theme.head}`}>
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          {title}
        </p>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
