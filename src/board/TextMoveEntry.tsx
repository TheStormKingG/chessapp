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
        className="tap flex-1 rounded border border-line bg-card px-3"
        placeholder="e.g. e4 or Nf3"
        value={v}
        onChange={(e) => setV(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button type="submit" className="tap rounded bg-accent px-4 text-white">
        Move
      </button>
    </form>
  );
}
