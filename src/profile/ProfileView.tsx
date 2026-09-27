import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { btn } from '@/app/Button';
import { useProgress } from '@/data';
import { plural } from '@/app/plural';
import { measureText, imageAltText, profileFile, profileFileName, profileFileText, profileImageName, profileImageSvg } from './exportProfile';
import { jsonDownloadHref, svgDownloadHref } from './download';
import { profileSignature, useProfileSeen } from './seen';
import { LATER_ON_THE_PATH, bandVerdict, reachedUnit } from '@/tailored/band';
import type { Measure, Profile, SkillBreakdown, Weakness } from './types';

/**
 * The strengths-and-weaknesses profile (PRD §8.14, F-SW-1 … F-SW-8).
 *
 * ── THE HOUSE IDIOM, NOT A NEW ONE ───────────────────────────────────────────
 *
 * `n-panel n-lit n-edge rounded-card bg-panel` for a raised card, the `t-*` type
 * ladder, and the same rule the Progress screen's own header comment states and
 * PathScreen and Today already follow: **every number is stated in text.** There
 * are no bars on this screen at all, which is a stronger version of the same rule
 * — a bar would need a scale, and half the measures here are per-game rates whose
 * scale nobody has defined (see types.ts on `Measure`). A sentence needs no scale.
 *
 * ── ACCESSIBILITY, AS A REQUIREMENT AND NOT A PASS ───────────────────────────
 *
 * - **Nothing is carried by colour.** The weaknesses are numbered `1`, `2`, `3` in
 *   the index face, and the strengths and weaknesses sit under headings that say in
 *   words which is which. No red, no green, no arrows.
 * - **Every control has a name.** Each skill's disclosure button names the skill and
 *   its headline number, so a screen reader hears "Board vision, 0.45 a game,
 *   collapsed" rather than "button". The two downloads are `<a download>` elements
 *   with the file they produce named in the link text.
 * - **One live region, and it says one thing.** `role="status"` on the sample-size
 *   line, which is the only thing that changes without the learner acting: the
 *   profile arrives after a Dexie read, and its arrival is announced as the sample
 *   size because that is the fact everything else on the screen depends on.
 *   Expanding a skill is NOT announced there — it is the learner's own action, the
 *   disclosure state is on the button via `aria-expanded`, and a second announcement
 *   would talk over the content they just opened.
 *
 * ── AND THE THING THAT IS NOT HERE ───────────────────────────────────────────
 *
 * Comparisons with other players. F-SW-5 asks for one beside every number; no
 * rating-bucketed statistics exist (bandStats.ts records exactly what would have to
 * be mined), so the screen says so once, in words, and prints no comparison at all.
 * An absent comparison reads as absent; the note is what stops it reading as
 * "average".
 */

function MeasureValue({ measure }: { measure: Measure }) {
  if (measure.kind === 'absent') {
    return <span className="t-caption text-content-dim">{measure.reason}</span>;
  }
  return <span className="t-index text-content">{measureText(measure)}</span>;
}

