/** A single-choice list, used by name_the_pattern and both steps of is_it_safe. */
export function Options({
  options,
  onPick,
  disabled,
  label,
}: {
  options: readonly string[];
  onPick: (i: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="mt-3 grid gap-2" role="group" aria-label={label ?? 'Answer options'}>
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          disabled={disabled}
          onClick={() => onPick(i)}
          className="tap rounded-lg border border-line bg-card px-4 py-3 text-left hover:border-accent disabled:opacity-60"
        >
          {o}
        </button>
      ))}
    </div>
  );
}
