# Reference delta: the "Master Chess" concept, measured — and what it changes

| | |
|---|---|
| **Date** | 18 September 2026 |
| **Scope** | Two supplied references, weighed against the shipped design |
| **Basis** | `DESIGN-SYSTEM.md`, `PREMIUM-DELTA.md`, `docs/design/after/` at `f61c5dd`; PRD v1.1 §1.3 principle 6, §5.3, Appendix D |
| **Evidence** | `docs/design/reference/masterchess-0{1..4}-*.png`, cropped at native resolution from the source video; colour and geometry sampled from the 3200x2400 frames, not estimated from a scaled screenshot |
| **Guidance followed** | `apple-design` (craft lens, Design improvement mode step 3 and 6) |
| **Verdict** | **Little should change.** One small consistency fix is worth doing. Everything else is rejected — most of it on product grounds, the rest on measured craft grounds — and two of the reference's better instincts are already shipped in stronger form. |

---

## 1. The two references are one artefact

The brief named two references. They are the same design by the same author.

The Dribbble page's media element resolves to
`cdn.dribbble.com/userupload/44483225/file/461433090e751251a1efd6e4e02819e2.mp4`.
The supplied local file is `461433090e751251a1efd6e4e02819e2.mp4`. Same hash-named
file, same 3200x2400 frame, same shot: *Master Chess — Mobile App Design*, by
**Lay – UX/UI and branding**, 8 comments, no sign-in required to view.

This matters before anything else is said about it, because the whole grammar of a
reference document is comparative. Any sentence of the form "both references do X"
would have been one source stated twice. There is **one** reference here, and the
existing `PREMIUM-DELTA.md` evidence base — chess.com and Duolingo, two
independently-built shipping products — is stronger than it by construction.

Two further notes on the capture, recorded so nobody re-derives them:

- Dribbble was **not** blocked and did not ask for sign-in. The page rendered, the
  title verified as the shot's own title, and no bot wall was involved.
- The `<img>` elements on that page are thumbnails of the author's *other* shots.
  Downloading the plausible `still-*.png` yielded a correctly-sized 3200x2400 PNG
  of an entirely different pink-and-blue design (dominant `#DBCDD1`, `#D48C9A`).
  It was discarded. The four captures cited here are cropped from the video itself.
- The only thing the Dribbble page adds over the video is the author's **declared
  palette**: `#FFFFFF`, `#0D1F14`, `#525045`, `#EFEFEF`, `#ABB4AA`, `#B3685C`.
  It does not match what the shot actually renders. See §2.

---

## 2. What the reference actually does, measured

Five distinct screens, shown as three-phone montages: a Home/Welcome screen with a
leaderboard and a ranked-player card; a "Level up your game" browse screen; a Book
Details screen priced at $59.99 with a Purchase button; a "Fast game with AI"
settings screen; and a splash. All measurements below are taken from the
3200x2400 frames. The phone screen is 994 px wide for a 393 pt viewport, so the
scale is **2.53 px/pt**, and every figure is converted through it.

| Property | Measured |
|---|---|
| Page ground | **`#FDFDFD`** — effectively pure white, in every screen |
| Green | **`#416C58`** (hue 152°, L 34 %, S 25 %) |
| Green coverage | **26 %** of the Home screen, **43 %** of Book Details and of Fast-game |
| Second accent | **`#F7A596`** (hue 9°, L 78 %, S 86 %) — a light salmon |
| Secondary fill | `#E1E8E7`, a cool green-grey, behind the Leaderboard segmented control |
| Display type | all-caps, **≈ 33 pt** (cap height 23.7 pt), stem/cap ratio 0.15 → **medium weight, not heavy**; second line offset right; **both lines the same colour** |
| Card radius | **20 pt** |
| Pill chips | fully rounded, **41 pt tall** |
| Tab affordance | **five separate outlined circles, ≈ 50–55 pt across, on a 55 pt pitch — there is no bar, no container and no pill** |
| Elevation | **none.** Scanning down from the hero card's bottom edge, the ground stays flat `#FDFDFD` for 30 px. Controls are a **1 pt** stroke (`≈ #537868`, 4.85:1 on the ground) with no blur halo |
| Hero imagery | cut-out 3D renders of pieces, a book and an ornate board, each with a baked soft drop shadow |
| Primary action | on Book Details, an **outlined** pill ("Purchase"). The coral is spent on a *tertiary* "Learn more" affordance |

