import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { Compass, Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck, Truck, User } from 'lucide-react';

const Login = () => {
  const [selectedRole, setSelectedRole] = useState('OWNER');
  const [email, setEmail] = useState('owner@routexai.com');
  const [password, setPassword] = useState('RouteXAI@123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const demoAccounts = {
    OWNER: { email: 'owner@routexai.com', password: 'RouteXAI@123' },
    DRIVER: { email: 'rajesh.driver@routexai.com', password: 'RouteXAI@123' },
    CUSTOMER: { email: 'aarav.retail@example.com', password: 'RouteXAI@123' }
  };

  const { user, login, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'OWNER') navigate('/owner/dashboard', { replace: true });
      else if (user.role === 'DRIVER') navigate('/driver/dashboard', { replace: true });
      else if (user.role === 'CUSTOMER') navigate('/customer/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    if (demoAccounts[role]) {
      setEmail(demoAccounts[role].email);
      setPassword(demoAccounts[role].password);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);

      // Verify that the logged in user's role matches the selected role button
      if (loggedInUser.role !== selectedRole) {
        logout(); // Clear invalid token session
        setError(`Access Denied! This account is a ${loggedInUser.role} account. Please select the '${loggedInUser.role}' tab above to sign in.`);
        return;
      }

      if (loggedInUser.role === 'OWNER') navigate('/owner/dashboard');
      else if (loggedInUser.role === 'DRIVER') navigate('/driver/dashboard');
      else navigate('/customer/dashboard');
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach backend server. Please verify the backend service is running or check your network connection.');
      } else if (err.response.status === 404) {
        setError('API endpoint not found (HTTP 404). Please verify backend routes and API configuration.');
      } else if (err.response.status >= 500 && !err.response?.data?.message) {
        setError('RouteXAI Backend server is offline or unreachable. Please launch start-all.bat or check your backend connection.');
      } else {
        setError(err.response?.data?.message || 'Login failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/20 mb-3">
            <Compass className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">RouteXAI Platform</h2>
          <p className="text-xs text-slate-400 mt-1">Select your account role and sign in to access your portal</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="mb-6">
          <label className="block text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider text-center">
            Select Portal Role
          </label>
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => handleRoleSelect('OWNER')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                selectedRole === 'OWNER'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OWNER</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('DRIVER')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                selectedRole === 'DRIVER'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>DRIVER</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('CUSTOMER')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                selectedRole === 'CUSTOMER'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>CUSTOMER</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2 mb-6 leading-relaxed">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-11 pr-11 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : `Sign In as ${selectedRole}`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-cyan-400 font-semibold hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
