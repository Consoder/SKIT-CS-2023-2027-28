// Reusable container with padding, border, and shadow.
// Compose it with any content (feature blurbs, stats, form sections, etc.).
export default function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}
