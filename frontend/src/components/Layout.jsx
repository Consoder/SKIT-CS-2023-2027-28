import { ExternalLink, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { BRAND } from '../config/brand';
import { ButtonLink } from './Button';
import Logo from './layout/Logo';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#verdicts', label: 'Verdicts' },
  { href: '#compare', label: 'Why Us' },
  { href: '#faq', label: 'FAQ' },
];

// Public marketing layout (landing page): sticky navbar + footer.
export default function Layout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6" aria-label="Main">
          <Logo />
          <div className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink to="/dashboard" variant="secondary" className="hidden whitespace-nowrap sm:inline-flex">
              Open Dashboard
            </ButtonLink>
            <button
              type="button"
              className="rounded-md p-2 text-slate-300 hover:bg-slate-800 lg:hidden"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
        {open && (
          <div id="mobile-nav" className="border-t border-slate-800 px-4 py-3 lg:hidden">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="block rounded px-2 py-2 text-sm text-slate-300 hover:bg-slate-800">
                {link.label}
              </a>
            ))}
            <ButtonLink to="/dashboard" variant="secondary" className="mt-2 w-full sm:hidden">
              Open Dashboard
            </ButtonLink>
          </div>
        )}
      </header>

      <main id="main">{children}</main>

      <footer className="border-t border-slate-800 px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 text-sm text-slate-400 md:grid-cols-3">
          <div>
            <Logo subtitle={false} />
            <p className="mt-3 max-w-xs text-slate-500">
              {BRAND.projectTitle}. Final-year project, {BRAND.department}, SKIT Jaipur.
            </p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-slate-200">Team</p>
            <ul className="space-y-1">
              {BRAND.team.map((member) => (
                <li key={member.name}>
                  {member.name} <span className="text-slate-500">— {member.role}</span>
                </li>
              ))}
              <li className="pt-1 text-slate-500">Mentor: {BRAND.mentor}</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-semibold text-slate-200">Project</p>
            <p className="text-slate-500">Project ID {BRAND.projectId}</p>
            <p className="text-slate-500">SDG 9 — Industry, Innovation &amp; Infrastructure</p>
            <a href={BRAND.repoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-slate-300 hover:text-white">
              Source on GitHub <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-7xl border-t border-slate-800 pt-6 text-xs text-slate-600">
          &copy; {new Date().getFullYear()} {BRAND.name}. Academic prototype — verdicts are decision support, not a guarantee.
        </p>
      </footer>
    </div>
  );
}
