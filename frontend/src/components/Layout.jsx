import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from './Button';

// Nav items beyond Home don't have routes yet (later weeks' pages), so they
// stay as plain anchors for now instead of react-router <Link>s.
const NAV_LINKS = ['Features', 'How It Works', 'About', 'Contact'];

// Page wrapper: sticky navbar + main content area. Every page renders inside this.
export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-teal-400" />
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-bold text-white">URLShield AI</span>
              <span className="text-xs text-slate-400">
                Real-Time URL Attack Detection Platform
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link to="/" className="text-sm font-medium text-teal-400">
              Home
            </Link>
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
              >
                {link}
              </a>
            ))}
          </div>

          <Button variant="secondary">Login</Button>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
