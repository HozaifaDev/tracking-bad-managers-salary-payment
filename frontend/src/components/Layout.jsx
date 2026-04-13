import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { getSummary } from '../lib/api';
import { Toaster } from 'sonner';

export function Layout() {
  const { data } = useQuery({ queryKey: ['summary'], queryFn: getSummary, staleTime: 30_000 });
  const balance = data?.balance ?? 0;

  return (
    <div className="min-h-screen">
      <Sidebar balance={balance} />
      <main className="pl-56">
        <div className="mx-auto max-w-7xl p-6">
          <Outlet />
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
