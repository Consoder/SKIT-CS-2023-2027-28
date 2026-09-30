// Reusable container with padding, border, and shadow. Pass `title` (and
// optionally `icon`, `action`) for a standard card header.
export default function Card({ children, className = '', title, icon: Icon, action, padded = true }) {
  return (
    <section
      className={`rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-black/20 ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {title && (
        <header className={`mb-4 flex items-center justify-between gap-3 ${padded ? '' : 'px-5 pt-5 sm:px-6'}`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            {Icon && <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
