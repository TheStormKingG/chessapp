# Neumorphic delta: a light system grounded in preqal.org

Fourth pass. It reverses part of the third, commits the product to one appearance,
and answers the desktop void that the previous two passes measured and deferred.

Everything numeric in this document was computed with the WCAG 2.1 formula from
the hex values it names, or read back from `getComputedStyle` in a real browser.
Nothing is estimated from a screenshot.

---

## 1. What the owner asked for

They sent a screenshot of the deployed app and said "still not pretty". Two
separate problems are visible in it and both are real.

1. **They are seeing the dark appearance.** Their browser is in dark mode, the
   app followed `prefers-color-scheme`, and they have asked for a light theme
   twice. §4 makes light the product's design rather than one of two.
2. **The desktop layout is mostly void.** §7 measures it and fixes it.

They also supplied the reference — preqal.org — and a preference for its
neumorphic look. §2 records what that preference costs.

---

## 2. The reversal, recorded honestly

`PREMIUM-DELTA.md` §1.2 and §2.1 established, from live measurement of two
reference products, that **depth comes from crisp edges rather than blur**:

- chess.com's hero CTA carries six shadow layers and the largest blur radius in
  any of them is 4px; the two outer drops are 1px and 2px.
- Duolingo's primary control is `box-shadow: none` plus a 4px solid bottom
  border.

That document called the convergence "the single most transferable thing in this
research" and turned it into Δ1 rule 1: **a box-shadow blur radius above 4px is
banned app-wide**, enforced in `tests/audit/audit-helpers.ts`.

Neumorphism is depth from blur. The reference's own control shadow is
`3px 3px 6px` and its hero is `12px 14px 32px`. There is no reading on which
both rules hold.

**The owner has overridden the finding with an explicit preference. That is their
call, it is not relitigated here, and the earlier finding was not wrong.** Two
products at the top of their categories really do express depth with hard edges,
and this delta does not claim otherwise or quietly re-describe the evidence.

What the reversal costs, stated rather than smoothed over:

| Cost | Detail |
|---|---|
| The convergence argument is spent | Δ1's strongest claim was that two independent references agreed. We now agree with neither on this point. Any future depth question has to be argued from scratch; it can no longer cite §1.2/§2.1. |
| Edge contrast, structurally | `#e0e5ec` against `#a3b1c6` is **1.72:1** and against white is **1.27:1**. A control distinguished by the shadow pair alone has essentially no edge contrast. §3.2 is the answer and it is a hard rule, not a preference. |
| Rendering cost | A 32px blur over a large element is a real paint cost on a low-end phone, where a 4px solid border is free. Confined to one hero element per screen (§3.3). |

**What survives the reversal unchanged.** Δ1 rule 4 — *elevation stops at the
board's edge* — is untouched. The board, its squares and its marks still take no
shadow, no blur, no radius and no key edge. `Board.tsx` and `Board.test.tsx`
already say so and this delta does not amend them; see §6.

**The guard changes shape rather than going away.** A numeric blur cap is now the
wrong instrument: the hazard it protected against — a soft shadow arriving by
habit and turning every surface to mush — is no longer distinguishable from the
house style by blur radius alone. `blurredShadows()` now allows a blurred shadow
only when its **computed value is exactly one of the four sanctioned tokens** read
off `:root`. A hand-rolled `0 10px 30px rgba(0,0,0,.2)` is caught where a cap of
32 would have waved it through, and so is a neumorphic pair someone has tuned by
eye. It ships with a negative control in the same run (`lessons.spec.ts`): the
spec plants that exact shadow on the live page and asserts the guard catches it,
because a guard that has just returned `[]` is reporting on two possibilities and
only one of them is "the page is clean".

---

## 3. The reference, measured

Sampled live from `https://preqal.org/` on 2026-09-18 via `getComputedStyle` over
all 535 elements, with the page identity (`location.href`, `document.title`)
asserted in the same call.

### 3.1 What the numbers say

