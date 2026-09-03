// Styled text input with an optional label and an optional leading icon
// (pass a lucide-react component, e.g. `icon={Globe}`). `id` connects the
// label to the input for accessibility, so pass one whenever `label` is used.
export default function Input({ label, id, icon: Icon, type = 'text', className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        )}
        <input
          id={id}
          type={type}
          className={`w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${Icon ? 'pl-11 pr-4' : 'px-4'} ${className}`}
          {...props}
        />
      </div>
    </div>
  );
}
