import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const ROLE_LABELS = {
  super_admin:     'Super Admin',
  owner:           'Owner',
  manager:         'Manager',
  billing_staff:   'Billing Staff',
  inventory_staff: 'Inventory Staff',
};

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [dropOpen, setDropOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="shrink-0 bg-white border-b border-gray-200 z-10">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-gray-800 hidden sm:block">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setDropOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-800 leading-tight">{user?.name}</p>
                <p className="text-xs text-gray-500">{ROLE_LABELS[user?.role]}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {dropOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