### Contrast, computed from those values

| Pair | Ratio | Against |
|---|---|---|
| White on `#F7A596` (the active chip's label, the active tab's icon) | **1.95:1** | 4.5:1 text / 3:1 control |
| `#F7A596` on `#FDFDFD` | **1.92:1** | 4.5:1 |
| White on the declared `#B3685C` | **4.16:1** | 4.5:1 |
| `#B3685C` on `#FDFDFD` | **4.09:1** | 4.5:1 |
| White on `#416C58` | **5.98:1** | passes |
| `#416C58` on `#FDFDFD` | **5.88:1** | passes |

The green is sound. **The coral fails in every use the reference puts it to**, in
both the rendered value and the author's own declared value, and it fails on the
two elements a beginner most needs to read: which filter is selected and which tab
they are on.

---

## 3. Where the first read was wrong

The brief's first read was mostly right on structure and wrong on four specifics.
Corrections, measured:

| First read | Measured |
|---|---|
| "deep forest green used as a **large surface**" | **Right, and the strongest observation in the read.** 26–43 % coverage. `#416C58` is a mid sage-forest rather than a deep forest (L 34 %), but the surface claim holds |
| "on a warm off-white ground" | **Wrong.** The ground is `#FDFDFD` — pure white with no warmth at all. There is no warm neutral anywhere in this design. ChessApp's `#EAE5DA` ground is the warmer of the two |
| "coral/salmon second accent reserved for the active or selected state" | **Right on role, wrong on discipline.** It is the active state on chips and tabs — *and* a tertiary "Learn more" disc on Book Details, where the primary action is a plain outline. The accent does not mean "action" in this design; if anything it anti-correlates with it |
| "**heavy** display type set **two-tone**" | **Wrong on both.** Stem/cap 0.15 is a medium weight, and both lines render the same `#416C58`. What is actually there is a *quiet, wide, all-caps medium* with an offset second line — a poster device, not a two-tone one |
| "fully-rounded pill chips, outlined when inactive and filled when active" | **Right**, and confirmed at 41 pt tall — which is below the 44 pt minimum |
| "card radii around 24 to 28 px" | **Wrong by a sixth.** 20 pt |
| "photographic or 3D-rendered piece imagery as card heroes" | **Right.** They are 3D renders, and they do not survive magnification — at 4x the ornate board dissolves into mush and its position is not a legal or meaningful arrangement |
| "a **detached, pill-shaped floating tab bar** with the active tab as a filled circle" | **Wrong on the container, right on the active state.** There is no bar and no pill: five independent outlined circles sit directly on the page ground. The active one is a filled coral disc |

The last one is the most consequential correction. A floating pill bar is a
deviation from the platform that could at least be argued. **No bar at all** is not
a floating tab bar; it is the absence of one.

---

## 4. Rejected on product grounds

These are not taste calls. The PRD has already decided them, and an attractive
pattern must not be allowed to carry a product decision in with it.

| Pattern in the reference | The rule it breaks |
|---|---|
| **Book Details at $59.99 with a Purchase button** | PRD §1.3 principle 6: "Free means free — no advertising, no subscriptions, no gated features". A priced catalogue item is the single most developed screen in this reference and it has no analogue in this product |
| **"Learn more" upsell disc, and the browse screen that funnels to a priced item** | Same principle. The whole "Level up your game" screen exists to sell the book |
| **Leaderboard, on the Home screen, as the primary content block** | PRD §5.3 rules out leaderboards entirely |
| **Ranked-player card — "Daniel Johnson, Rank 14"** | Same. Ranking against named strangers is the mechanic §5.3 excludes, and it is the reference's hero |
| **"Amateur" rating under the user's name; Beginner / Intermediate / Pro tiers** | A public competence label on the home screen, for an audience PRD §3.1 defines by its fear of embarrassment |
| **Robot-arm / "intelligent neural engine" framing** | ChessApp's opponent is a named persona with a described temperament (`ChooseOpponent.tsx`), which is warmer, more honest and already built |

