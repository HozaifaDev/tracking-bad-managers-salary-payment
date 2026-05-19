import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, Wallet, BarChart3,
  RefreshCw, Settings, Clock, LogOut, Bell, Briefcase, ChevronDown, CreditCard, Zap,
  Sun, Moon, Monitor,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn, formatCurrency } from '../lib/utils';
import { clearToken } from '../lib/auth';
import { useClient } from '../context/ClientContext';
import { getBillingStatus } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { NotificationBell } from './NotificationBell';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/monthly', label: 'Monthly', icon: BarChart3 },
  { to: '/sync', label: 'Sync', icon: RefreshCw },
  { to: '/clients', label: 'Clients', icon: Briefcase },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/billing', label: 'Billing', icon: CreditCard },
];

function ThemeToggle() {
  const { theme, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const currentIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-txt-secondary hover:bg-surface-elevated-hover hover:text-txt-primary transition-colors"
      >
        <currentIcon className="h-3.5 w-3.5" />
        <span className="capitalize">{theme === 'system' ? 'System' : theme}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-36 rounded-md border border-border bg-surface-elevated shadow-lg z-50 py-1">
          {[
            { value: 'light', icon: Sun, label: 'Light' },
            { value: 'dark', icon: Moon, label: 'Dark' },
            { value: 'system', icon: Monitor, label: 'System' },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => { setMode(value); setOpen(false); }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors',
                theme === value ? 'text-accent-bright font-semibold' : 'text-txt-secondary hover:bg-surface-elevated-hover',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ balance }) {
  const navigate = useNavigate();
  const { clients, selectedClient, setSelectedClientId } = useClient();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: getBillingStatus,
    staleTime: 5 * 60_000,
  });

  const owed = balance > 0;
  const over = balance < 0;

  useEffect(() => {
    function handle(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border bg-surface-elevated text-txt-primary">
      <div className="flex items-center gap-2 border-b border-border px-4 py-5">
        <Clock className="h-7 w-7 text-accent" />
        <span className="text-lg font-semibold">Hours Tracker</span>
      </div>

      {clients.length > 0 && (
        <div className="relative border-b border-border p-3" ref={dropRef}>
          <button
            onClick={() => setDropOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-md bg-surface-elevated-hover px-3 py-2 text-xs font-medium text-txt-primary hover:bg-surface-elevated-hover transition-colors border border-border"
          >
            <span className="flex items-center gap-2 truncate">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate">{selectedClient?.name ?? 'Select client'}</span>
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-txt-tertiary transition-transform', dropOpen && 'rotate-180')} />
          </button>

          {dropOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-md border border-border bg-surface-elevated shadow-lg">
              {clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClientId(c.id); setDropOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-surface-elevated-hover',
                    c.id === selectedClient?.id && 'text-accent-bright font-semibold',
                  )}
                >
                  {c.name}
                  {c.isDefault && <span className="ml-auto text-[10px] text-txt-tertiary">default</span>}
                </button>
              ))}
              <div className="border-t border-border">
                <button
                  onClick={() => { navigate('/clients'); setDropOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-accent hover:bg-surface-elevated-hover"
                >
                  Manage clients &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-accent text-accent-text' : 'text-txt-secondary hover:bg-surface-elevated-hover hover:text-txt-primary',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        {billing && !billing.isPro && (
          <NavLink
            to="/billing"
            className="flex w-full items-center gap-2 rounded-md bg-accent/10 px-3 py-2 text-xs font-medium text-accent-bright hover:bg-accent/15 transition-colors"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            Upgrade to Pro
          </NavLink>
        )}

        <div
          className={cn(
            'rounded-lg px-3 py-2 text-center',
            owed && 'bg-danger-bg',
            !owed && !over && 'bg-success-bg',
            over && 'bg-warning-bg',
          )}
        >
          <div className="text-[10px] font-medium uppercase tracking-wide text-txt-tertiary">Balance</div>
          <div className={cn(
            'text-sm font-bold tabular-nums',
            owed && 'text-danger-bright',
            !owed && !over && 'text-success-bright',
            over && 'text-warning-bright',
          )}>{formatCurrency(balance)}</div>
        </div>

        <NotificationBell />

        <ThemeToggle />

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-txt-tertiary hover:bg-surface-elevated-hover hover:text-txt-primary transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}