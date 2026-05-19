import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { register } from '../lib/api';
import { setToken, setUser } from '../lib/auth';

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
      const { token, user } = await register(email, password, name);
      setToken(token);
      setUser(user);
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Clock className="h-8 w-8 text-accent" />
          <span className="text-2xl font-semibold text-txt-primary">Hours Tracker</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-elevated rounded-lg border border-border p-6 space-y-4">
          <h1 className="text-lg font-semibold text-txt-primary mb-2">Create account</h1>

          {error && (
            <div className="bg-danger-bg text-danger-bright text-sm rounded-md px-3 py-2">{error}</div>
          )}

          <div className="space-y-1">
            <label className="text-sm text-txt-secondary">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-txt-primary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-page"
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-txt-secondary">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-txt-primary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-page"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-txt-secondary">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-txt-primary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-page"
              placeholder="min. 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-text rounded-md py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-sm text-txt-tertiary">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-bright hover:text-accent">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}