That is four of the reference's five screens. **The Home screen, the browse screen
and the Book Details screen are rejected in full on product grounds before any
question of craft arises.** What is left to weigh is the Fast-game settings screen
and the visual system underneath all of them.

---

## 5. Rejected on craft grounds

### 5.1 The coral third accent

Rejected, and the arithmetic is what does it rather than the taste.

ChessApp's palette assigns meaning per hue: `--accent` is action and completion,
`--signal` is review, `--danger` is destructive UI only. A third accent arrives with
no meaning to carry, which is the exact failure `color.md › Best practices` names:
"Avoid using the same color to mean different things… if you use your brand color
to indicate that a borderless button is interactive, using the same or similar
color to stylize noninteractive text is confusing." The reference demonstrates the
failure live — its coral marks a selected chip *and* a tertiary link, while its
primary action is an outline.

And the coral cannot be made accessible while staying coral. On ChessApp's
`--surface` `#EAE5DA`:

- `#F7A596` → **1.55:1**. Unusable for anything.
- the declared `#B3685C` → **3.31:1**. Clears 3:1 for a large mark or a control
  edge, fails 4.5:1 for any label.
- To carry white text at 4.5:1 it has to descend to roughly **`#8C3A28`** — 7.63:1
  white-on-fill, 6.08:1 on the ground. At that point it is a brick red sitting 9°
  from `--danger` `#9B2F2F`, and the app would have two dark reds meaning opposite
  things.

**More colour is not more premium here; it is one more thing to disambiguate.**

### 5.2 Green as a large surface

Rejected, and the reference is the evidence against it.

`DESIGN-SYSTEM.md` H-4 took green off the board so the green button could mean
"this is the action". Making green a 26–43 % surface undoes that by a different
route: once the page is green, a green button on it is invisible, and the reference
shows exactly what a designer does next — **the Purchase button becomes an outline**
(`masterchess-04-book-details-purchase.png`). The reference bought a green screen
by giving up the ability to signal the primary action with colour. That is a trade
ChessApp has already declined, deliberately, with a measured reason.

### 5.3 The floating / container-less tab bar

Rejected, and the guideline is unambiguous in the other direction.

`tab-bars.md › Best practices`: "**Include tab labels to help with navigation.** A
tab label appears beneath or beside a tab bar icon… Use single words whenever
possible," and "**Consider using SF Symbols**… Prefer filled symbols or icons for
consistency with the platform."

ChessApp already ships symbol + single-word label, with the active tab rendered as
a **filled** symbol and `aria-current="page"` — asserted at `src/app/Shell.test.tsx`
("every tab carries a vector symbol beside a text label it does not replace" and
"the active tab is the filled symbol, not a recoloured outline"). The reference's
version drops the labels entirely and carries the active state on a coral fill at
1.95:1. **The reference's idea is already present here in a stronger form.** There
is nothing to take.

The one thing the reference gets right that is worth naming: its tab targets are
50–55 pt, generous. ChessApp's `.tap` floor is 44 px and the audit sweep returns
no undersized targets, so this is agreement, not a delta.

### 5.4 Pill chips at 41 pt

Rejected twice over. They are **41 pt tall against a 44 pt minimum**
(`accessibility.md`, iOS 44x44 pt), and `999px` radius is ruled out by
`DESIGN-SYSTEM.md` §3.3 ("Radius, one system: 10 px on cards and controls, 999 px
on **no card and no control**, 0 on the board"), which exists so the board's square
corners read as deliberate. A chip is a control, so it is on the wrong side of that
clause however the clause is worded, and the rejection does not depend on the rule
being absolute. ChessApp's segmented controls in `ChooseOpponent.tsx` already do
this job at the correct radius and size.

### 5.5 3D / photographic piece renders

Rejected — but **not** on bytes, and it is worth being precise about that, because
the byte argument is the tempting one and it does not hold.

Measured: one piece render at 2x (480x720) encodes to **10.2 KB** as lossy WebP
(80.2 KB lossless). A set of six is ≈ 61 KB, which at 7 Mbps is **≈ 0.07 s** of
transfer. Against 226 KiB gzipped of a 300 KB budget that is real but not
disqualifying, and the five-second time-to-first-lesson target survives it easily.
Saying otherwise would be a fake number used to win an argument on other grounds.

The real grounds are three:

1. **Provenance.** These are the author's (or a stock vendor's) renders. PRD
   Appendix D's whole posture — "Do not mirror, do not copy assets" — is that this
   product ships its own or free-licensed material. Commissioning six equivalents
   is a real cost with no product return.
