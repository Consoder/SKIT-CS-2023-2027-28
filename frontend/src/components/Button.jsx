import { Link } from 'react-router-dom';

// Reusable button. Variants: primary (solid), secondary (outline), ghost,
// danger. Sizes: sm, md. Extra props (onClick, type, disabled, ...) are
// forwarded to the underlying <button>. Use <ButtonLink> for navigation.
const VARIANT_STYLES = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-400',
  secondary: 'border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 focus-visible:ring-slate-400',
  ghost: 'text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:ring-slate-400',
  danger: 'border border-red-500/40 text-red-300 hover:bg-red-500/10 focus-visible:ring-red-400',
};

const SIZE_STYLES = {
  sm: 'gap-1.5 rounded-md px-3 py-1.5 text-xs',
  md: 'gap-2 rounded-lg px-5 py-2.5 text-sm',
};

function classes(variant, size, className) {
  // A caller passing `hidden sm:inline-flex` owns the display value; adding
  // our own `inline-flex` would override `hidden` and show it on mobile.
  const display = /(^|\s)hidden(\s|$)/.test(className) ? '' : 'inline-flex';
  return `${display} items-center justify-center font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button type={type} className={classes(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({ children, to, variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <Link to={to} className={classes(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
