/**
 * Reusable Button — design system baseline.
 *
 * Variants:
 *   primary   – solid blue  (default)
 *   secondary – light gray
 *   outline   – white + border
 *   danger    – solid red
 *   ghost     – transparent, text only
 *
 * Props:
 *   variant   – one of the above strings
 *   size      – 'sm' | 'md' (default) | 'lg'
 *   loading   – shows spinner and disables the button
 *   icon      – lucide-react icon component shown to the left of children
 *   iconRight – lucide-react icon component shown to the right of children
 *   fullWidth – makes the button w-full
 *   All standard <button> props pass through.
 */

const VARIANTS = {
  primary:   'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm',
  secondary: 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700',
  outline:   'bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 text-gray-700',
  danger:    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm',
  ghost:     'bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-600',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-semibold rounded-lg transition',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size]        || SIZES.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <span className="animate-spin w-4 h-4 border-2 border-current/30 border-t-current rounded-full shrink-0" />
      )}
      {!loading && Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children && <span>{children}</span>}
      {!loading && IconRight && <IconRight className="w-4 h-4 shrink-0 ml-auto" />}
    </button>
  );
}
