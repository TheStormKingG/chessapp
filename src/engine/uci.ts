export type Score = { cp: number } | { mate: number };
export interface InfoLine { depth: number; multipv: number; score: Score; pv: string[] }

export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info ')) return null;
  const t = line.split(' ');
  const pvIdx = t.indexOf('pv');
  if (pvIdx < 0) return null;
  const num = (k: string, d: number) => { const i = t.indexOf(k); return i >= 0 ? Number(t[i + 1]) : d; };
  const si = t.indexOf('score');
  if (si < 0) return null;
  const score: Score = t[si + 1] === 'mate' ? { mate: Number(t[si + 2]) } : { cp: Number(t[si + 2]) };
  return { depth: num('depth', 0), multipv: num('multipv', 1), score, pv: t.slice(pvIdx + 1) };
}

export function parseBestMove(line: string): string | null {
  if (!line.startsWith('bestmove ')) return null;
  const mv = line.split(' ')[1];
  return mv && mv !== '(none)' ? mv : null;
}