2. **They do not hold up.** At 4x the board render dissolves; its pieces are not in
   a legal or meaningful position. A product whose first lesson is "The board"
   cannot put a decorative fake position on its hero.
3. **Two piece languages.** The app already renders pieces — real, playable,
   `--piece-light` / `--piece-dark`, at 120 px on Today. Adding a second,
   photographic piece vocabulary beside the functional one teaches the learner that
   the pretty pieces are the ones you cannot touch. `DESIGN-SYSTEM.md` §4's
   whole argument is that the board *is* the identity; a photograph of a board is
   the opposite of that.

### 5.6 The offset two-line all-caps display

Rejected as a default. `display-lg` in this app is already defined as a **pair** —
a 40 px UI headline that may never appear without a `--font-index` notation line
beneath it (`PREMIUM-DELTA.md` Δ2), which is why Today reads "Today / `0 XP so
far`" in the mono index face. That pairing is chess-specific and was arrived at by
cutting a display face. An offset second line is a poster trick that would work
equally on a coffee brand, and it would compete with the notation line for the same
slot. Nothing to take.

---

## 6. Where the reference *agrees*, and what that is worth

### 6.1 Crisp edges beat blur — a third independent data point

`PREMIUM-DELTA.md` §1.2 established, by reading live styles, that chess.com's raised
CTA tops out at a **4 px** blur and that every panel behind it is flat, and that
Duolingo's key is a 4 px solid bottom border with `box-shadow: none`. It concluded:
blur radius above 4 px is banned app-wide.

This reference **agrees, and goes further**: scanning 30 px down from the hero
card's bottom edge finds the ground unchanged at `#FDFDFD` — no shadow at all — and
every control is a 1 pt stroke. Its only soft shadows are baked into the piece
images, which is imagery, not control chrome.

So the existing rule stands, now on three independent designs rather than two. **No
change**; the finding is recorded so the decision is not relitigated.

There is no evidence here that should win over the existing measurement, because
there is no disagreement to adjudicate.

### 6.2 The coordinate rail

Nothing in this reference touches it. The reference has no index system of any
kind — no ranks, no files, no move numbers, no unit numbers. It could not have one:
its board is a photograph. The rail remains the design's signature and this
document argues for no change to it, in either direction.

---

## 7. The delta

**One change. It is small, and it is not the reference's idea — it is ChessApp's own
rule, applied where the reference made its absence visible.**

### Δ-R1 — The two icon-only dismiss controls get the border the token system already promises them

**The observation.** Every icon-only control in the reference is bounded by a 1 pt
ring — back, search, message, and all five tab affordances. Looking for the
equivalent here: the lesson's dismiss control is
`src/lesson/LessonPlayer.tsx:186`, `<button type="button" className="tap"
aria-label={exitLabel}>` — a bare glyph. `PlayScreen.tsx:57` and `:112` are the
same shape ("Exit game"). They are correct on every count the tests check: 44 px
minimum via `.tap`, a real accessible name, no emoji.

But `DESIGN-SYSTEM.md` §3.1 defines `--edge-strong` as "**every control border**,
every card boundary that is the only separator", and `Button.tsx` implements that
for `primary`, `secondary` and `danger`. The three icon-only controls in the app are
the only controls that opt out of it, and they are the ones with no text to give
them bounds. This is an internal inconsistency; the reference is merely what made
it visible.

**The change.** Bound each of the three in a 10 px `--edge-strong` ring — the
control radius §3.3 gives every other control — on a square box that stays square
at every text size. No new token, and no new radius.

**Corrected after the first implementation.** This section originally said
*circular*, which put a 999 px radius in the tree and contradicted §3.3 and §5.4
above: §5.4 rejects the reference's pill chips by citing that clause, and a clause
cannot rule out a chip while a shipped control relies on an unstated exception to
it. The contradiction is resolved in favour of the rule, because the circularity
was never the argument. The argument is that §3.1 defines `--edge-strong` as
"every control border" and three controls opt out of it — which commits to the
**border**, not to a round one. §8 below already records that the round shape came
from the reference and was "a default any shot would produce". So the rule stands
unamended on the point that matters, and the ring takes the control radius, which
has the side benefit of making a dismiss read as a sibling of `Button.tsx` rather
than as the app's one round thing.

