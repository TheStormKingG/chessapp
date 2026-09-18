import { btn } from '@/app/Button';
import { useState } from 'react';

/*
 * Chunk N4. The field takes the system control radius (`--radius-control`, 12px)
 * instead of the raw 4px `rounded` it carried, and the soft inset pair instead
 * of nothing: NEUMORPHIC-DELTA.md §3.3 makes a control's boundary its border,
 * and the depth grammar the app now speaks says a thing you type INTO is a
 * groove, not a raise. The border stays `--edge-strong` at 3.76:1 on the ground
 * and 4.47:1 on the panel it sits on; the shadow is decorative and is never the
 * only thing bounding it. The submit button beside it is the screen's one
 * `primary`, so the pair still reads as field-plus-action.
 */

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
        className="tap t-index n-inset-soft flex-1 rounded-control border border-edge-strong bg-surface-raised px-3 text-content accent-accent placeholder:text-content-dim focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
        placeholder="e.g. e4 or Nf3"
        value={v}
        onChange={(e) => setV(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button type="submit" className={btn.primary}>
        Move
      </button>
    </form>
  );
}
