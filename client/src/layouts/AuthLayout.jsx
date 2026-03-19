import { Outlet, Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function AuthLayout() {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-full flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col items-center justify-center p-12 text-white">
        <div className="text-6xl mb-6">🏪</div>
        <h1 className="text-4xl font-bold mb-4">MultiShop</h1>
        <p className="text-blue-200 text-lg text-center max-w-sm">
          Manage all your shops, inventory, billing, and staff from one place.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-4 text-sm text-blue-200">
          {['Multi-shop support', 'Role-based access', 'POS billing', 'Analytics & reports'].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="text-green-400">✓</span> {f}
            </div>
          ))}
        </div>
      </div>
      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <span className="text-5xl">🏪</span>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">MultiShop</h1>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
