import { LABEL_GLYPH, TONE } from './labelStyle';
import type { MoveLabel } from './types';

/**
 * A move label, in three channels: the word, a distinct glyph and a tone.
 * Hue is never the only one — PRD §8.15, design spec §5.4.
 */
export function LabelChip({ label }: { label: MoveLabel }) {
  return (
    <span className={`t-label inline-flex items-center gap-1 ${TONE[label]}`}>
      <span aria-hidden="true">{LABEL_GLYPH[label]}</span>
      <span>{label}</span>
    </span>
  );
}
