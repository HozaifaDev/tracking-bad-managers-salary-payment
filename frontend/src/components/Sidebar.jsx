import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, Wallet, BarChart3,
  RefreshCw, Settings, Clock, LogOut,
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { clearToken } from '../lib/auth';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/monthly', label: 'Monthly', icon: BarChart3 },
  { to: '/sync', label: 'Sync', icon: RefreshCw },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ balance }) {
  const navigate = useNavigate();
  const owed = balance > 0;
  const over = balance < 0;

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-5">
        <Clock className="h-7 w-7 text-indigo-400" />
        <span className="text-lg font-semibold">Hours Tracker</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-3 space-y-2">
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-center text-xs font-semibold',
            owed && 'bg-rose-950 text-rose-200',
            !owed && !over && 'bg-emerald-950 text-emerald-200',
            over && 'bg-amber-950 text-amber-200',
          )}
        >
          <div className="text-slate-400">Balance</div>
          <div>{formatCurrency(balance)}</div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
