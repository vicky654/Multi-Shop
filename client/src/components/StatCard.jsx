export default function StatCard({ icon: Icon, label, value, sub, color = 'blue', trend }) {
  const colors = {
    blue:   { card: 'bg-blue-50 border-blue-200',   icon: 'bg-blue-100 text-blue-600',   val: 'text-blue-700' },
    green:  { card: 'bg-green-50 border-green-200', icon: 'bg-green-100 text-green-600', val: 'text-green-700' },
    orange: { card: 'bg-orange-50 border-orange-200', icon: 'bg-orange-100 text-orange-600', val: 'text-orange-700' },
    red:    { card: 'bg-red-50 border-red-200',     icon: 'bg-red-100 text-red-600',     val: 'text-red-700' },
    purple: { card: 'bg-purple-50 border-purple-200', icon: 'bg-purple-100 text-purple-600', val: 'text-purple-700' },
  }[color] || {};

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${colors.card}`}>
      {Icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${colors.val}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
        {trend !== undefined && (
          <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
          </p>
        )}
      </div>
    </div>
  );
}
