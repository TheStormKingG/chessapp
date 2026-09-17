import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Square } from '@/rules';

const FILES = 'abcdefgh';

export function squareAt(file: number, rank: number): Square {
  return `${FILES[file]}${rank + 1}` as Square;
}

/** The player's near-left corner for the given orientation. */
function homeSquare(orientation: 'w' | 'b'): Square {
  return orientation === 'w' ? 'a1' : 'h8';
}

/**
 * Keyboard cursor for the board. The cursor starts on the player's
 * bottom-left square (a1 for White, h8 for Black); arrows move it in the
 * direction the player sees, Enter/Space activate the square under it.
 */
export function useBoardA11y(orientation: 'w' | 'b', onActivate: (sq: Square) => void) {
  const [cursor, setCursor] = useState<Square>(homeSquare(orientation));
  // M-1: flipping the board moves the player's near corner, so the cursor
  // restarts there rather than staying on a now-far square. Adjusted during
  // render (the React-recommended alternative to a setState-in-effect).
  const [prevOrientation, setPrevOrientation] = useState(orientation);
  if (prevOrientation !== orientation) {
    setPrevOrientation(orientation);
    setCursor(homeSquare(orientation));
  }
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const f = FILES.indexOf(cursor[0]!);
      const r = Number(cursor[1]) - 1;
      const dir = orientation === 'w' ? 1 : -1;
      let nf = f;
      let nr = r;
      switch (e.key) {
        case 'ArrowUp': nr = r + dir; break;
        case 'ArrowDown': nr = r - dir; break;
        case 'ArrowRight': nf = f + dir; break;
        case 'ArrowLeft': nf = f - dir; break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onActivate(cursor);
          return;
        default:
          return;
      }
      e.preventDefault();
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) return;
      setCursor(squareAt(nf, nr));
    },
    [cursor, orientation, onActivate],
  );
  return { cursor, onKeyDown };
}
