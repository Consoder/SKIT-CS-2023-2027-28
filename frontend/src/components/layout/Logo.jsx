import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';

export default function Logo({ to = '/', subtitle = true }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400/20 to-indigo-500/20 ring-1 ring-teal-400/30">
        <ShieldCheck className="h-5 w-5 text-teal-300" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap text-base font-bold text-white">{BRAND.name}</span>
        {subtitle && <span className="hidden text-[11px] text-slate-400 sm:block">{BRAND.tagline}</span>}
      </span>
    </Link>
  );
}