**And the box is square, which is a separate rule from the radius.** `.tap` floors
`min-height` and `min-width` independently. That is harmless for a box whose shape
carries no meaning, and wrong for a control that is nothing but a centred glyph: at
the largest system text size the glyph's line box grew the height to 54 px while the
width stayed pinned at its 44 px floor, leaving 5 px of side padding against 15 px
of vertical padding. `aspect-ratio: 1` is the tempting one-liner and it is wrong
here — measured, the ratio resolves the height *down* to the content-derived width
and the glyph then overflows its own ring. Both dimensions are instead driven by one
expression, `max(44px, 1.6em)`, so they cannot floor apart: 44x44 at a 16 px and a
24 px root, 54.4x54.4 at a 32 px root.

Sizing the box is not enough on its own, and the third dimension of the bug was
only visible in a browser. Both headers carrying this control are flex rows. At a
32 px root the lesson header's three children stop fitting in 390 px, and a flex
item at the default `0 1 auto` is squeezed: the control measured **51.8 x 54.4** —
square by its own sizing and not square as laid out — and only in the *challenge*
state, because the card state leaves the challenge counter empty and the row has
slack. `flex-shrink: 0` is therefore part of the fix, not a precaution, and the
geometry assertion covers both states for exactly that reason.

| Value | Light | Dark | Measured |
|---|---|---|---|
| `--edge-strong` on `--surface` | `#807C73` on `#EAE5DA` | `#6F7874` on `#0E1110` | **3.31:1** light, **4.17:1** dark — both clear the 3:1 control-edge requirement, already re-measured in `PREMIUM-DELTA.md` Δ1 |

**Why a ring and not a fill.** `buttons.md › Style` distinguishes prominence by
role; a dismiss is not an offer. A ring gives the control an edge without giving it
weight, and it keeps the screen's single `--key-accent` element unambiguous.

**What it must not do.** It adds no blur (the app-wide ≤ 4 px rule is unaffected —
this is a border, not a shadow), no radius change anywhere else, and **no text
change**, so no spec's accessible name or visible text moves. `aria-label`,
`role` and the DOM shape are untouched. Before it lands, re-run the 44 px sweep on
the lesson and play screens and measure the rendered ring's box rather than
assuming the `.tap` minimum survived the added border.

**Severity: Low.** It is worth doing because the token contract says so, not
because the reference is attractive.

---

## 8. Self-critique

`apple-design` step 3: **would this same delta come out of a brief about a
different product that wanted to look like a nice Dribbble shot?**

The first draft had three items and the answer was yes for all three.

1. **A `--surface-panel` full-bleed green panel**, taking the bottom half of the
   lesson-close screen, with the action anchored in it — lifted straight from Book
   Details, and justified by "half of the lesson-close screen is empty". **Cut.**
   Two reasons. It is precisely what §5.2 rejects — it would make the one
   `--key-accent` button on that screen a green fill on a green field, forcing it
   to an outline exactly as the reference was forced. And the void is not a defect:
   looking at `after/05-lesson-close--phone-390x844.png`, the content is anchored
   mid-screen with air above and the action at the bottom, and `PREMIUM-DELTA.md`
   §5's removal was specifically about stopping that screen reading as a *success
   banner*. Filling it with a coloured panel re-creates the banner the last pass
   deleted. I was about to undo a documented decision using a weaker source.

2. **Pill chips for `ChooseOpponent`'s segmented controls.** **Cut** — 41 pt, and a
   999 px radius that §3.3 rules out to protect the board's square corners. It was
   in the draft because pills look current, which is not a reason.

3. **Rings on the icon-only controls.** **Kept**, but reframed. In the draft it was
   "the reference bounds its icon buttons and it looks tidier" — which is a default
   any shot would produce. It survives only because the app's own `--edge-strong`
   definition already commits to it and three controls silently opt out. If that
   internal rule did not exist, this item would have been cut too.

