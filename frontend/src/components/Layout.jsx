import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { getSummary, getMe } from '../lib/api';
import { Toaster } from 'sonner';
import { useClient } from '../context/ClientContext';
import { setUser } from '../lib/auth';

export function Layout() {
  const { selectedClientId } = useClient();
  const { data } = useQuery({
    queryKey: ['summary', selectedClientId],
    queryFn: () => getSummary(selectedClientId),
    staleTime: 30_000,
  });
  const balance = data?.balance ?? 0;

  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await getMe();
      setUser(user);
      return user;
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="min-h-screen bg-surface-page transition-colors">
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