| Property | Measured |
|---|---|
| Ground | `rgb(224, 229, 236)` = `#e0e5ec`, on 21 elements |
| Body ink | `rgb(51, 65, 85)` = `#334155` |
| Heading ink | `oklch(0.208 0.042 265.755)` = `#0f172b` |
| Secondary ink | `#475569` |
| Neumorphic dark | `#a3b1c6`, offset **positive** x and y |
| Neumorphic light | `#ffffff`, offset **negative** x and y |
| Control-scale raise | `3px 3px 6px #a3b1c6, -3px -3px 6px #fff` (6 elements) |
| Hero-scale raise | `12px 14px 32px rgba(163,177,198,.55), -6px -6px 20px rgba(255,255,255,.9)` (6 elements) |
| Groove (inset) | `inset 2px 2px 4px #a3b1c6, inset -2px -2px 4px #fff` (7); a softer `.45/.8` variant on 15 |
| Radii, by frequency | 12px (29), 16px (11), 24px (7), full radius (7), 8px (5) |
| Amber | `oklch(0.769 0.188 70.08)` = `#fe9a00` (the brief's `#f59e0b`, within a shade) |
| Panel fill | `rgba(255,255,255,0.72)` over the ground = `#f6f8fa` |
| Measure | `main` capped at **1024px**; inner columns 778px; bands 688px tall |

All confirmed against the brief's figures. Two corrections: the amber resolves to
`#fe9a00` rather than `#f59e0b`, and the reference caps its measure rather than
letting it stretch — which turns out to be the important one (§7).

### 3.2 What the numbers do not carry

Three things I could only get by looking at the page.

- **It leaves a great deal of air and it is not empty.** The bands are 688px
  tall with a 778px column inside a 1024px cap. The air is *around* a full
  column, never a short column floating in a wide window. That distinction is
  exactly what ChessApp gets wrong on desktop.
- **It ranks a page vertically, not horizontally.** A wide window gets more
  bands, not wider text. There is no 2000px-wide anything.
- **It stops.** The neumorphic treatment is on tiles and controls. Body text,
  list rows and headings sit directly on the ground with no treatment at all.

### 3.3 Where the reference is wrong, and we do not follow it

**Measured: every interactive control on preqal.org computes `border-width: 0px`.**
Its buttons are separated from the ground by the shadow pair alone, or by an
amber fill. At `#e0e5ec` against `#a3b1c6` that is **1.72:1** of edge contrast,
against a 3:1 requirement for a non-text control boundary
(`accessibility.md › Color and effects`: interface controls need sufficient
contrast to be perceivable).

This is neumorphism's characteristic failure and it is not a matter of taste. So:

> **Containers may go soft. Controls keep a real edge.**
>
> Every interactive element clears **3:1 for its border** and **4.5:1 for its
> label**, measured from computed styles. The shadow pair is decorative on a
> control and may never be the only thing bounding it.

`--edge-strong` is `#64748b` at **3.76:1** on the ground and **4.47:1** on a
panel, on every control border. The one filled primary action additionally keeps
its 3px crisp `--key-accent` bottom edge *underneath* the soft raise, because a
filled face plus a blur is still not an edge.

### 3.4 On amber

Rejected as an accent, with numbers. `#f59e0b` measures **1.70:1** on the ground
— it cannot be a border, an icon or text. The reference only ever uses it as a
*fill* with `#0f172b` on it (8.30:1), i.e. as its primary-action colour.

ChessApp's primary-action colour is `--accent` green, and it carries meaning
assigned in two earlier passes: DESIGN-SYSTEM.md H-4 took green *off the board*
so the green button could mean something. `REFERENCE-DELTA.md` §5.1 already
rejected importing a reference's third accent for the same reason. Grounding in
preqal.org means taking its ground, its depth and its rhythm — not a brand hue
the app has already spent.

Amber is honoured where the app already has a warm role: `--signal` stays
`#7a5310`, which is the reference's amber family darkened until it can carry text
(**5.40:1**), with `--signal-soft` `#fbecd2` under it.

### 3.5 The token system

Every ratio computed, none estimated. Roles with no contrast duty are marked, and
per observation 0113 they were computed anyway, because the rows nothing
downstream validates are the rows most likely to be wrong.

| Token | Value | Measured against | Ratio | Duty |
|---|---|---|---|---|
| `--surface` | `#e0e5ec` | — | — | the ground |
| `--surface-raised` | `#f6f8fa` | `--surface` | **1.19** | a lift, never a boundary |
| `--content` | `#0f172b` | `--surface` | **14.08** | text ≥ 4.5 |
| `--content` | `#0f172b` | `--surface-raised` | **16.75** | text ≥ 4.5 |
| `--content-dim` | `#475569` | `--surface` | **5.99** | text ≥ 4.5 |
| `--content-dim` | `#475569` | `--surface-raised` | **7.12** | text ≥ 4.5 |
| `--edge-strong` | `#64748b` | `--surface` | **3.76** | **every control border ≥ 3** |
| `--edge-strong` | `#64748b` | `--surface-raised` | **4.47** | **every control border ≥ 3** |
| `--edge` | `#cbd3df` | `--surface` | **1.19** | decorative hairline, no duty |
| `--n-dark` | `#a3b1c6` | `--surface` | **1.72** | decorative shadow, no duty |
| `--n-light` | `#ffffff` | `--surface` | **1.27** | decorative shadow, no duty |
| `--key-accent` | `#0b3c2d` | `--surface` | **9.77** | decorative, no duty |
| `--key-accent` | `#0b3c2d` | `--accent` face | **1.67** | decorative, no duty |
| `--key-raised` | `#a3b1c6` | `--surface` | **1.72** | decorative, no duty |
| `--track` | `#cfd6e0` | `--surface` | **1.16** | groove, decorative |
| `--accent` | `#12614a` | `--surface` | **5.85** | action ink and border ≥ 4.5 |
| `--accent` | `#12614a` | `--track` | **5.06** | meter fill on its groove ≥ 3 |
| `--accent-on` | `#ffffff` | `--accent` | **7.41** | button label ≥ 4.5 |
| `--content` | `#0f172b` | `--accent-soft` `#dbeae3` | **14.34** | text ≥ 4.5 |
| `--signal` | `#7a5310` | `--surface` | **5.40** | signal ink ≥ 4.5 |
| `--signal` | `#7a5310` | `--signal-soft` `#fbecd2` | **5.87** | signal on its fill ≥ 4.5 |
| `--content` | `#0f172b` | `--signal-soft` `#fbecd2` | **15.31** | text ≥ 4.5 |
| `--danger` | `#9b2f2f` | `--surface` | **5.84** | destructive border and ink ≥ 4.5 |
| `--danger` | `#9b2f2f` | `--surface-raised` | **6.94** | destructive border and ink ≥ 4.5 |

**Depth.** Four tokens, the reference's own values verbatim, and the only blurred
shadows the app may emit:

```
--shadow-raised      3px 3px 6px #a3b1c6, -3px -3px 6px #fff
--shadow-raised-lg   12px 14px 32px rgba(163,177,198,.55), -6px -6px 20px rgba(255,255,255,.9)
--shadow-inset       inset 2px 2px 4px #a3b1c6, inset -2px -2px 4px #fff
--shadow-inset-soft  inset 2px 2px 5px rgba(163,177,198,.45), inset -2px -2px 5px rgba(255,255,255,.8)
```

`--shadow-raised-lg` is spent on **at most one element per screen** — the same
discipline Δ1 applied to `--key-accent`, and the same discipline the reference
observes (6 hero shadows across a whole page).

**Radius.** `--radius-control: 12px`, `--radius-card: 16px`, `--radius-hero: 24px`,
re-grounded on the reference's measured 12/16/24. This supersedes the single 10px
of DESIGN-SYSTEM.md §3.3. **The 999px clause of §3.3 is unchanged**: a full radius
is still permitted only on an element that neither receives a press nor contains
anything, and `REFERENCE-DELTA.md` §5.4's rejection of pill chips still stands.

**Type.** Unchanged. Nine roles, `body` at 17px, everything in `rem`. See §8.

---

## 4. Light only, and what it costs

The dark appearance is **removed**, not defaulted away from. There are no dark
values, no `prefers-color-scheme` block, no dark `theme-color`, and no dark
assertions left in the tests. `color-scheme: light` is declared so the browser's
own form controls, scrollbars and overscroll canvas follow the commitment instead
of being rendered dark around a light page.

**This is legitimate and it is not what the HIG argues against.**
`dark-mode.md › Overview` treats the appearance as a system-wide choice the person
has already made, and the rule that follows is against an **app-specific
appearance switch** — an in-app toggle that desynchronises the app from the status
bar and the OS. It is not a requirement that every app ship two appearances. A
product that commits to one has made a design decision; a product that ships a
switch has pushed the decision onto the person.

**What it costs, stated plainly:**

- **People who prefer dark do not get it here.** That is a real group and this is
  a real loss for them. There is no mitigation on offer and it would be dishonest
  to imply one.
- **Low-light reading is brighter than it was.** `#e0e5ec` at 200 cd/m² in a dark
  room is uncomfortable for a long session, and chess study sessions are long.
  The system's own brightness and Night Shift are the only remedies.
- **Half of the palette's design work is discarded.** Two passes tuned a dark
  board, dark marks and a dark ink pick. Those values are deleted, not commented
  out, and recovering them means redoing the work.

**Why remove rather than default.** A "light by default with a dark fallback"
leaves dark values in the tree that nobody looks at, nobody measures and no test
covers. That is the half-dark rot the owner asked to avoid, and it is worse than
either committed option.

**What the removal touched** (grep-derived, then confirmed by the suite — the
plan's list is a hypothesis, observation 0114):

| File | What went |
|---|---|
| `src/app/theme.css` | the entire `@media (prefers-color-scheme: dark)` block, 16 dark values |
| `index.html` | the two media-scoped `theme-color` metas → one unconditional `#F6F8FA` |
| `vite.config.ts` | manifest `theme_color` / `background_color` re-grounded |
| `src/board/boardColors.ts` | the `Appearance` type, `currentAppearance()`, and the per-appearance `FALLBACK_PALETTE` → one palette |
| `src/board/Board.tsx` | the `matchMedia` listener in `useBoardPalette`, and the scoped dark-appearance piece-stroke override (now inert — see §5) |
| `src/board/boardColors.test.ts` | every `APPEARANCES` parametrisation and the dark half of six ratio tables |
| `src/board/Board.test.tsx` | the `matchMedia` stub and the dark half of the elevation guard |
| `src/board/CoordinateRail.test.tsx` | the dark ratio, and the threshold derived from it (§5) |
| `tests/audit/audit-helpers.ts` | the dark fallback in `refutationArrows` |
| `scripts/capture/{shots,review,review2}.spec.ts` | the whole `scheme` dimension, rather than a single-valued one left behind |

The last row matters: a `scheme` array with one entry in it is exactly the
half-dark code the owner asked not to leave in the tree.

---

## 5. The board, settled with numbers

**The board does not move. That is a measured result, not an omission.**

All eight piece-on-square combinations and all four mark-on-square ratios are
**internal to the board** — piece against square, mark against square. Re-grounding
the *page* cannot move any of them, and re-measured against the new palette they
reproduce exactly:

| | on `--board-light` | on `--board-dark` |
|---|---|---|
| `--piece-light` `#fbfaf7` | fill 1.24, outline **13.58** | fill **3.38**, outline **5.00** |
| `--piece-dark` `#17191a` | fill **13.58**, outline 1.24 | fill **5.00**, outline 3.38 |
| `--mark-good` `#0b3d2e` | **9.39** | **3.46** |
| `--mark-review` `#4a3306` | **9.15** | **3.37** |

Square-to-square stays **2.71:1**, the exemption DESIGN-SYSTEM.md §3.1 argues for
explicitly. All eight combinations clear `max(fill, outline) ≥ 3`.

**What did have to move is `--content`, and the board is what forced its value.**

The board draws its own ink on a square — the keyboard cursor's outline — picked
per square by `pickReadable`. That ink is `--content`. The obvious `--content` for
a page grounded in preqal.org is the reference's **body** slate `#334155`. Measured
as board ink:

| Candidate | on `--board-dark` | Verdict |
|---|---|---|
| `#334155` (reference body) | **2.94:1** | **fails 4.5** |
| `#1e293b` | **4.15:1** | **fails 4.5** |
| `#0f172b` (reference heading) | **5.06:1** | passes |

So `--content` is the reference's **heading** slate, `#0f172b` — 14.08:1 on the
ground, 13.73:1 and 5.06:1 as board ink. `#334155` survives in the document as the
rejected candidate and in `boardColors.test.ts` as the negative control, so the
shipped value never looks like a free choice. `--content-dim` takes the
reference's secondary `#475569` at 5.99:1.

**Two consequences worth naming.**

1. The library's hardcoded `#000000` piece stroke used to fail dark-piece-on-dark-square
   *in the dark appearance* (fill 2.21 / outline 2.60), which is why `Board.tsx`
   shipped a scoped stroke override. With dark gone that combination does not
   exist: in the one appearance the app ships, `#000000` on `--board-dark`
   measures **5.95:1**. The override is **removed**, not left inert.
2. The rail's second claim moves. `CoordinateRail.test.tsx` asserted that the
   gutter beats the worst on-square combination by more than 3×. The worst
   on-square combination *was* `--content` on `--board-light` in the **dark**
   appearance at 3.34:1. With dark gone the worst is 5.06:1, so the gutter's
   absolute advantage **improves** (13.53 → 14.08) while its multiple **narrows**
   (4.05× → 2.78×). The old threshold measured an appearance that no longer
   exists. It is re-derived to 2.5× rather than kept or quietly dropped, and both
   halves are asserted.

**Why the board is not re-hued.** A warm board on a cool ground is the one warm
object on the screen, which is what the board should be: DESIGN-SYSTEM.md §5 makes
the board the subject. Cooling the squares to match the ground was computed and
rejected — every cool pair that keeps a mid-slate ink legible drops
square-to-square from 2.71 to 1.85–2.42, i.e. it spends the board's own legibility
to buy hue agreement.

**The cost, on the record.** `--board-light` measures **1.03:1** against the
ground, so the board has no visible outer boundary. That was also true of the old
warm ground (1.01:1), so it is a property of this design, not a regression, and it
is asserted in `boardColors.test.ts` so a later pass cannot discover it as news.
It is **not** fixed with a sunken well: see §6.

---

## 6. Self-critique

**Would this delta come out of a brief about any product that wanted to look soft
and light?** Most of it, yes — and that is worth saying rather than hiding.
`#e0e5ec`, a `3px 3px 6px` pair against white, 12/16/24 radii and a pill is
*the* neumorphism default; it would fall out of any such brief, and calling it
"grounded in preqal.org" does not make it less of a default.

Three things are this product's and would not:

1. **The warm, unframed board as the one warm object on a cool ground** — argued
   from square-to-square legibility (§5), not from taste.
2. **The coordinate rail in the gutter at 14.08:1**, which exists because no
   on-square ink clears 4.5 everywhere. It is chess-specific and it survives.
3. **`--content` chosen by the board rather than by the page.** A generic soft-and-light
   brief lands on `#334155`. This one cannot, and the reason is a chess board.

**What the self-critique changed.** The first draft of this delta put the board in
a **sunken neumorphic well** (`--shadow-inset` on its container) to give it the
outer boundary §5 says it lacks. That is the single most default move in the
style — every neumorphic reference shot puts its content in a well — and worse, it
contradicts a standing decision this project has already made twice:
`PREMIUM-DELTA.md` Δ1 rule 4 stops elevation at the board's edge, `Board.tsx`
restates it in a comment, `Board.test.tsx` asserts it, and the *previous* pass had
already cut a well for exactly this reason. **Cut.** The board's presence stays
arithmetic — its share of the viewport and the parity of the column beside it.

Per observation 0126, the conflict was found by enumerating what the change
touches, not by re-reading the documents: a delta that cites a rule to reject one
thing has demonstrated it knows the rule, which is why nobody re-checks it against
the thing the delta accepts.

**One thing to remove.** Two, in the end:

- **The `--key-raised` 2px solid bottom edge on containers.** A card that carries
  a soft neumorphic raise *and* a crisp solid bottom border is running two depth
  grammars at once. One grammar per element class: containers get the shadow,
  controls get `--edge-strong` plus the shadow, the one primary action adds the
  crisp key edge. `btn-secondary` is done in this commit; the five remaining
  container call sites are chunk N4.
- **The nine legacy token aliases** in `theme.css` (`--color-ink`, `--color-paper`,
  `--color-card`, `--color-line`, …). Their comment said "remove once no
  `src/board/` file references them"; grep says none does, and none has for two
  passes. Deleted.

---

## 7. The desktop layout

### 7.1 The void, measured

Read back from `getComputedStyle` and `getBoundingClientRect` on the production
build, at the width the owner actually uses:

| Viewport | Rail | Content column | Dead flanks | Dead below | Content share |
|---|---|---|---|---|---|
| 390 × 844 | 390 × 61 (bottom) | 390 × 545 | 0 | 299px (35%) | 65% |
| 1280 × 800 | 240 × 800 | 768 × 545 | 136 + 136 | 255px (32%) | 41% |
| **2000 × 1200** | 240 × 1200 | **752 × 545** | **496 + 496** | **655px (55%)** | **17%** |

At the owner's width the product uses **17% of the window**. Seven elements —
a title, an XP line, two section headings, two cards and a Settings link — sit in
a 752px column with 992px of dead flank and 655px of dead space beneath.

Earlier passes noted this. `PREMIUM-DELTA.md` §3.2 measured the phone void and
Δ4.4 answered it with the 120px board on the lesson card, which shipped.
`REFERENCE-DELTA.md` §10 listed the desktop void under "not a chunk, deliberately".
It is now the most visible problem in the product.

### 7.2 What the reference does about width

It **caps**. `main` computes to 1024px at a 1024px viewport and does not stretch;
the inner column is 778px; the page is full because it has more *bands*, not wider
text. `layout.md › Best practices` asks to "Extend content to fill the screen or
window" — the reference's reading of that is to fill it with content, not with
margin, and that reading is the one to copy.

Per observation 0119 the reference class matters: this is preqal.org's own
in-product measure, taken from the working page rather than from a marketing hero,
and Today is the analogous screen.

### 7.3 The design

Three changes, all using content the app already computes and never shows.

1. **Raise the cap from `md:max-w-3xl` (768px) to 1120px**, and switch to a
   two-column grid at ≥ 1120px: a 2fr primary column and a 1fr secondary column
   with a 48px gutter (the reference's own gutter). At 2000px the flanks become
   320px each — margin, because the content beside them is a full measure, rather
   than void, because it is not.
2. **The hero card grows.** Today's lesson card takes the secondary column's
   place at hero scale: the lesson's opening position at **240px** instead of
   120px, on `--shadow-raised-lg`, at `--radius-hero`. This is the screen's one
   hero-scale element, and Δ4.4's argument — "the one place a board-shaped
   product should obviously show a board" — is unchanged, only bigger.
3. **The secondary column and the band carry what Today already knows.** The
   unit meter (Δ3 built it for the Path), the streak and XP in the index voice,
   "Up next" — the two nodes after the active one, from `activeNode` — and below
   the fold a full-width **Recently finished** band from `progress`. Nothing here
   is new content; it is content that exists and has never been on this screen.

Compact is unchanged. The phone's 299px void is Δ4's unfinished business and is
not re-opened here.

### 7.4 Wireframes

**390 × 844 — unchanged**

```
┌────────────────────────────────────────┐
│ Today                                  │  display-lg
│ 0 XP so far                            │  index (mono)
│                                        │
│ ON THE PATH                            │  caption
│ ┌────────────────────────────────────┐ │
│ │ Lesson 1.1.1        ┌────────────┐ │ │  card: radius-card,
│ │ The board           │  board 120 │ │ │  shadow-raised,
│ │ To pick a square…   └────────────┘ │ │  edge-strong 1px
│ │ ┌────────────────────────────────┐ │ │
│ │ │       Start this lesson        │ │ │  primary: accent fill,
│ │ └────────────────────────────────┘ │ │  3px key-accent edge
│ └────────────────────────────────────┘ │
│ PLAY                                   │
│ ┌────────────────────────────────────┐ │
│ │ Play a coached game                │ │
│ └────────────────────────────────────┘ │
│ Settings                               │
│              (299px void — Δ4 work)    │
├────────────────────────────────────────┤
│  ▣      ◇      ◆      ♞      ▤         │  tab bar
└────────────────────────────────────────┘
```

**1280 × 800 — two columns inside the 1120 cap**

```
┌────────┬──────────────────────────────────────────────────────────┐
│ChessApp│      ← 80px →                                ← 80px →    │
│        │  ┌────────────────────────────┬──────────────────────┐   │
│ ▣ Today│  │ Today                      │  THIS UNIT           │   │
│ ◇ Path │  │ 0 XP so far                │  ▰▰▰▱▱▱▱  3 of 7     │   │ meter:
│ ◆ Puzz │  │                            │                      │   │ accent on
│ ♞ Play │  │ ON THE PATH                │  UP NEXT             │   │ track,
│ ▤ Prog │  │ ┌────────────────────────┐ │  ┌────────────────┐  │   │ 5.06:1
│        │  │ │ Lesson 1.1.1           │ │  │ 1.1.2 Files    │  │   │
│        │  │ │ The board              │ │  ├────────────────┤  │   │
│        │  │ │ ┌────────────────────┐ │ │  │ 1.1.3 Ranks    │  │   │
│        │  │ │ │    board  240      │ │ │  └────────────────┘  │   │ hero:
│        │  │ │ └────────────────────┘ │ │                      │   │ shadow-
│        │  │ │ ┌────────────────────┐ │ │  PLAY                │   │ raised-lg
│        │  │ │ │ Start this lesson  │ │ │  ┌────────────────┐  │   │ radius-hero
│        │  │ │ └────────────────────┘ │ │  │ Coached game   │  │   │
│        │  │ └────────────────────────┘ │  └────────────────┘  │   │
│        │  ├────────────────────────────┴──────────────────────┤   │
│        │  │ RECENTLY FINISHED                                 │   │ full-width
│        │  │ 1.0.3 ✓ 2 ★ · 1.0.2 ✓ 3 ★ · 1.0.1 ✓ 3 ★          │   │ band
│        │  └───────────────────────────────────────────────────┘   │
│        │  Settings                                                │
└────────┴──────────────────────────────────────────────────────────┘
   240              2fr = 693        48        1fr = 379
```

**2000 × 1200 — the same grid; the flanks become margin**

```
┌────────┬──────────────────────────────────────────────────────────────────────────┐
│ChessApp│  ←──── 320px margin ────→                     ←──── 320px margin ────→   │
│        │        ┌──────────────────────────────┬──────────────────────────┐       │
│ ▣ Today│        │ Today                        │  THIS UNIT               │       │
│ ◇ Path │        │ 0 XP so far                  │  ▰▰▰▱▱▱▱   3 of 7        │       │
│ ◆ Puzz │        │                              │  ── 4 day streak         │       │
│ ♞ Play │        │ ON THE PATH                  │                          │       │
│ ▤ Prog │        │ ┌──────────────────────────┐ │  UP NEXT                 │       │
│        │        │ │ Lesson 1.1.1             │ │  ┌────────────────────┐  │       │
│        │        │ │ The board                │ │  │ 1.1.2  Files       │  │       │
│        │        │ │ ┌──────────────────────┐ │ │  ├────────────────────┤  │       │
│        │        │ │ │                      │ │ │  │ 1.1.3  Ranks       │  │       │
│        │        │ │ │      board 240       │ │ │  └────────────────────┘  │       │
│        │        │ │ │                      │ │ │                          │       │
│        │        │ │ └──────────────────────┘ │ │  PLAY                    │       │
│        │        │ │ ┌──────────────────────┐ │ │  ┌────────────────────┐  │       │
│        │        │ │ │  Start this lesson   │ │ │  │ Coached game       │  │       │
│        │        │ │ └──────────────────────┘ │ │  └────────────────────┘  │       │
│        │        │ └──────────────────────────┘ │                          │       │
│        │        ├──────────────────────────────┴──────────────────────────┤       │
│        │        │ RECENTLY FINISHED                                       │       │
│        │        │ 1.0.3 ✓ 2★ · 1.0.2 ✓ 3★ · 1.0.1 ✓ 3★ · 1.0.0 ✓ 2★      │       │
│        │        └─────────────────────────────────────────────────────────┘       │
│        │        Settings                                                          │
└────────┴──────────────────────────────────────────────────────────────────────────┘
   240      320              2fr = 693      48      1fr = 379            320
```

Target after chunk N5: content share rises from **17%** to **≥ 45%** at
2000 × 1200 (a 1120px column over roughly 1060px of content height computes to
49%), with no element wider than 720px and the dead flank down from 496px to
320px on each side. Those are predictions; chunk N5 verifies them by reading back
the boxes, not by looking at a screenshot (observation 0095).

---

## 8. Rubik, answered with a number

**Decision: no web font. The system stack stays.**

The bytes, measured from preqal.org's own resource timings — the site loads three
Latin subsets (400, 600, 700):

```
rubik-latin-400-normal.woff2   18,936 bytes
rubik-latin-600-normal.woff2   19,060 bytes
rubik-latin-700-normal.woff2   19,112 bytes
                               ──────
                               57,108 bytes
```

Against the current production build (measured, this commit): `index.js` **231,758
bytes gzipped**, `index.css` **6,508 bytes gzipped**, precache 868.26 KiB. Against
the PRD's five-second time-to-first-lesson on 7 Mbps (≈ 875 KB/s), 57,108 bytes is
**65 ms**, or **1.3% of the budget**, same-origin so no extra connection.

**So the byte argument does not decide it, and pretending it does would be
dishonest.** 65 ms is affordable. The decisive number is a different one:

> **Rubik computes on 23 of preqal.org's 535 elements — 4.3%. The other 506
> (94.6%) compute to `ui-sans-serif, system-ui`.**

The reference declares Rubik on `body` and then overrides it almost everywhere.
Its actual typographic body voice **is the system stack**. "Grounded in
preqal.org" therefore does not entail shipping Rubik; shipping it would be more
Rubik than the reference uses.

Two supporting reasons, neither decisive on its own:

- DESIGN-SYSTEM.md §3.2 already decided this, with its own measurement and a
  citation (`typography.md › Best practices`: "the system fonts are designed for
  legibility at every size"). Reversing a standing measured decision needs
  evidence; the measurement above is evidence *for* it.
- The app is an offline-first PWA. A web font adds three precache entries and a
  font swap on every cold start, for a face that would carry 4.3% of the text.

`display-lg` keeps its personality where DESIGN-SYSTEM.md §3.2 put it: in the
mono `index` voice — algebraic notation, chess's own typographic system — not in
a display face.

---

## 9. Constraints this delta respects

Verified, not asserted:

- **The coordinate rail** is untouched and is still the signature. `--content` on
  `--surface` is **14.08:1**, up from 13.53:1.
- **Touch targets ≥ 44px.** `.tap` and `.btn` floors unchanged; `.icon-control`
  keeps its single-expression `max(44px, 1.6em)` sizing. 127 Playwright tests
  including the reflow suite at a 32px root confirm it.
- **Focus rings visible.** `outline: 3px solid var(--accent)` at 2px offset,
  `--accent` 5.85:1 on the ground and 6.96:1 on a panel.
- **Nothing by colour alone.** Board marks keep shape as the first channel;
  `btn-danger` keeps its full-strength border and its word; `btn-danger-quiet`
  keeps its underline.
- **Reduced motion** answered, scoped, with `data-motion-persist` opt-out —
  unchanged.
- **No emoji as icons.** Unchanged.
- **The board fits 390px with no horizontal scroll.** Measured:
  `scrollWidth === innerWidth === 390`.
- **The largest system text size survives** at a **32px root** — not 24px,
  because `body` is 17px. The reflow suite asserts it at 390 × 844.
- **Structure and semantics unchanged.** No accessible name, role or visible
  string moved in this commit, so no spec needed naming under that rule. The
  three presentation-only assertions that did change are named in §10.

---

## 10. Work plan

Sequenced accessibility → conventions → craft → polish. Chunk N1 is this commit.

### Chunk N1 — the token layer and the light-only removal *(done, this commit)*

- `src/app/theme.css` — the palette, the four depth tokens, the radius scale, the
  `n-*` depth utilities, the dark block deleted, the nine legacy aliases deleted.
- `index.html`, `vite.config.ts` — one `theme-color`; manifest re-grounded.
- `src/board/boardColors.ts` — one appearance, one palette, `--content` `#0F172B`.
- `src/board/Board.tsx` — the `matchMedia` listener and the dark stroke override
  removed.
- `tests/audit/audit-helpers.ts` — `blurredShadows` becomes a token-identity
  guard; `refutationArrows` loses its dark fallback.
- `tests/audit/lessons.spec.ts` — the guard's negative control.
- `src/board/{boardColors,Board,CoordinateRail}.test.*` — ratios re-derived.
- `tests/audit-platform/reflow.spec.ts` — the icon-control radius assertion,
  10px → 12px. **Presentation only.**
- `scripts/capture/{shots,review,review2}.spec.ts` — the `scheme` dimension gone.

### Chunk N2 — containers take the soft raise

The card surfaces adopt `n-raised` + `--radius-card`, and drop the
`border-b-2 border-b-key-raised` second depth grammar (§6).

- `src/screens/TodayScreen.tsx`, `src/path/PathScreen.tsx`,
  `src/play/ChooseOpponent.tsx`, `src/pwa/InstallPrompt.tsx`,
  `src/screens/LicencesScreen.tsx`, `src/coach/CoachBubble.tsx`,
  `src/app/Shell.tsx`
- Tests that name the removed classes: `src/path/PathScreen.test.tsx`
  (asserts `border-b-key-raised` placement), `src/app/Shell.test.tsx`.
- Ends by removing `--key-raised` from `theme.css` and from
  `tests/audit/audit-helpers.ts`'s banned-token probe once the last consumer is
  gone — **not before**, or the board guard stops resolving and reports clean.

### Chunk N3 — grooves and meters

`--track` grooves take `n-inset-soft`; the progress meter and the engine
download bar become inset wells with an `--accent` fill at 5.06:1.

- `src/pwa/EngineDownload.tsx`, `src/path/PathScreen.tsx`,
  `src/board/CoordinateRail.tsx` (the rail's own track), `src/app/theme.css`.

### Chunk N4 — controls, verified against §3.3

Every interactive element re-measured from computed styles for border ≥ 3:1 and
label ≥ 4.5:1, at all three widths. This is the chunk that keeps neumorphism from
costing the app its controls.

- `src/app/Button.tsx`, `src/app/theme.css`, `src/board/Board.tsx` (the Skip
  control), `src/board/TextMoveEntry.tsx`, `src/screens/SettingsScreen.tsx`.
- New: `tests/audit-platform/controls.spec.ts` gains a measured contrast sweep
  over every control on every top-level route — the rule in §3.3 stated as a test
  rather than as prose.

### Chunk N5 — the desktop layout (§7)

- `src/app/Shell.tsx` — the cap 768 → 1120.
- `src/screens/TodayScreen.tsx` — the two-column grid, the 240px hero board, the
  secondary column, the Recently-finished band.
- `src/path/progress.ts` — `upcomingNodes(progress, n)` and `recentlyFinished`,
  if not already derivable.
- `src/path/TodayScreen.test.tsx` — the new regions' accessible names.
- `tests/audit-platform/desktop.spec.ts` — the content-share and
  no-element-wider-than-720px assertions at 1280 and 2000, **measured**.
- `tests/audit-platform/reflow.spec.ts` — 2000 × 1200 added to the width matrix.

### Chunk N6 — the hero, and the capture refresh

- `src/screens/TodayScreen.tsx` — `--shadow-raised-lg` spent once.
- `docs/design/after/` — recaptured at 390, 1280 and 2000, light only.

### Test-count accounting

**336 → 333 unit tests; 127 → 127 Playwright tests.** The three that went are all
the second half of a `test.each(['light', 'dark'])` pair in the three board
files (57 → 54 across them), which no longer has a second appearance to run.
Nothing was deleted to make a suite green: every assertion those runs made about
the light appearance is still made, and §5's three new tests — the eight
piece-on-square figures, the board's missing outer boundary, and the rejected
`--content` candidates — are net additions inside the same files. The Playwright
count is unchanged and gained the blur guard's negative control inside an
existing spec.

### Not a chunk, deliberately

- **The phone's 299px void.** Δ4's unfinished business, unchanged in scope by
  this delta. Re-opening it here would mean two deltas owning one defect.
- **The board.** §5 settles it with numbers: nothing moves.

---

## 11. One-line answer

Light only, grounded on preqal.org's `#e0e5ec` with its own measured depth pair —
containers go soft, controls keep a 3.76:1 edge, the board stays warm and unframed
because its own arithmetic says so, and the desktop stops being 17% full.