**A near-miss, recorded.** I was ready to call the `★★☆` row on the lesson-close
screen redundant with the `2 stars · 1 hint · 0 misses` line directly above it, and
delete it as the "one thing to remove". Reading `LessonPlayer.tsx:433-462` first:
the row is deliberately the *third* channel of three (shape, colour, words), it is
`aria-hidden` so the count is announced once, and the comment records that the
previous version had only shape and failed at 2 of 3. It stays. A redundancy
argument made from a screenshot does not survive the source.

**And the thing to remove.** Having cut two of three items, the honest removal is
from the evidence rather than the design: **do not commit the extracted video
frames.** Only the four cited crops belong in `docs/design/reference/`; the source
`.mp4` is in Downloads, the intermediate frames are scratch, and a reference folder
that accumulates every frame of every montage stops being citable. If nothing could
be removed I would say so — but a one-item delta that started as a three-item delta
has already had its removal, twice.

---

## 9. Constraints this delta respects

| Constraint | How |
|---|---|
| Light primary, dark works | No new token. `--edge-strong` already carries both values |
| 4.5:1 body / 3:1 large, marks, control edges | The only new surface is a control edge: **3.31:1** light, **4.17:1** dark |
| 44 px touch targets | The ring is drawn inside the existing `.tap` box; the sweep is re-run after the change rather than assumed |
| Focus rings visible in both appearances | Untouched. The 5 px inset ring geometry asserted by `tests/e2e/play.spec.ts`, `tests/audit-platform/a11y.spec.ts` and `controls.spec.ts` is unchanged |
| Nothing by colour alone | The ring adds a shape channel to controls that had none; it removes nothing |
| Reduced motion | Nothing animates. No motion is introduced |
| No emoji as icons | No new glyphs |
| 390 px, no horizontal scroll | A border draws inside the control's box and adds no width |
| Largest text size survives | No type change |
| Bundle 226 KiB gz of 300 KB | **Zero bytes.** One CSS border rule. No font, no image, no dependency |
| Tests green — structure and semantics unchanged | Presentation only. No `aria-label`, `role`, accessible name or visible string changes, so **no spec needs naming**. The counts in the brief (320 unit / 116 Playwright) are taken as given and were not re-run for this document |
| The coordinate rail | Untouched, and §6.2 argues it should be |

---

## 10. Work plan

One chunk of work, plus one housekeeping chunk. They touch disjoint files and can
be taken by different agents.

### Chunk R1 — the icon-only control ring

**Files:** `src/app/theme.css` (add the bounded icon-control class beside the
existing `.tap` block, ~line 178), `src/lesson/LessonPlayer.tsx` (line 186),
`src/play/PlayScreen.tsx` (lines 57 and 112).

**Definition of done:** the three controls render a 10 px `--edge-strong` ring on a
box that measures the same in both dimensions at normal and at the largest system
text size, guarded by a rendered-geometry assertion in
`tests/audit-platform/reflow.spec.ts`;
`aria-label`, `type`, `role` and DOM shape are byte-identical; `npm run test` and the
Playwright suite are green with no spec edited; a rendered-geometry measurement of
each control's box confirms ≥ 44 px *after* the border, taken from the DOM rather
than inferred from the class; both appearances checked.

**Do not:** add a fill, a shadow, a radius token, a full radius, or a second ringed
control elsewhere "for consistency" — the scope is exactly the three controls that
have no text to bound them.

### Chunk R2 — reference hygiene

**Files:** `docs/design/reference/masterchess-0{1..4}-*.png` (the four cited crops,
added), `docs/design/REFERENCE-DELTA.md` (this file).

**Definition of done:** the four crops and this document are committed; no video
frames, no source `.mp4`, and no mis-downloaded assets are in the tree.

### Not a chunk, deliberately

No token is added. No palette entry changes. The tab bar, the type scale, the
radius system, the elevation rules, the board and the coordinate rail are all
unchanged, and §§4–6 give the reason for each.

---

## 11. One-line answer

A commerce-and-leaderboard concept whose product model this PRD has already ruled
out, whose second accent fails contrast in both its published values, and whose two
transferable instincts — crisp edges over blur, and a filled active tab — are
already shipped here in stronger form. The one thing it earned was pointing at
three of our own controls that never got the border our own token system promised
them.
