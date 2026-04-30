import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { register } from '../lib/api';
import { setToken } from '../lib/auth';

export function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await register(email, password, name);
      setToken(token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Clock className="h-8 w-8 text-indigo-400" />
          <span className="text-2xl font-semibold text-white">Hours Tracker</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl p-6 space-y-4 shadow-lg">
          <h1 className="text-lg font-semibold text-white mb-2">Create account</h1>

          {error && (
            <div className="bg-rose-950 text-rose-300 text-sm rounded-md px-3 py-2">{error}</div>
          )}

          <div className="space-y-1">
            <label className="text-sm text-slate-400">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="min. 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
