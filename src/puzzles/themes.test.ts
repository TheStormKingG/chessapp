import { describe, expect, test } from 'vitest';
import { THEMES, THEME_LABEL, THEME_DEFINITION } from './themes';
import type { Theme } from './types';

describe('themes', () => {
  test('every theme has a label and a definition', () => {
    for (const t of THEMES) {
      expect(THEME_LABEL[t], `label for ${t}`).toMatch(/\S/);
      expect(THEME_DEFINITION[t], `definition for ${t}`).toMatch(/\S/);
    }
  });

  test('definitions are one sentence of plain English, not a tag', () => {
    for (const t of THEMES) {
      const d = THEME_DEFINITION[t];
      // A sentence: starts with a capital, ends with a full stop, has spaces.
      expect(d, t).toMatch(/^[A-Z].*\.$/);
      expect(d.split(' ').length, `${t} is too short to be a sentence`).toBeGreaterThan(4);
      // One sentence, not three.
      expect(d.match(/\./g)?.length, `${t} has more than one sentence`).toBe(1);
    }
  });

  test('THEMES covers exactly the Theme union, so a new theme cannot be forgotten', () => {
    // If a Theme is added to types.ts and not here, this fails to compile.
    const all: Record<Theme, true> = {
      backRankMate: true, mateIn1: true, smotheredMate: true, mateIn2: true,
      attackingF2F7: true, skewer: true, fork: true, discoveredAttack: true,
    };
    expect([...THEMES].sort()).toEqual(Object.keys(all).sort());
  });
});
