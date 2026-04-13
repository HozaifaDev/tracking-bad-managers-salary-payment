import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Sessions } from './pages/Sessions';
import { Payments } from './pages/Payments';
import { Monthly } from './pages/Monthly';
import { Sync } from './pages/Sync';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="payments" element={<Payments />} />
        <Route path="monthly" element={<Monthly />} />
        <Route path="sync" element={<Sync />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
