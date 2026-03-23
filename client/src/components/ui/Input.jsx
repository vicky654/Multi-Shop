/**
 * Reusable Input component — design system baseline.
 *
 * Props:
 *   label       – visible label above the input
 *   placeholder – always required for accessibility
 *   error       – validation message shown in red below
 *   hint        – secondary helper text shown in gray below
 *   icon        – lucide-react icon component shown on the left
 *   required    – adds a red asterisk to the label
 *   className   – extra classes on the wrapper div
 *   All standard <input> props (type, value, onChange, disabled, …) pass through.
 */
export function Input({
  label,
  placeholder,
  error,
  hint,
  icon: Icon,
  required,
  className = '',
  id,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 select-none"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        )}
        <input
          id={inputId}
          placeholder={placeholder}
          required={required}
          className={[
            'w-full py-2 pr-3 border rounded-lg text-sm transition',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
            Icon ? 'pl-9' : 'pl-3',
            error
              ? 'border-red-400 bg-red-50 focus:ring-red-400'
              : 'border-gray-300 bg-white',
          ].join(' ')}
          {...props}
        />
      </div>

      {error && <p className="text-xs text-red-500 flex items-center gap-1">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * Textarea variant — same styling as Input.
 */
export function Textarea({
  label,
  placeholder,
  error,
  hint,
  required,
  className = '',
  id,
  rows = 3,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 select-none">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className={[
          'w-full px-3 py-2 border rounded-lg text-sm transition resize-none',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
          error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white',
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
