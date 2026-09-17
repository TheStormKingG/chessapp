import { coachName } from './CoachService';

export function CoachBubble({ text, tone = 'neutral' }: { text: string | null; tone?: 'neutral' | 'good' | 'bad' }) {
  if (!text) return null;
  const ring = tone === 'good' ? 'border-accent' : tone === 'bad' ? 'border-danger' : 'border-line';
  return (
    <div className={`mt-3 flex gap-3 rounded-xl border ${ring} bg-card p-3`} role="note" aria-label={`${coachName} says`}>
      <div aria-hidden className="h-8 w-8 shrink-0 rounded-full bg-accent-soft" />
      <p className="text-sm leading-snug">{text}</p>
    </div>
  );
}
