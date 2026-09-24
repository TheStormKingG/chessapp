import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

/**
 * The sheen's contrast floor, asserted rather than commented.
 *
 * `controls.spec.ts` measures a control's label against its composited
 * `background-color`. The sheen is painted as `background-image`, so that sweep
 * CANNOT SEE IT: it measures the flat accent at 7.41:1 and passes no matter how
 * light the gradient's top stop becomes. The audit that looks like it covers
 * this is the one instrument guaranteed not to.
 *
 * So the number lives here. At the top of the gradient the face is the sheen's
 * white composited over the accent, and that is the darkest-text-on-lightest-
 * face case on the button -- the place the 4.5:1 rule actually binds.
 */
const css = readFileSync(resolve(process.cwd(), 'src/app/theme.css'), 'utf8');

function token(name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`token ${name} not found in theme.css`);
  return m[1]!.trim();
}

const hex = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c: number[]): number => {
  const f = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * f[0]! + 0.7152 * f[1]! + 0.0722 * f[2]!;
};
const ratio = (a: number[], b: number[]): number => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const over = (fg: number[], alpha: number, bg: number[]): number[] =>
  bg.map((v, i) => Math.round(fg[i]! * alpha + v * (1 - alpha)));

/** The leading `rgba(255,255,255,A)` stop of a sheen token. */
function topStopAlpha(tokenValue: string): number {
  const m = /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/.exec(tokenValue);
  if (!m) throw new Error(`no rgba stop parsed from: ${tokenValue}`);
  return Number(m[1]);
}

test('white text still clears 4.5:1 at the lit top of the primary action', () => {
  const alpha = topStopAlpha(token('--sheen-accent'));
  // The parse is the instrument here, so it gets its own check: a regex that
  // silently matched nothing would report alpha 0 and pass this test forever
  // while the sheen was set to anything at all.
  expect(alpha, 'sheen alpha parsed as zero — the token or the regex moved').toBeGreaterThan(0);

  const litFace = over([255, 255, 255], alpha, hex('#12614a'));
  const contrast = ratio(hex('#ffffff'), litFace);
  expect(contrast, `white on the lit face is ${contrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);

  // And a real margin, not a pass by a hundredth. At alpha 0.20 this is 4.58:1
  // — clearing the rule by 0.08, which is one adjustment from breaking and is
  // why 0.14 was chosen over it.
  expect(contrast).toBeGreaterThanOrEqual(5);
});

test('the flat accent underneath is unchanged, so nothing depends on the sheen', () => {
  // The sheen is decoration over a face that already passes. If the gradient
  // were ever dropped, the button must still be correct.
  expect(ratio(hex('#ffffff'), hex('#12614a'))).toBeGreaterThanOrEqual(4.5);
});

test('the light and sunken sheens point in opposite directions', () => {
  // The whole effect is one light source. A raised surface brightest at its top
  // and a recess shaded at its top are the same claim; if they ever agreed in
  // sign, one of them would be lit from underneath.
  expect(token('--sheen')).toContain('rgba(255, 255, 255');
  expect(token('--sheen-sunken')).toMatch(/rgba\(1\d\d,/);
  for (const t of ['--sheen', '--sheen-accent', '--sheen-sunken']) {
    expect(token(t), `${t} is not a top-down gradient`).toContain('180deg');
  }
});
