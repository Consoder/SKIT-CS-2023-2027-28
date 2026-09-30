import {
  Code2,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  Link2,
  Menu,
  Plus,
  Radar,
  Radio,
  ScanSearch,
  Settings,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStoreContext';
import { ButtonLink } from '../Button';
import Logo from './Logo';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scan', label: 'Scan URL', icon: ScanSearch },
  { to: '/history', label: 'History', icon: History },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/intel', label: 'Threat Intel', icon: Radar },
  { to: '/audit', label: 'Blockchain Audit', icon: Link2 },
];

const NAV_SECONDARY = [
  { to: '/api', label: 'API Access', icon: Code2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          isActive ? 'bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-400/30' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {item.label}
    </NavLink>
  );
}

function Sidebar({ onNavigate }) {
  const { scans } = useAppStore();
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="px-2">
        <Logo subtitle={false} />
      </div>
      <nav className="flex flex-col gap-1" aria-label="App">
        {NAV.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      <nav className="flex flex-col gap-1 border-t border-slate-800 pt-4" aria-label="Developer">
        {NAV_SECONDARY.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
        <p className="font-semibold text-slate-200">{scans.length.toLocaleString()} scans stored</p>
        <p className="mt-1">History and the audit chain are kept in this browser until the backend database ships.</p>
      </div>
    </div>
  );
}

function ModePill() {
  const { settings } = useAppStore();
  const live = settings.mode === 'live';
  return (
    <Link
      to="/settings"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        live ? 'border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20' : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
      }`}
      title={live ? `Using the FastAPI backend at ${settings.apiBaseUrl}` : 'Using the in-browser demo engine — change in Settings'}
    >
      {live ? <Radio className="h-3.5 w-3.5" aria-hidden="true" /> : <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />}
      {live ? 'Live API' : 'Demo mode'}
    </Link>
  );
}

// Authenticated-product shell: sidebar navigation (drawer on mobile) + top bar.
export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Start each page at the top (the drawer closes itself via onNavigate).
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => event.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-slate-950">
      <a href="#app-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-800 bg-slate-950 lg:block">
        <Sidebar />
      </aside>

      {drawerOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-950">
            <button type="button" className="absolute right-2 top-4 rounded p-2 text-slate-400 hover:text-white" onClick={() => setDrawerOpen(false)} aria-label="Close navigation">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-800 bg-slate-950/85 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-slate-300 hover:bg-slate-800 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <Logo subtitle={false} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModePill />
            <ButtonLink to="/scan" size="sm" className="hidden sm:inline-flex">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New scan
            </ButtonLink>
          </div>
        </header>
        <main id="app-main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
