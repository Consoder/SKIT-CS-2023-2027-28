import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

// App pages are code-split so the landing page doesn't download Chart.js.
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Audit = lazy(() => import('./pages/Audit'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const History = lazy(() => import('./pages/History'));
const Reports = lazy(() => import('./pages/Reports'));
const Results = lazy(() => import('./pages/Results'));
const Scan = lazy(() => import('./pages/Scan'));
const Settings = lazy(() => import('./pages/Settings'));
const ThreatIntel = lazy(() => import('./pages/ThreatIntel'));

function PageFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500" role="status">
      Loading…
    </div>
  );
}

const page = (Component) => (
  <Suspense fallback={<PageFallback />}>
    <Component />
  </Suspense>
);

// Route table. "/" is the public landing page; everything else lives in the
// sidebar app shell.
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={page(Dashboard)} />
        <Route path="/scan" element={page(Scan)} />
        <Route path="/results" element={page(Results)} />
        <Route path="/results/:id" element={page(Results)} />
        <Route path="/history" element={page(History)} />
        <Route path="/reports" element={page(Reports)} />
        <Route path="/intel" element={page(ThreatIntel)} />
        <Route path="/audit" element={page(Audit)} />
        <Route path="/api" element={page(ApiDocs)} />
        <Route path="/settings" element={page(Settings)} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