function SkillCard({ skill }: { skill: SkillBreakdown }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-b border-edge last:border-b-0">
      <button
        type="button"
        // The accessible name is the skill AND its number, so the collapsed list
        // reads as six measurements rather than six words.
        aria-label={`${skill.title}, ${measureText(skill.headline)}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="tap flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left"
      >
        <span className="t-heading">{skill.title}</span>
        <span className="flex items-baseline gap-2">
          <MeasureValue measure={skill.headline} />
          {/* Decoration over a state the button already announces via
              aria-expanded, so it is hidden rather than described. */}
          <span aria-hidden="true" className="t-index text-content-dim">
            {open ? '−' : '+'}
          </span>
        </span>
      </button>
      <div id={panelId} hidden={!open} className="px-4 pb-4">
        <dl>
          {skill.rows.map((row) => (
            <div key={row.label} className="mt-3 first:mt-0">
              <dt className="t-body">{row.label}</dt>
              <dd className="mt-0.5">
                <MeasureValue measure={row.measure} />
                {row.comparison !== null && (
                  <span className="t-caption mt-0.5 block text-content-dim">{row.comparison}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {skill.notMeasured.length > 0 && (
          <div className="mt-4">
            <h4 className="t-caption uppercase tracking-wide text-content-dim">Not measured</h4>
            <ul className="mt-1 list-none">
              {skill.notMeasured.map((note) => (
                <li key={note} className="t-caption mt-1 text-content-dim">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * F-TS-2's two additions to a weakness card.
 *
 * > "A weakness above the learner's band (a Section 4 idea for a Section 2 learner)
 * > is shown in the profile with 'later on the path' and is not drilled yet."
 *
 * and F-TS-1's on-demand entry: "on demand from the profile screen with 'Train on
 * this'". The band rule lives in src/tailored/band.ts and is the same function the
 * session builder calls, so the card and the session cannot disagree about whether a
 * weakness is drillable.
 */
function WeaknessCard({ weakness, rank, reached }: { weakness: Weakness; rank: number; reached: string | null }) {
  const verdict = bandVerdict(weakness, reached);
  return (
    <li className="border-b border-edge px-4 py-3 last:border-b-0">
      <div className="flex items-baseline gap-3">
        {/* The rank is the ordering signal, in the index face — never a colour. */}
        <span className="t-index text-content-dim">{rank}</span>
        <div className="min-w-0">
          <p className="t-heading">{weakness.name}</p>
          <p className="t-index mt-0.5 text-content-dim">
            {plural(weakness.occurrences, 'time')} in {plural(weakness.games, 'game')}
          </p>
          {weakness.typicalForLevel.known && (
            <p className="t-caption mt-1 text-content-dim">{weakness.typicalForLevel.wording}</p>
          )}
          {!verdict.drill && verdict.reason === 'later-on-the-path' && (
            <p className="t-caption mt-1 text-content-dim">
              Section {verdict.section}: {LATER_ON_THE_PATH}. Not drilled yet.
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {verdict.drill && (
              <Link className={btn.quiet} to={`/tailored?theme=${encodeURIComponent(weakness.theme)}`}>
                Train on this
              </Link>
            )}
            {weakness.lessonId !== null && (
              <Link className={btn.quiet} to={`/lesson/${weakness.lessonId}`}>
                Lesson: {weakness.lessonTitle}
              </Link>
            )}
            {weakness.drill !== null && (
              <Link className={btn.quiet} to={weakness.drill.to}>
                Drill: {weakness.drill.name}
              </Link>
            )}
          </p>
        </div>
      </div>
    </li>
  );
}

/** F-SW-6's sentence, plus the reason there are no comparisons. */
function basisSentence(profile: Profile): string {
  const games = `Built on ${plural(profile.games, 'analysed game')}.`;
  if (profile.comparisons.shown) {
    return profile.comparisons.label === 'early'
      ? `${games} Comparisons with your level are shown but are early — they rest on few games.`
      : games;
  }
  if (profile.comparisons.reason === 'too-few-games') {
    return `${games} Counts only: comparisons with other players at your level start at ten games.`;
  }
  return `${games} Counts only: this app ships no statistics for other players at your level, so nothing here is compared with anyone. A missing comparison means not measured, never average.`;
}

export function ProfileView({ profile, undateable }: { profile: Profile; undateable: number }) {
  const markSeen = useProfileSeen((s) => s.markSeen);
  const reviews = useProgress((s) => s.progress.reviews);
  // F-TS-2's band, read from the same projection the path reads. No new store.
  const progress = useProgress((s) => s.progress);
  const reached = reachedUnit(progress);
  const signature = profileSignature(profile);

  // F-SW-1: Today offers the profile "when it has changed". Opening it is what
  // makes it seen, so the offer goes away once the learner has been here.
  //
  // The reviewed-game count is recorded alongside the signature because Today
  // compares against THAT — it must not build a profile of its own on the launch
  // screen. See seen.ts.
  useEffect(() => {
    markSeen(signature, reviews);
  }, [markSeen, signature, reviews]);

  const now = new Date().toISOString();
  const fileText = profileFileText(profileFile(profile, { rating: null, now }));
  const svg = profileImageSvg(profile);

  return (
    <section aria-labelledby="sw-title">
      <h2 id="sw-title" className="t-display">
        Your chess
      </h2>
      {/*
        The one live region on the screen. The profile arrives after a Dexie read,
        so this sentence is what changes on its own, and it is the fact every other
        number depends on. `aria-live="polite"` with `role="status"` — announced
        after whatever the learner is doing, never interrupting it.
      */}
      <p role="status" aria-live="polite" className="t-index mt-1 text-content-dim">
        {basisSentence(profile)}
      </p>

      {undateable > 0 && (
        <p className="t-caption mt-1 text-content-dim">
          {plural(undateable, 'reviewed game')} could not be dated and {undateable === 1 ? 'is' : 'are'} left out.
        </p>
      )}

      {profile.games === 0 ? (
        <p className="t-body n-panel n-lit n-edge mt-4 rounded-card bg-panel p-4">
          No analysed games yet. Play a game and review it, or{' '}
          <Link to="/import" className="underline">
            import your games
          </Link>{' '}
          from chess.com or Lichess.
        </p>
      ) : null}

      {/* ── F-SW-2: strengths first ─────────────────────────────────────── */}
      {profile.strengths.length > 0 && (
        <>
          <h3 className="t-caption mt-6 uppercase tracking-wide text-content-dim">What you do well</h3>
          <ul className="n-panel n-lit n-edge mt-2 list-none rounded-card bg-panel">
            {profile.strengths.map((s) => (
              <li key={s.id} className="t-body border-b border-edge px-4 py-3 last:border-b-0">
                {s.text}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ── F-SW-3: weaknesses, ranked by cost ──────────────────────────── */}
      {profile.weaknesses.length > 0 && (
        <>
          <h3 className="t-caption mt-6 uppercase tracking-wide text-content-dim">What to work on</h3>
          <p className="t-caption mt-1 text-content-dim">
            Ranked by how often each one happens and how much of a game it costs you, counting your
            recent games for more.
          </p>
          <ol className="n-panel n-lit n-edge mt-2 list-none rounded-card bg-panel">
            {profile.weaknesses.map((w, i) => (
              <WeaknessCard key={w.theme} weakness={w} rank={i + 1} reached={reached} />
            ))}
          </ol>
        </>
      )}

      {/* ── F-SW-1 and F-SW-4: the six skills, each with its detail ─────── */}
      <h3 className="t-caption mt-6 uppercase tracking-wide text-content-dim">The six skills</h3>
      <div className="n-panel n-lit n-edge mt-2 rounded-card bg-panel">
        {profile.skills.map((s) => (
          <SkillCard key={s.id} skill={s} />
        ))}
      </div>

      {/* ── F-SW-7: what changed ────────────────────────────────────────── */}
      <h3 className="t-caption mt-6 uppercase tracking-wide text-content-dim">What changed</h3>
      <div className="n-panel n-lit n-edge mt-2 rounded-card bg-panel p-4">
        {profile.changed.sentences.map((s) => (
          <p key={s} className="t-body mt-2 first:mt-0">
            {s}
          </p>
        ))}
      </div>

      {/* ── F-SW-8: share and export ────────────────────────────────────── */}
      <h3 className="t-caption mt-6 uppercase tracking-wide text-content-dim">Share and export</h3>
      <div className="n-panel n-lit n-edge mt-2 rounded-card bg-panel p-4">
        <p className="t-caption text-content-dim">
          The image leaves your rating out. The data file is for a coach and has everything in it.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <a className={btn.secondary} href={svgDownloadHref(svg)} download={profileImageName(now)}>
            Download image
          </a>
          <a className={btn.secondary} href={jsonDownloadHref(fileText)} download={profileFileName(now)}>
            Download data
          </a>
        </p>
        {/* The card itself, so the learner sees what they are about to share
            before they share it. `alt` is the same text the SVG's own <desc>
            carries, produced by one function so the two cannot drift. */}
        <img
          className="mt-4 w-full rounded-card border border-edge"
          src={svgDownloadHref(svg)}
          alt={imageAltText(profile)}
        />
      </div>
    </section>
  );
}
