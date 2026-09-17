import { useState } from 'react';

export function TextMoveEntry({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const t = v.trim();
        if (t) {
          onSubmit(t);
          setV('');
        }
      }}
    >
      <input
        aria-label="Type a move"
        className="tap flex-1 rounded border border-edge-strong bg-surface-raised px-3 text-content accent-accent placeholder:text-content-dim focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
        placeholder="e.g. e4 or Nf3"
        value={v}
        onChange={(e) => setV(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button type="submit" className="tap rounded bg-accent px-4 text-accent-on">
        Move
      </button>
    </form>
  );
}
