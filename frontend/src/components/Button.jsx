// Reusable button with two visual variants: "primary" (solid) and "secondary" (outline).
// Any extra props (onClick, type, disabled, etc.) are forwarded to the underlying <button>.
const VARIANT_STYLES = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-400',
  secondary:
    'border border-slate-600 text-slate-200 hover:bg-slate-800 focus-visible:ring-slate-400',
};

export default function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
