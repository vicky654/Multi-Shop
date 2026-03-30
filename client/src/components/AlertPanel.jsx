import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import AlertCard from './AlertCard';
import { alertsApi } from '../api/alerts.api';
import useShopStore from '../store/shopStore';

export default function AlertPanel({ isOpen, onClose, alerts, onAlertClick }) {
  const [visibleAlerts, setVisibleAlerts] = useState([]);
  const timeoutRef = useRef(null);

  // Filter unseen alerts (localStorage)
  const getSeenAlerts = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('seenAlerts') || '[]');
    } catch {
      return [];
    }
  }, []);

  const markSeen = useCallback((alertId) => {
    const seen = getSeenAlerts();
    if (!seen.includes(alertId)) {
      seen.push(alertId);
      localStorage.setItem('seenAlerts', JSON.stringify(seen));
    }
  }, [getSeenAlerts]);

  useEffect(() => {
    if (!isOpen || !alerts.length) return;

    const unseenAlerts = alerts.filter(a => !getSeenAlerts().includes(a.id));
    setVisibleAlerts(unseenAlerts.slice(0, 3)); // Max 3

    // Auto hide after 6s
    timeoutRef.current = setTimeout(() => {
      setVisibleAlerts([]);
      onClose();
    }, 6000);

    return () => clearTimeout(timeoutRef.current);
  }, [isOpen, alerts, getSeenAlerts, onClose]);

  if (!isOpen || visibleAlerts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 lg:right-6 z-50 w-full lg:w-96 max-w-sm lg:max-w-md xl:max-w-lg">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 shadow-2xl max-h-96 overflow-hidden lg:ml-auto">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse" />
            <h3 className="font-semibold text-gray-900 text-sm">New Alerts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
          {visibleAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDismiss={() => {
                markSeen(alert.id);
                setVisibleAlerts(prev => prev.filter(a => a.id !== alert.id));
              }}
              onClick={() => onAlertClick(alert)}
            />
          ))}
          {alerts.length > 3 && (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 p-3 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              View All ({alerts.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

