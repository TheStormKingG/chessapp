# Premium delta: what chess.com and Duolingo actually do, and what ChessApp should change

| | |
|---|---|
| **Date** | 18 September 2026 |
| **Brief** | The owner wants "a more premium feel", naming **chess.com** and **Duolingo**. Light stays the primary, hero experience. Dark shipped this week and stays, but does not drive decisions. |
| **Basis** | `docs/design/DESIGN-SYSTEM.md` (the system that shipped); `docs/design/after/` (48 shots, both widths, both appearances); PRD v1.1 §1.2, §1.3, §3.1, Appendix D |
| **Reference evidence** | 15 screenshots in `docs/design/reference/`, captured 18 September 2026 from public marketing and public product surfaces at 1280×900 and 390×844 |
| **Live measurement** | Geometry, colour, type and shadow values read out of the running pages with `getComputedStyle`, not estimated from the screenshots |
| **Guidance followed** | `apple-design` (craft lens and the step-3 self-critique), observations 0020, 0022, 0024, 0025 in the observation log |

Everything below is a number or a citation. Where a claim could only be made by
looking at pixels, it says so.

---

## 0. The constraint that shapes this whole document

**PRD v1.1 Appendix D forbids copying chess.com assets outright** — the row reads
"chess.com assets" under *Not used*, and the chess.com public API row adds "Do not
mirror, do not copy assets". The same row excludes Lichess's non-free assets
(Lichess sounds, non-commercial piece sets, chessground and chessops under GPL,
Maia-3 under AGPL). In practice that bars:

- **their pieces** (the chess.com piece sprites visible in
  `reference/chesscom-home-hero-desktop.png` and
  `reference/chesscom-puzzles-inproduct-desktop.png`),
- **their sounds**,
- **their board colours** — the sage/cream pair sampled in the hero is theirs, and
  the design system has already moved off it for an independent reason (H-4: green
  had to come off the board so the green button could mean something),
- **their move-label glyphs** (the Brilliant/Great/Blunder set, PRD Appendix C
  covers our own thresholds and needs our own marks),
- **their icon family** — the full-colour isometric nav glyphs in the left rail.

