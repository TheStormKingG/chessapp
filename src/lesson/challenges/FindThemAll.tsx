import { useState } from 'react';
import { Board } from '@/board';
import type { Square } from '@/rules';
import type { Highlights } from '../LessonMachine';

/** Mark every square (or every piece, named by its square) that fits — design spec 4.7. */
export function FindThemAll({
  fen,
  onSubmit,
  disabled,
  textEntry,
  highlights,
}: {
  fen: string;
  onSubmit: (squares: Square[]) => void;
  disabled?: boolean;
  textEntry?: boolean;
  highlights: Highlights;
}) {
  const [picked, setPicked] = useState<Square[]>([]);
  const toggle = (sq: Square) =>
    setPicked((p) => (p.includes(sq) ? p.filter((x) => x !== sq) : [...p, sq]));
  const merged: Highlights = { ...highlights };
  for (const sq of picked) merged[sq] = 'selected';
  return (
    <>
      <Board
        fen={fen}
        orientation="w"
        mode="select"
        onSelectSquare={toggle}
        highlights={merged}
        disabled={disabled}
        textEntry={textEntry}
        announce={
          picked.length === 0
            ? 'Nothing selected yet.'
            : `${picked.length} selected: ${picked.join(', ')}`
        }
      />
      <button
        type="button"
        className="tap mt-3 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60"
        disabled={disabled || picked.length === 0}
        onClick={() => {
          onSubmit(picked);
          setPicked([]);
        }}
      >
        Check ({picked.length})
      </button>
    </>
  );
}
