// Styled text input with an optional label and an optional leading icon
// (pass a lucide-react component, e.g. `icon={Globe}`). `id` connects the
// label to the input for accessibility, so pass one whenever `label` is used.
// Pass `error` (a message string) to switch the border red and show the
// message below the input; `aria-invalid` / `aria-describedby` are set
// automatically.
export default function Input({
  label,
  id,
  icon: Icon,
  type = 'text',
  className = '',
  error,
  trailing,
  ...props
}) {
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        )}
        <input
          id={id}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-lg border bg-slate-950/70 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/30'
              : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/30'
          } ${Icon ? 'pl-11' : 'pl-4'} ${trailing ? 'pr-24' : 'pr-4'} ${className}`}
          {...props}
        />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
