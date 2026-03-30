import { Link } from 'react-router-dom';
import { AlertCircle, Package, DollarSign, Zap, TrendingUp, Info } from 'lucide-react';

const ICONS = {
  low_stock: Package,
  new_expense: DollarSign,
  ai_suggestion: Zap,
  high_sales: TrendingUp,
  system_notice: Info,
  error: AlertCircle,
};

const COLORS = {
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function AlertCard({ alert, onDismiss }) {
  const Icon = ICONS[alert.type] || Info;
  const color = COLORS[alert.severity] || COLORS.info;

  return (
    <div className={`rounded-xl p-4 border shadow-sm hover:shadow-md transition-all ${color}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1 capitalize">{alert.type.replace(/_/g, ' ')}</h4>
          <p className="text-sm mb-2 line-clamp-2">{alert.message}</p>
          {alert.data && (
            <p className="text-xs text-gray-500 mb-3">
              {Object.entries(alert.data).map(([key, val]) => `${key}: ${val}`).join(' · ')}
            </p>
          )}
          {alert.action && alert.route && (
            <Link
              to={alert.route}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              {alert.action}
            </Link>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 -m-1 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
        >
          ×
        </button>
      </div>
    </div>
  );
}

