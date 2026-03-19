import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

export default function Register() {
  const { register } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'name',     label: 'Full Name',    icon: User,  type: 'text',     placeholder: 'Raj Kumar' },
    { key: 'email',    label: 'Email',         icon: Mail,  type: 'email',    placeholder: 'raj@example.com' },
    { key: 'phone',    label: 'Phone',         icon: Phone, type: 'tel',      placeholder: '+91 98765 43210' },
    { key: 'password', label: 'Password',      icon: Lock,  type: 'password', placeholder: '••••••••' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Create account</h2>
      <p className="text-gray-500 text-sm mb-8">Register as a shop owner to get started</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map(({ key, label, icon: Icon, type, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="relative">
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={type}
                required={key !== 'phone'}
                value={form[key]}
                onChange={(e) => upd(key, e.target.value)}
                placeholder={placeholder}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
        >
          {loading && <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
      </p>
    </div>
  );
}