Duolingo is not in the matrix because nothing of theirs is a candidate: their
identity is a **proprietary typeface (`duolingo-sans`)**, a **mascot**, and a
**character illustration library**, all three of which are theirs alone and all
three of which the PRD positions away from anyway (§1.2: "the product looks and
behaves like a chess platform that teaches, not a language app with a chess
course").

**What this document studies is therefore principles only**: hierarchy, density,
spacing rhythm, type scale, colour discipline, depth and elevation, motion, how a
board is framed, how progress is expressed. Every place a reference's approach
cannot be borrowed is called out inline, with the original alternative named.

---

## 1. chess.com, measured

Public surfaces visited: the home page
(`reference/chesscom-home-hero-desktop.png`, `-full-desktop`, `-phone`), the
learn-to-play page (`reference/chesscom-learn-top-desktop.png`,
`reference/chesscom-learn-board-diagram-desktop.png`), and the public puzzles
surface, which renders the real in-product layout behind an interstitial
(`reference/chesscom-puzzles-inproduct-desktop.png`,
`reference/chesscom-puzzles-desktop.png`). No login was attempted.

### 1.1 The board is given presence by scale and parity, and by nothing else

Read live off the hero at a 1024px viewport: the board element is **424 × 424 px**,
`border-radius: 10px`, **`box-shadow: none`**, **`border: 0px none`**, background
transparent. There is no frame, no bevel, no inner glow, no vignette, no wooden
surround.

What gives it presence is arithmetic:

| Measure | chess.com hero | chess.com in-product puzzles | ChessApp lesson, desktop | ChessApp lesson, phone |
|---|---|---|---|---|
| Board width | 424 px | ≈ 571 px | 624 px | ≈ 358 px |
| Viewport width | 1024 px | 1280 px | 1280 px | 390 px |
| **Board as share of viewport** | **41 %** | **45 %** | **49 %** | **92 %** |

**ChessApp already wins on board scale.** This is worth saying plainly, because it
is the thing most people assume is the gap and it is not. The premium impression on
chess.com does not come from the board being bigger than ours.

It comes from two things the numbers above do not show. First, **the board is
optically centred in its own column and the hero column beside it is exactly the
same width** — the `h1` block measures 424 px, identical to the board, with a 48 px
gutter between them. The composition is a 1:1 pair. Second, the board is the
**palest object on the darkest ground in the page** (page background measured at
`rgb(48, 46, 43)`), so figure/ground does the framing that a border would otherwise
have to do.

**Borrowable:** frame the board with nothing; earn its presence with scale, with
column parity, and with a ground that is a clear step away from the board's own
lightest square. **Not borrowable:** the sage/cream square pair itself, and the
pieces standing on it.

### 1.2 Surfaces are finished with crisp solid edges, never with blur

The hero "Get Started" control, read live:

```
height: 64px    width: 400px    border-radius: 10px    font: 22px / weight 800
box-shadow:
  inset  0  1px 0 0   rgba(178,224,104,0.40)   <- 1px top highlight
  inset  0 -1px 0 0   rgb(69,117,60)           <- 1px bottom lowlight
  inset  0  2px 4px 0 rgba(178,224,104,0.50)
  inset  0 -2px 4px 0 rgba(69,117,60,0.50)
         0  1px 2px 0 rgba(0,0,0,0.14)         <- 1px drop
         0  2px 4px 0 rgba(0,0,0,0.10)         <- 2px drop
```

Six layers, and the largest blur radius in any of them is **4 px**. The two
outermost drops are 1 px and 2 px. There is no 12 px, 24 px or 40 px soft shadow
anywhere on the surface.

Every panel behind it — the nav rail, the puzzle side panel, the coach speech
bubble in `reference/chesscom-puzzles-inproduct-desktop.png` — is **flat**,
separated from the ground by fill alone, with no shadow at all.

The rule that produces the premium read is therefore not "add elevation". It is:
**exactly one element per screen is raised, and it is raised with a 1–4 px crisp
edge; everything else is flat.**

**Borrowable in full.** No asset is involved; it is a shadow discipline.

### 1.3 Density: calm until the moment of commitment, then dense

The home page runs on a rigid section band: five consecutive
`landing-page-pair-container` blocks measured at **424, 432, 432, 432, 432 px**
tall. One idea per band, image on one side, three lines of text and one control on
the other. Nothing is ever three-across.

The in-product puzzles screen
(`reference/chesscom-puzzles-inproduct-desktop.png`) is the interesting one,
because it is far denser and still calm. At 1280 px it carries a 256 px nav rail, a
571 px board, and a right column holding an avatar, a coach sentence, a "White to
move" control, a Hint button and a pager — and it stays legible because **the right
column is one vertical stack with one item per row and a single filled control
anchored at its bottom.** Density is spent on rows, never on columns.

### 1.4 Quality without ornament

The measured type ladder on the home page, in their own face: `h1` **42 px / 48 px,
weight 800**; `h2` 42 px and 36 px, weight 800; `h3` 31 px / 36 px, weight 800; body
and nav **14 px**, weight 400–600.

That is a **3:1 ratio between the top and the bottom of the scale**, and the top of
the scale is genuinely large. There is no decorative rule, no gradient text, no
outline, no letterspaced eyebrow. The impression of quality is carried by a very
large, very heavy headline against very small body text, and nothing else.

**Not borrowable:** `Chess Sans` is theirs, and the design system has already
argued — on a measured byte budget — that ChessApp ships no web font at all
(DESIGN-SYSTEM.md §3.2). The borrowable part is the **ratio**, which costs nothing.

---

## 2. Duolingo, measured

Public surfaces visited: the home page (`reference/duolingo-home-hero-desktop.png`,
`-full-desktop`, `-phone`, and three scrolled bands
`duolingo-home-scroll1-personalized`, `-scroll2-motivation`, `-scroll3-effective`),
the efficacy page (`reference/duolingo-efficacy-desktop.png`) and the approach page
(`reference/duolingo-approach-desktop.png`). The course path itself sits behind a
login and was not attempted; the marketing bands show it second-hand and that is
enough for the craft read.

### 2.1 Depth is a 4 px solid bottom border with zero blur

The hero's primary control, read live:

```
height: 50px    border-radius: 12px
border-bottom: 4px solid <darker green>
box-shadow: none
font: 15px / weight 700 / letter-spacing 0.8px / uppercase
```

**`box-shadow: none`.** The entire "physical key" affordance is a 4 px solid
bottom border. The secondary control beside it ("I ALREADY HAVE AN ACCOUNT") is the
same 50 px height, the same 12 px radius, the same 4 px bottom border, with a
transparent face and blue label.

This is the same finding as §1.2 arrived at from the opposite direction:
**both references express depth with a hard edge, not with a soft shadow.** Two
independent products at the top of their categories, and neither uses a blurred
shadow on a control. That convergence is the single most transferable thing in this
research.

### 2.2 Momentum is legible because progress is always a countable thing

Across the marketing bands the recurring device is that **every unit of progress is
a discrete, countable object**: a lesson node, a crown, a streak day, a percentage.
Nothing says "you are doing well"; everything says "7 of 10". The bands are titled
"stay motivated" and "stay committed"
(`reference/duolingo-home-scroll2-motivation.png`), and the copy underneath names
the mechanism rather than the feeling.

Legibility comes before reward. The reward is layered on top of an already-readable
count — it never replaces it.

### 2.3 Colour is not restrained, and air is enormous

Ground is pure white. The section headings are set in **saturated brand green at
48 px**, body in 20 px grey, and the illustration beside each uses five or six
fully saturated hues at once (pink, orange, blue, purple, yellow, green in a single
frame of `reference/duolingo-home-hero-desktop.png`).

Against that, the air is extreme: each scrolled band is roughly **one full 900 px
viewport for one heading, three lines of body and one image**, with 200 px or more
of clear space above and below the content. Measured heading-to-body gap: 32 px
bottom margin on both the `h1` and the paragraph that follows it.

**The air is borrowable. The colour is not** — and not because of a licence, but
because of PRD §1.2 and §3.1. The learner is an adult of roughly 16–45 who "wants to
be good enough not to embarrass themselves". Six saturated hues and a mascot is the
register that sentence refuses.

### 2.4 One action is obvious because there is only one filled thing

On every Duolingo surface examined, exactly one control carries a filled
background. Everything else is an outline or a text link. The hierarchy is binary,
not graded.

### 2.5 What Duolingo does that would be wrong here

Named explicitly, because the PRD positions against it:

| Duolingo device | Why it is wrong for ChessApp |
|---|---|
| A mascot with a personality and a face | The coach is a *voice*, not a character (Concept-Note §2, DESIGN-SYSTEM.md §2 M-6). A drawn mascot converts a dry adult coach into a cartoon. |
| Celebration effects, confetti, XP bursts | DESIGN-SYSTEM.md §6: a learner does five to ten challenges in a row, and `motion.md` warns against motion on frequent interactions. The one earned orchestrated moment is already spent on the refutation replay. |
| Streak-loss guilt, hearts, lives, penalties | PRD §1.3 principle 1 makes mistakes the material. A penalty economy inverts the product's thesis. |
| Six saturated hues at once | Breaks one-colour-one-meaning, which is the rule the palette is built on (§3.1). |
| All-caps letterspaced button labels | Reads as a game UI, and hurts the screen-reader and Dynamic Type story for no gain. |
| A proprietary display face | 30–60 KB of render-blocking transfer against a budget with 75 KB of headroom and a five-second first-lesson target. |

**What *is* borrowable from Duolingo is exactly one thing: progress is always a
count, stated before it is decorated.** That is a structural idea and it carries no
asset with it.

---

## 3. Where ChessApp actually stands

Read off `docs/design/after/`, plus values read out of `src/app/theme.css` and
recomputed with the WCAG relative-luminance formula.

### 3.1 The measured defect: surfaces have almost no weight

`--surface-raised` **#FBFAF7** against `--surface` **#F4F2ED** is a luminance ratio
of **1.07:1**. In the dark appearance, **#1C211F** against **#121514** is
**1.13:1**.

At 1.07:1 a card is not a surface. It is a rectangle that exists only because a
1 px `--edge-strong` hairline is drawn around it — visible on the Today screen
(`after/01-today--phone-390x844.png`), where the lesson card and the "Play a
coached game" card read as outlines on paper rather than as objects on a ground.
Both references put an unmistakable step between a raised thing and its ground; we
put 1.07:1 and a hairline.

This is the root cause of "it looks flat", and it is one token change.

### 3.2 The measured defect: half of several screens is dead, not airy

Duolingo's air has content at the optical centre of a band with clearance above and
below. Ours has content at the top and a void at the bottom, which reads as
unfinished rather than as calm.

| Screen | Void |
|---|---|
| `after/01-today--phone-390x844.png` | Content ends at ≈ 420 px of 844. **50 % of the screen below the Settings link is empty.** |
| `after/04-lesson-challenge--phone-390x844.png` | Content ends at ≈ 600 px of 844. **≈ 240 px below the Hint / Show me row is empty, and the primary action is not anchored to the bottom** as DESIGN-SYSTEM.md §3.3 specifies. |
| `after/05-lesson-close--phone-390x844.png` | "+10 XP" sits at ≈ 260 px; the action sits at ≈ 790 px. **≈ 500 px of empty paper at the one moment the product is supposed to feel rewarding.** |
| `after/04-lesson-challenge--desktop-1280x800.png` | The prompt "Tap e4." sits at y ≈ 94; the Hint row at y ≈ 366. **≈ 250 px of void in the right column** — the H-3 void the desktop layout was meant to fill. |

The coach is still not on screen on either lesson surface, which is precisely the
content that was specified to occupy those voids (DESIGN-SYSTEM.md chunk C5, M-6).

### 3.3 The measured defect: the Path's hierarchy is inverted, and carries no progress

In `after/02-path--phone-390x844.png`:

- The **active** node ("1.1.1 The board · Up next") is a near-white card with a 2 px
  green outline. Its visual weight is an outline.
- The **checkpoint** nodes are **full-bleed saturated `--signal-soft` slabs** with
  amber text — two of them visible on one screen, each taller than the active node.
  The thing the learner should do next is quieter than a thing that is optional and
  not yet due.
- **No progress is expressed anywhere on the screen.** No "3 of 8", no completed
  state, no section meter. Duolingo's entire momentum read is this, and we have
  none of it. This is the largest single gap between the two products' *feel*, and
  it has nothing to do with colour or shadow.
- The locked-group boundary reads **"Locked until you get there"** identically on
  both groups. A label whose value is constant across the set is a section heading
  printed twice (observation 0020). The count differs (7 vs 5) and the count is what
  the learner wants.

### 3.4 The type scale's top end is never used where it matters

The system's top role is `display` at **30 px / 34 px, weight 700**
(DESIGN-SYSTEM.md §3.2). chess.com's top role is **42 px / 48 px, weight 800**.

Worse than the absolute size is where ours is spent. The 30 px role appears on
"Today" and "Foundations" — screen titles nobody reads twice. On
`after/05-lesson-close--phone-390x844.png`, the moment the whole lesson loop exists
to produce, "Lesson done" is set at the 22 px `title` role. On
`after/04-lesson-challenge--desktop-1280x800.png` nothing on the screen exceeds
17 px.

### 3.5 One thing that is *not* a defect, verified rather than assumed

At phone size the coordinate rail's glyphs look like the UI sans. They are not:
`src/board/rail.ts:15` sets `font-index text-[0.75rem] font-semibold
tracking-[0.04em] tabular-nums`, and `src/board/CoordinateRail.test.tsx:17` asserts
it. The rail is correct, it is tested, and it stays. See §6.

---

## 4. The delta

Four changes, in the order they should land. Each names its tokens with measured
ratios for both appearances.

### Δ1 — Give surfaces weight, and give exactly one element per screen a crisp key edge

**The observation behind it:** both references raise exactly one control per screen,
with a solid 1–4 px edge and no blur (§1.2, §2.1), on a ground that is a clear step
away from the raised surface. We have a 1.07:1 step and no edges.

**Token changes.** Ratios computed from the hex values with the WCAG
relative-luminance formula.

| Token | Light: was → is | Dark: was → is | Measured |
|---|---|---|---|
| `--surface` | `#F4F2ED` → **`#EAE5DA`** | `#121514` → **`#0E1110`** | raised-to-ground step **1.07 → 1.20:1** light, **1.13 → 1.16:1** dark |
| `--edge-strong` | `#8E8A80` → **`#807C73`** | `#6F7874` (unchanged) | light **3.31:1** on the new ground (was 3.08 on the old), **3.99:1** on a card (was 3.30). Dark **4.17:1** on ground, **3.59:1** on card. All clear the 3:1 non-text rule with margin, which the old light value did not. |
| `--key-accent` *(new)* | **`#0B3C2D`** | **`#2A7A57`** | 3 px solid bottom edge on the primary button only. **10.39:1** light / **3.63:1** dark against the ground; 1.67:1 / 2.39:1 against the button face. Decorative — it carries no meaning and is never the sole separator, so it has no contrast duty; the figures are given so nobody has to re-derive them. |
| `--key-raised` *(new)* | **`#C9C3B5`** | **`#070908`** | 2 px solid bottom edge on cards and secondary buttons. Same status as above. |

**Re-verified against the new light ground** (all still pass):
`--content` **13.53:1**, `--content-dim` **5.51:1**, `--accent` **5.90:1**,
`--signal` **5.44:1**, `--danger` **5.88:1**. Dark ground: `--content` **15.94:1**,
`--content-dim` **7.26:1**, `--accent` **8.69:1**, `--signal` **10.05:1**,
`--danger` **7.87:1**.

**The rule, so an implementer can test it:**

1. `box-shadow` with a blur radius above 4 px is banned app-wide.
2. At most **one** element per screen carries `--key-accent`. It is the primary
   action.
3. Cards and secondary controls carry `--key-raised` at 2 px, on `--surface-raised`.
4. **Elevation stops at the board's edge.** The board, its squares and its marks
   take no key edge, no shadow and no radius, ever. Both references frame their
   board with literally nothing (§1.1), and a chess board with a drop shadow stops
   being a board and becomes a photograph of one.

Rule 4 is the chess-specific half of this change and it is the part a generic
"add depth" delta would get wrong. See §5.

### Δ2 — Raise the top of the type scale, and spend it at the two moments that matter

chess.com runs a 3:1 ratio from the top to the bottom of its ladder, at weight 800
(§1.4). Ours runs 30 px to 13 px at weight 700, and never uses the top on a screen
that matters (§3.4).

**New role** in DESIGN-SYSTEM.md §3.2:

| Role | Size | Line height | Weight | Tracking | Face | Used for |
|---|---|---|---|---|---|---|
| `display-lg` | **40 px** | **44 px** | 700 | −0.02em | `--font-ui` | Exactly two places: the lesson-close headline, and the Today screen title |

Zero bytes. The system stack already carries a 700 weight.

**The pairing that makes it ours, not a generic bigger headline.** `display-lg`
never appears alone. It is always immediately followed by one line in
`--font-index` at the `index` role (15 px, tabular) carrying the algebraic fact the
screen just taught:

```
Lesson done                      <- display-lg, 40/44
e4 · e-file, fourth rank         <- index, 15px mono, --content-dim
```

A big headline is a default. A big headline whose subtitle is chess notation is the
product's own voice, and it reuses the index voice DESIGN-SYSTEM.md §5 already
identified as where the personality lives.

**Constraint check.** At the largest system text size (200 %) `display-lg` renders
at 80 px; "Lesson done" is 11 characters and wraps to two lines inside 390 px minus
a 16 px gutter with no horizontal scroll. Declared in `rem`, so OS scaling works.
`tests/audit/lessons.spec.ts:30` asserts `getByRole('heading', { name: 'Lesson
done' })` — the role and the accessible name do not change, only the size does.

### Δ3 — Make progress legible, and put the meter in the rail

This is the one genuinely borrowable idea from Duolingo (§2.2): progress is always
a count, stated before it is decorated.

**New tokens:**

| Token | Light | Dark | Measured |
|---|---|---|---|
| `--track` | **`#D3CCBC`** | **`#313A36`** | **1.27:1** below the light ground, **1.62:1** above the dark ground — a visible groove that is not a border |
| fill | `--accent` (existing) | `--accent` (existing) | **4.63:1** light / **5.38:1** dark against `--track`. Clears the 3:1 non-text requirement with margin. |

**Nothing is conveyed by colour alone.** The meter always sits beside a text count
in `--font-index` — "3 of 8 done" — and the count is the accessible name. The bar is
the second channel.

**Where it goes, and why it is not a generic progress bar.** It runs **vertically,
in the coordinate rail's own gutter column, at the same x, at the same one-character
width, filling from the bottom up like a rank index**. The Path screen has no board,
so that column is free; the rail's job on that screen is already to carry the unit
numbers 1.1.1 to 1.1.8 (DESIGN-SYSTEM.md §4). The meter becomes the rail's fill
state rather than a second progress language bolted beside it.

This also gives the Path a **completed** state it does not currently have: a
finished unit's rail segment is filled in `--accent`, its node title takes
`--content` at weight 600, and its row carries a `✓` — fill, weight and glyph, three
channels, none of them colour alone.

**Locked state, and the copy change it needs.** The group boundary changes from the
constant "Locked until you get there" to the varying count **"7 locked"** /
**"5 locked"**.

> **Asserting spec, named as required.** `src/path/PathScreen.test.tsx:66` asserts
> `screen.getAllByText('Locked until you get there')` has length 2, and line 67
> asserts no bare `'Locked'` is rendered. That spec encodes the *fix* for the old
> per-node repetition, not the wording, so it must be updated in the same commit:
> assert the two group boundaries by their new counts and keep line 67's guarantee
> that "Locked" is not printed per node. **`tests/audit/path-today.spec.ts:43` must
> not be touched** — it locates a node by the accessible name `1.1.2 The rook.
> Locked` and asserts `aria-disabled="true"`. That name is correct for a screen
> reader whatever the visible group heading says, and it stays verbatim.

### Δ4 — Fill the four voids with the content that was already specified for them

Not a new idea: DESIGN-SYSTEM.md §3.3 already draws all four of these layouts. They
did not ship.

1. **Lesson, phone.** Anchor the primary action to the bottom edge as §3.3's compact
   diagram shows, and put the coach's `◇` line in the gap that opens between the
   board and it. ≈ 240 px of void becomes the coach.
2. **Lesson, desktop.** The right column's ≈ 250 px void takes the coach line
   directly under the prompt, then the challenge index, then the anchored action —
   the stack §3.3's regular diagram already draws. This is also chess.com's
   in-product pattern: one vertical stack, one item per row, one filled control at
   the bottom (§1.3).
3. **Lesson close.** Move the block to the optical centre, lead with `display-lg`
   plus its notation line (Δ2), and anchor the action. ≈ 500 px of void becomes
   deliberate air with content in the middle of it, which is the Duolingo band
   shape (§2.3) with none of its ornament.
4. **Today.** The screen has no chess on it at all. Give it the next lesson's
   **starting position at 120 px, square, unframed**, on the lesson card. It is the
   one place a board-shaped product should obviously show a board, it costs no new
   asset, and it is what chess.com's own hero does (§1.1).

---

## 5. Self-critique

`apple-design` step 3: **would this same delta come out of a brief about a
different product that wanted to feel premium?**

For the first draft, **yes, three times over**, and that is the finding.

- "Deepen the ground so cards read as surfaces" — I would write that for a
  personal-finance app.
- "Raise the top of the type scale" — I would write that for anything.
- "Add a progress meter" — I would write that for a habit tracker.

Being correct is not the same as being about this product. Three things changed as
a result.

**A sunken well behind the board was cut.** The first draft added a
`--surface-sunken` token (light `#DCD5C6`, 1.16:1 below the ground) so the board
would sit in a recess. It is the reflexive move, it measured weakly, and — decisively
— **it contradicts both references**, which frame their board with no border, no
shadow, no radius and no recess (§1.1). The board earns presence from scale and
figure/ground, and it already has the scale. In its place Δ1 gained **rule 4:
elevation stops at the board's edge**, which is a constraint no generic premium
brief would produce, because no generic product has a board.

**The progress meter stopped being a horizontal bar.** A bar under a section
heading is the default and it would have introduced a second progress language
beside the coordinate rail, which is the design's signature. Moving it *into* the
rail — vertical, one character wide, same x, filling upward like a rank index —
means the thing that tells you where you are in the app is the same object that
tells you where you are on the board.

**The display size stopped being a display size.** `display-lg` alone is generic. It
is now defined as a *pair* — a 40 px UI headline that is never allowed to appear
without a 15 px `--font-index` notation line beneath it. The size is borrowed from
chess.com's ratio; the pairing is ours.

### Something else the critique caught

I was ready to call the checkpoint flag glyph decoration and delete it, on the
grounds that it appears on every checkpoint row with the same value in
`after/02-path--phone-390x844.png` — the distribution test from observation 0020.
Checking the source first: `src/path/PathSymbols.tsx` renders `CheckpointFlag` with
a `filled` prop, outline when unresolved and filled when resolved. It varies across
*states*, not across the rows in one screenshot. **It stays.** A screenshot samples
one state; a distribution argument needs the state space.

### And one thing to remove

**`--accent-soft` loses four of its five jobs.**

Grepped: it currently fills a prose chip (`src/lesson/LessonPlayer.tsx:216`), a
checkpoint prose chip (`src/checkpoint/CheckpointRoute.tsx:59` uses `--signal-soft`
the same way), an avatar disc (`src/play/ChooseOpponent.tsx:36`), the selected
segment of two segmented controls (`ChooseOpponent.tsx:59,84`) and a tested-out path
node (`src/path/PathScreen.tsx:143`). That is one colour meaning five different
things, which is the exact rule — "avoid using the same color to mean different
things" — that DESIGN-SYSTEM.md §3.1 built the palette around.

Keep **one**: the selected state of a segmented control, where a tint is the correct
and conventional affordance. Remove the other four:

- the two prose chips become plain prose on `--surface-raised` with a 2 px left rule
  in `--accent` / `--signal` — which is also what stops the lesson takeaway reading
  as a success banner (M-3);
- the avatar disc becomes `--surface-raised` with a 1 px `--edge-strong` ring;
- the tested-out node takes the `--key-accent` edge from Δ1 plus its `✓`, which is
  more information than a tint was carrying.

Net effect: one fewer tint layer on every screen, and a token that means one thing
again. If nothing could be removed I would say so. This can, and the design is
better without it.

---

## 6. Constraints this delta respects

| Constraint | How |
|---|---|
| **Light is primary** | Every value above is solved for light first; the dark value is derived and measured, never the driver. |
| **Dark still works** | Every new or changed token carries both values with a measured ratio (§4). |
| **4.5:1 body / 3:1 large and marks** | Re-measured against the *new* ground: content 13.53 / 15.94, dim 5.51 / 7.26, accent 5.90 / 8.69, signal 5.44 / 10.05, danger 5.88 / 7.87. `--edge-strong` improves from 3.08 to **3.31** on the light ground. `--accent` on `--track` is 4.63 / 5.38. |
| **44 px touch targets** | No control shrinks. The 3 px key edge is *added* below the face, so a 44 px button becomes 47 px. Re-run the sweep after Δ1 anyway. |
| **Visible focus rings** | Untouched. The 5 px inset ring geometry asserted by `tests/e2e/play.spec.ts:37`, `tests/audit-platform/a11y.spec.ts:95` and `tests/audit-platform/controls.spec.ts:5` is preserved exactly. `--accent` does not change value, so `tests/audit/audit-helpers.ts:256` is not affected either. |
| **Nothing by colour alone** | The Δ3 meter always carries its count in text. Completed state uses fill + weight + `✓`. Board marks are untouched and keep their distinct shapes. |
| **Reduced motion** | Nothing in this delta animates. No new motion is introduced anywhere. |
| **No emoji as icons** | No new glyphs. `CheckpointFlag` is a vector and stays (§5). |
| **390 px, no horizontal scroll** | The board is unchanged at ≈ 358 px. The Δ3 meter lives in the existing 16 px rail gutter and adds no width. The Δ4 Today board is 120 px inside an existing card. |
| **Largest text size survives** | `display-lg` at 200 % is 80 px; checked against the two strings that use it, both wrap inside 390 px. Declared in `rem`. |
| **298 unit / 113 Playwright tests green** | Presentation only, with two exceptions, both named: `src/path/PathScreen.test.tsx:66–67` (Δ3 copy change) and nothing else. Roles, accessible names and structure are unchanged everywhere. |
| **246 KB gzip of a 300 KB budget** | **Zero bytes added.** No web font, no image asset, no new dependency. Every change is a CSS custom property, a `border-bottom`, or a layout rule. The measured main chunk is 224,874 bytes gzipped today; this delta does not move it. Time-to-first-lesson is untouched. |
| **The coordinate rail survives** | It is not merely kept, it is **given more work** (Δ3). Its typography is unchanged and its test at `src/board/CoordinateRail.test.tsx:17` is untouched. §3.5 records that its face was verified in source, not assumed from pixels. |

---

## 7. Work plan

Four phases. Chunks inside a phase touch disjoint files and can be taken in
parallel by separate agents; phases are ordered because each depends on the tokens
the one before it lands.

### Phase P1 — Tokens and elevation

**Chunk P1a: the token layer.**
Change `--surface` and `--edge-strong` in both appearances; add `--key-accent`,
`--key-raised` and `--track` in both appearances; add the `display-lg` type role;
add a `t-display-lg` utility. Copy the measured ratios from §4 into the comments
beside each value, exactly as the file already does — they are not to be re-derived
by eye.
*Files:* `src/app/theme.css`.

**Chunk P1b: the key-edge rule, applied.**
Give the primary button a 3 px `--key-accent` bottom edge and cards and secondary
buttons a 2 px `--key-raised` bottom edge. Grep the whole of `src/` for any
`box-shadow` with a blur radius above 4 px and remove it. Re-run the 44 px target
sweep.
*Files:* `src/app/Button.tsx`, `src/screens/TodayScreen.tsx`,
`src/play/ChooseOpponent.tsx`, `src/app/Shell.tsx`.
*Depends on:* P1a.

**Chunk P1c: elevation stops at the board.**
Assert Δ1 rule 4 as a test: the board container, its squares and its marks carry no
`box-shadow`, no `border-radius` and no key edge in either appearance. This is a
guard, not a restyle — the board is already correct and must stay correct.
*Files:* `src/board/Board.test.tsx`, `tests/audit/audit-helpers.ts` (add the probe).
*Depends on:* P1a. **Touches the shared board: verify lesson, checkpoint and play.**

### Phase P2 — The Path: hierarchy, progress, completion

**Chunk P2a: the rail meter and the completed state.**
Build the vertical rail meter as a state of the existing rail component, not as a
new one. Add the completed node state (accent rail fill + weight 600 + `✓`). Add
the text count beside it in `--font-index`.
*Files:* `src/board/CoordinateRail.tsx`, `src/board/rail.ts`,
`src/board/CoordinateRail.test.tsx`, `src/path/PathScreen.tsx`,
`src/path/PathScreen.test.tsx`.
*Depends on:* P1a. **Touches the shared rail: verify the lesson board gutter and the
Path unit numbers both still render.**

**Chunk P2b: invert the checkpoint / active hierarchy, and the locked count.**
The active node gains `--surface-raised` plus the `--key-accent` edge. The checkpoint
drops from a filled `--signal-soft` slab to a `--signal`-outlined row; `--signal-soft`
is reserved for the *due* state only. Replace "Locked until you get there" with the
varying count.
**This chunk owns the one copy change in the delta and must update
`src/path/PathScreen.test.tsx:66–67` in the same commit. It must not touch
`tests/audit/path-today.spec.ts:43`.**
*Files:* `src/path/PathScreen.tsx`, `src/path/PathScreen.test.tsx`.
*Depends on:* P1a, P1b. **Shares `PathScreen.tsx` with P2a — take these two in
sequence, not in parallel.**

### Phase P3 — Type and the reward moment

**Chunk P3a: `display-lg` and the notation pairing.**
Apply `display-lg` to the lesson-close headline and the Today title, each with its
`--font-index` notation line beneath. Verify at 200 % text size at 390 px with no
horizontal scroll.
*Files:* `src/lesson/LessonPlayer.tsx`, `src/screens/TodayScreen.tsx`,
`src/lesson/LessonPlayer.test.tsx`.
*Depends on:* P1a.

**Chunk P3b: the lesson-close layout.**
Move the block to the optical centre, anchor the action to the bottom edge, close the
≈ 500 px void.
*Files:* `src/lesson/LessonPlayer.tsx` (the close-screen block).
*Depends on:* P3a. **Shares `LessonPlayer.tsx` with P3a — sequence them.**

### Phase P4 — Voids, and the removal

**Chunk P4a: the lesson screen, both widths.**
Anchor the primary action to the bottom on compact; put the coach's `◇` line in the
gap on both widths; on regular, restack the right column as prompt → coach →
challenge index → anchored action.
*Files:* `src/lesson/challenges/ChallengeView.tsx`, `src/coach/CoachBubble.tsx`,
`src/lesson/LessonPlayer.tsx`.
*Depends on:* P1b, P3b.

**Chunk P4b: a board on Today.**
Add the next lesson's starting position at 120 px, square, unframed, inside the
lesson card.
*Files:* `src/screens/TodayScreen.tsx`, `src/board/Board.tsx` (a size prop only, if
one is not already there).
*Depends on:* P1c. **Touches the shared board.**

**Chunk P4c: retire four of `--accent-soft`'s five jobs.**
Prose chips become prose with a 2 px left rule; the avatar disc becomes
`--surface-raised` with an `--edge-strong` ring; the tested-out node takes the key
edge and its `✓`. Keep only the segmented-control selected state.
*Files:* `src/lesson/LessonPlayer.tsx`, `src/checkpoint/CheckpointRoute.tsx`,
`src/play/ChooseOpponent.tsx`, `src/path/PathScreen.tsx`.
*Depends on:* P1a, P2b, P3b. **Last, because it touches four files three other
chunks own.**

**Chunk P4d: re-shoot and re-measure.**
Re-run the capture into `docs/design/after/` at both widths in both appearances.
Confirm the gzipped main chunk has not moved from 224,874 bytes. Re-run the 44 px
sweep and the contrast probes.
*Files:* `docs/design/after/` only.
*Depends on:* everything.
