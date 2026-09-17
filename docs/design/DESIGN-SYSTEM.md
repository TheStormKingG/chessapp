# ChessApp design system and redesign plan

| | |
|---|---|
| **Date** | 17 September 2026 |
| **Scope** | Design system, review of the shipped v1 UI, and a sequenced redesign plan |
| **Basis** | PRD v1.1 §1, §3, §7.3, §8.15; Concept-Note.md; Wireframes-v1.1.png; the build on `main` at `dist-e2e` |
| **Evidence** | 24 screenshots in `docs/design/before/`, captured at 390x844 and 1280x800 from a production build |
| **Guidance followed** | `apple-design` (five-lens review plus Design improvement mode), `anthropic-skills:impeccable`, `taste-skill:taste-skill` |

Design read: **a product-register app UI for adult chess beginners, phone-first and installed to the home screen, in a chess-platform visual language rather than a language-app one, built on Tailwind v4 CSS variables with the system type stack.**

---

## 1. The recommendation this document rejects

A generated recommendation proposed a **newsletter layout pattern, a cyan palette, and Baloo 2 paired with Comic Neue**. It is rejected in full. Four reasons, in descending order of seriousness.

**1. The type pairing is addressed to children, and the audience is adults who are embarrassed.** Baloo 2 is a rounded, heavy-terminal display family and Comic Neue is an explicit rehabilitation of Comic Sans; together they are the standard children's-education pairing. PRD §3.1 describes the primary learner as an adult aged roughly 16 to 45 who "wants to be good enough not to embarrass themselves". PRD §1.2 fixes the positioning: "the product looks and behaves like a chess platform that teaches, not a language app with a chess course". A rounded-cartoon type voice inverts that sentence. It takes the one thing the PRD explicitly refused (Duolingo's register) and makes it the most visible property of the interface. For a learner whose stated motivation is not looking foolish, being handed a children's typeface is an insult delivered before the first move.

**2. Cyan breaks the one rule the palette already has.** PRD and Concept-Note §11 fix green as the single accent for primary actions and completed work, and amber for review. Those are meaning assignments, not taste. Introducing cyan does not replace green cleanly, because green still has to mean "done"; it adds a second cool hue with no assigned meaning, so the interface would carry two accents and the learner would have to work out which one is actionable. "One colour means one thing" (`color.md > Best practices`) fails on arrival. Cyan also has no standing anywhere in chess's own vernacular of wood, stone, ivory and slate.

**3. A newsletter layout is a reading column, and no screen here is a reading surface.** Concept-Note §2: "A board at the top. The coach speaking beneath it. One primary action at the bottom." The board is a square that wants the full 390px width. A newsletter pattern is optimised for long linear prose with an inset measure and stacked article blocks; applied here it would inset the board, push the coach's line and the primary action below the fold on a phone, and give top billing to text that the PRD caps at 60 words per screen (§7.3).

**4. It costs bytes the budget does not have.** Measured on the current production build: the main chunk is 764,692 bytes raw, **226,382 bytes gzipped**, against a 300 KB JavaScript budget, with a 843 KB precache. Two web font families at two weights each is roughly 60 to 90 KB of additional render-blocking transfer plus extra connections, against a five-second-to-first-lesson target on 7 Mbps (PRD §1.3 principle 7). There is no room, and the thing being bought is a liability.

The system below therefore changes the palette on its own evidence, keeps green and amber's *meanings*, and ships **no web font at all**.

---

## 2. Review of the current UI

Five lenses, in apple-design's order. Citations name the HIG file and heading that were opened. Contrast figures are computed from the token hex values and from colours sampled live out of the running app, never estimated from the screenshots.

**Overall rating: Needs work.** The design's thesis is legible and correct: one board, one instruction, one action, quietly presented. The execution is a competent set of framework defaults with two genuine accessibility failures and no point of view. Nothing about it says chess. It would be remembered by nothing, and it says so itself: a five-item text tab bar, white rounded cards on warm grey, one green button per screen.

### Lens 1: Accessibility (Critical)

**C-1. The review amber fails contrast in every place it is used.** `--color-review: #b8860b` measures **2.98:1 on `--color-paper` #f6f5f0** and **2.77:1 on `--color-review-soft` #f7ecd0**. On the Path screen (`docs/design/before/02-path--phone-390x844.png`) the checkpoint node renders its title in that amber on that amber-soft fill at roughly 20px bold, which needs 3:1, and its subtitle "Attempt any time to test out" at 14px, which needs 4.5:1. Both fail. `accessibility.md > Color and effects`: "the contrast ratio between text and its background is at least 4.5:1". This is the only colour in the app that carries a product meaning the PRD assigns (amber marks review items), and it is the one that cannot be read.

**C-2. Board coordinates are rendered in two colours that exist in no token and fail badly.** Sampled from the live DOM in the lesson player: rank and file glyphs render at 13px in `rgb(181, 136, 99)` (#b58863) on the light square and `rgb(240, 217, 181)` (#f0d9b5) on the dark square. These are `react-chessboard`'s defaults for its own *wooden* board, leaking through because `Board.tsx` sets `lightSquareStyle` and `darkSquareStyle` but not the notation styles. Measured: **#b58863 on #e8e4d6 is 2.47:1**, **#f0d9b5 on #8fa889 is 1.88:1**. For a product whose first lesson is literally called "The board" and whose first challenge is "Tap e4", the coordinates being the least readable text in the app is not a small defect. Same citation as C-1.

**C-3. Locked path nodes sit at 4.49:1.** `--color-ink-muted` #5f6763 on the locked node fill #e3e2dc is 4.49:1 against a 4.5:1 requirement. A rounding error rather than a design failure, but it fails.

**C-4. There is no dark appearance.** `theme.css` defines one light palette and no `prefers-color-scheme` block anywhere in the app. `dark-mode.md > Overview`: "In macOS, iOS, and iPadOS, people often choose dark mode as their default interface style". An installed PWA opened at night on an OLED phone is exactly the "adult beginner, ten spare minutes" context PRD §3.3 job 5 describes. This is the single largest piece of work in the plan.

**C-5. Two controls render in the browser's default blue.** The Coach mode checkbox on Choose opponent (`07-choose-opponent--phone-390x844.png`) and the focus ring on the move input (`08-game-in-play--phone-390x844.png`) are both system blue, a hue that appears in no token. The app therefore ships a third accent colour by accident, in the one place a beginner is told what coaching they will get.

**Fine, and worth keeping:** every interactive element measured at or above 44px (a live sweep of every `a`, `button`, `input` and `[role=button]` on the Path screen returned an empty list of undersized targets); body text is 16px; `prefers-reduced-motion` is globally honoured in `theme.css`; the board's highlight kinds already differ in *shape* as well as colour, which satisfies PRD F-AX-2 properly rather than nominally; and `Board.tsx` contains a genuinely careful piece of screen-reader work neutralising `dnd-kit`'s 32 spurious tab stops. That comment block should survive any redesign untouched.

### Lens 2: Platform conventions (High)

**H-1. The lesson and the game are modal tasks rendered inside the global tab bar.** Every lesson screen, the lesson close screen, and the in-play game keep the five-tab bottom bar (visible in screenshots 03 through 08). The lesson already has an `✕` in its top-left, so the interface offers two contradictory models at once: a modal with a close affordance, and a browsable tab section. `modality.md > Best practices`: "Use a modal experience when it's critical to get someone's attention... Provide an obvious way to dismiss a modal view." `tab-bars.md > Best practices`: "Use a tab bar to support navigation, not to provide actions." Tapping Puzzles mid-game silently abandons the position. This is the highest-value structural fix in the plan and it costs nothing in tokens.

**H-2. The tab bar is text only.** Five word labels, no symbols, at 12px. `tab-bars.md > Best practices` prefers filled symbols with short labels; a symbol-free bar gives the eye nothing to land on and makes the active state carry entirely on weight and colour.

**H-3. The desktop layout is not a design.** At 1280x800 (`04-lesson-challenge--desktop-1280x800.png`) the rail is 180px of empty white below five links, the board sits at roughly 260px wide on the left, the prompt "Tap e4." floats at the top of the right column and the Hint and Show me buttons float in the middle of it with a large vertical void between them, and the whole composition is pinned left of a wide empty margin. The wireframes' desktop panel (panel 21) shows the intended three-part side-by-side arrangement with the lesson card and challenge list in the right column. The build reaches the desktop breakpoint and then has nothing to put there. `layout.md > Best practices`: "Make sure your layout adapts to the available space."

### Lens 3: Visual design and craft (High / Medium)

**H-4. Green means two different things, and one of them is the board.** `--color-accent` #1f5f4a (primary actions, completion) and `--color-square-dark` #8fa889 (half the board) are the same hue family. The board therefore reads as accent-coloured furniture, and the green button loses the exclusivity that makes it mean "this is the action". `color.md > Best practices`: "Use color to communicate, not to decorate... avoid using the same color to mean different things." The fix is to take green off the board entirely, which is also what a real chess set does.

**H-5. The Path is nine identical grey cards and the distinction it is hiding is state.** In `02-path--phone-390x844.png`, eight of the ten visible nodes carry the word "Locked" and an identical grey fill; a label whose value is constant across most of a set is a section heading printed eight times, not per-item information. Meanwhile the checkpoint, which is the only node that behaves differently (attemptable early, unlocks the unit), is distinguished only by an unreadable amber and an emoji. Group the locked run, promote "Locked" to one boundary, and spend the visual difference on the checkpoint and on the active node.

**H-6. The checkpoint node uses an emoji as an icon.** `PathScreen.tsx:72` renders `🏁`. That is a colour-font glyph whose rendering the app does not control, it ignores the text colour, and it violates the project's own stated constraint. The `✓`, `•`, `★` and `♛` characters elsewhere in `LessonPlayer.tsx` and `PlayScreen.tsx` are monochrome typographic characters, not emoji, and may stay; `♛` for crowns is in fact the most on-brand mark in the codebase.

**M-1. Card boundaries are invisible.** `--color-line` #e3e2dc measures **1.30:1 on card white** and **1.19:1 on paper**. Where a hairline is the only thing separating a control from its background, `accessibility.md > Color and effects` wants 3:1. In practice the cards on Today and Choose opponent read as floating white rectangles with no edge.

**M-2. On the game screen, Resign carries the same weight as Hint.** Four equal ghost buttons in a 2x2 grid (`08-game-in-play`). `buttons.md > Style` distinguishes prominence by role; a destructive, irreversible action presented identically to a help action is a hazard, and `alerts.md` wants destructive actions to be distinguishable and confirmable.

**M-3. The lesson close screen centres its body text and fills 60% of the screen with nothing.** Three stars, a centred two-line takeaway inside an accent-tinted chip that reads as a success banner rather than a lesson, +10 XP, one button, then 900px of empty paper above a tab bar that should not be there.

**M-4. Stars do not distinguish earned from unearned.** `LessonPlayer.tsx:302` renders `★` repeated and `☆` repeated in the same ink colour. At two stars out of three the difference is carried by glyph outline alone at small size.

**Craft: there is no point of view.** Asked to name the one thing this design would be remembered by, the honest answer is nothing. It is warm-grey ground, white rounded cards, one green fill, system type, 16px everywhere, generous radius. That is the current default look of a generated app, and it is not wrong so much as absent. `design-principles.md` lists Craft and Delight; this design has the first in its accessibility code and none of the second anywhere on screen. The product it is wrapping has a 500-year-old visual vocabulary sitting unused on every screen.

### Lens 4: Interaction (Medium)

**M-5. The engine gate is the app's longest wait and the plan has no picture of it.** The capture run needed up to 150 seconds for the move input to appear after Start game while Stockfish downloads. There is an `EngineDownload` component, but nothing in the reviewed screens shows determinate progress at the moment the learner has just committed to a game. `loading.md > Best practices`: "Whenever possible, show progress in a determinate way."

**Fine:** the not-found screen is genuinely good. One sentence naming the actual path, two labelled exits, no apology, no illustration. Keep it exactly as it is.

**Noted, not a finding:** Puzzles and Progress are honest one-line placeholders for unbuilt features. That is the right behaviour and no design work is owed to them yet.

### Lens 5: Content and writing (Medium)

**M-6. The coach is not on screen.** PRD §1.2 and Concept-Note §2 make one coach persona, warm and dry, a first-class part of every screen; `CoachBubble.tsx` exists. In the twelve captured screens the coach speaks nowhere, including during a coached game with Coach mode explicitly enabled. The interface currently has no voice at all, which is the largest gap between the wireframes and the build.

**Fine:** "Attempt any time to test out", "Solid and patient. Trades when she can and hates leaving pieces loose, but she still does.", "Nothing in ChessApp lives at /no-such-page." The copy that exists is in the right voice. It just barely exists.

---

## 3. The token system

Six named roles plus a board group. All values are given for both appearances with the measured contrast ratio against the surface they are used on. Every ratio in this section was computed from the hex values with the WCAG relative-luminance formula, not estimated.

### 3.1 Colour

Strategy, in impeccable's terms: **restrained**. Tinted neutrals plus one accent used on well under 10% of any screen, plus one signal. That is the correct register for a product surface whose job is to disappear behind a board. The scene sentence that decides the two appearances: *an adult on the sofa at 9pm with the room lights low, and the same person at a kitchen table at lunchtime.* Both are real, so both appearances are first-class and neither is the "real" one.

The structural change from the current palette is that **green comes off the board**. Green becomes exclusively the colour of action and completion; the squares become neutral warm stone. This restores one-colour-one-meaning and is also what a physical chess set looks like.

#### Surface and content

| Token | Light | Dark | Measured |
|---|---|---|---|
| `--surface` | `#F4F2ED` | `#121514` | page ground |
| `--surface-raised` | `#FBFAF7` | `#1C211F` | cards, sheets, the tab bar |
| `--content` | `#1A1D1B` | `#E9ECE9` | **15.19:1** on light surface, **15.43:1** on dark |
| `--content-dim` | `#565B58` | `#9AA29E` | **6.19:1** light, **7.03:1** dark |
| `--edge` | `#DCD8CF` | `#2A302D` | hairlines only, decorative, no contrast duty |
| `--edge-strong` | `#8E8A80` | `#6F7874` | **3.08:1** light, **4.04:1** dark. Every control border, every card boundary that is the only separator |

Neither neutral is pure: both are tinted toward the board's stone, per impeccable's rule against `#000` and `#fff` as surfaces. `--edge` and `--edge-strong` are split deliberately, because M-1 was caused by one token being asked to do a decorative job and a load-bearing one at once.

#### Accent (primary action, completed work)

| Token | Light | Dark | Measured |
|---|---|---|---|
| `--accent` | `#12614A` | `#4FC48E` | **6.62:1** on light surface, **8.41:1** on dark surface |
| `--accent-on` | `#FFFFFF` | `#08130E` | **7.41:1** on light accent, **8.67:1** on dark accent |
| `--accent-soft` | `#D7E9E0` | `#123128` | `--content` on it: **13.45:1** light, **11.79:1** dark |

#### Signal (review, due)

| Token | Light | Dark | Measured |
|---|---|---|---|
| `--signal` | `#7A5310` | `#E9B454` | **6.11:1** on light surface, **9.73:1** on dark surface |
| `--signal-soft` | `#F6E9CE` | `#33280F` | `--signal` on it: **5.68:1** light, **7.66:1** dark |

This is the direct fix for C-1. The old `#b8860b` at 2.98:1 becomes `#7A5310` at 6.11:1 in light and a genuinely bright `#E9B454` at 9.73:1 in dark. The hue is still unmistakably amber; it is simply dark enough to read.

#### Danger (destructive UI only, never the board)

| Token | Light | Dark | Measured |
|---|---|---|---|
| `--danger` | `#9B2F2F` | `#F08A8A` | **6.61:1** light, **7.62:1** dark |

#### The board

The squares are part of the palette, and they have their own contrast rules because they are not a text-on-background pair.

| Token | Light | Dark |
|---|---|---|
| `--board-light` | `#E9E1D2` | `#8A7E6C` |
| `--board-dark` | `#94876F` | `#574F42` |
| `--piece-light` | `#FBFAF7` | `#F7F5F0` |
| `--piece-dark` | `#17191A` | `#16181A` |
| `--mark-good` | `#0B3D2E` | `#B6F5D8` |
| `--mark-review` | `#4A3306` | `#F7DFAC` |

Square-to-square contrast is **2.71:1** light and **2.03:1** dark. That is deliberate and it is not a failure: WCAG's 3:1 non-text rule applies to boundaries that carry information on their own, and a chess square's identity is carried by its position in an alternating 8x8 grid and by the coordinate rail beside it, not by its fill. A physical tournament board is about 2:1. Pushing the squares to 3:1 would make the board vibrate and would cost the pieces their legibility, which is the more important requirement.

**The piece rule, stated so an implementer can test it.** Every piece is drawn with a fill and a 1.5px outline in the opposing piece colour. For every piece-on-square combination, `max(fill contrast, outline contrast)` must be at least 3:1:

| | on `--board-light` | on `--board-dark` |
|---|---|---|
| Light piece, light appearance | fill 1.24, outline **13.58** | fill **3.38** |
| Dark piece, light appearance | fill **13.58** | fill **5.00** |
| Light piece, dark appearance | fill **3.65** | fill **7.41** |
| Dark piece, dark appearance | fill **4.48** | fill 2.21, outline **7.41** |

All eight combinations clear 3:1. In the current build the same rule is passed only by accident, because the library's piece sprites happen to carry outlines.

**Board marks.** Both mark colours clear 3:1 against *both* squares in their own appearance, which is the test the current `rgba(31,95,74,0.75)` accent ring does not meet on the dark square:

| Mark | on `--board-light` | on `--board-dark` |
|---|---|---|
| `--mark-good` light `#0B3D2E` | **9.39** | **3.46** |
| `--mark-review` light `#4A3306` | **9.15** | **3.37** |
| `--mark-good` dark `#B6F5D8` | **3.23** | **6.55** |
| `--mark-review` dark `#F7DFAC` | **3.05** | **6.19** |

Meaning is still carried by shape first, exactly as `Board.tsx` already does it: good is a thick inset ring, review is a dashed outline, the refuted square is a diagonal hatch. Colour is the second channel, never the only one.

**Board notation is not a board colour.** C-2 is fixed structurally rather than by recolouring: rank and file glyphs move off the squares into the gutter, in `--content`, at full contrast. See the signature below.

### 3.2 Type

**No web font ships.** The justification is measured, not aesthetic: the production build is already **226,382 bytes gzipped of a 300 KB JavaScript budget**, with an 843 KB precache, against a five-second-to-first-lesson target on 7 Mbps (PRD §1.3 principle 7). A two-weight variable display face is 30 to 60 KB of render-blocking transfer plus a connection, and it would buy a quality the system stack already delivers. `typography.md > Best practices`: "In general, use a single typeface... the system fonts are designed for legibility at every size."

Two stacks, both free:

- `--font-ui` — `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. Navigation, controls, headings, prose, the coach's voice.
- `--font-index` — `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, 'Roboto Mono', Consolas, monospace`, with `font-variant-numeric: tabular-nums`. Every coordinate and every counter.

**Where the personality lives.** Not in a display face. It lives in the mono index voice, and that is a deliberate reversal of the obvious move: see §5. Chess already has a typographic system of its own, algebraic notation, and it is the one piece of visual language the product has been throwing away.

| Role | Size | Line height | Weight | Face | Used for |
|---|---|---|---|---|---|
| `display` | 30px | 34px | 700 | ui | Screen titles: Today, Path, Progress |
| `title` | 22px | 28px | 700 | ui | Lesson titles, section titles, Lesson done |
| `heading` | 17px | 24px | 600 | ui | Card titles, path node titles |
| `body` | 17px | 26px | 400 | ui | Coach voice, prose, explain screens |
| `body-strong` | 17px | 26px | 600 | ui | The challenge prompt |
| `label` | 15px | 20px | 500 | ui | Buttons, tab labels, form labels |
| `caption` | 13px | 18px | 500 | ui | Metadata that is never the sole carrier of meaning |
| `index` | 15px | 20px | 500 | index | Counters, clock, rating, XP, move numbers |
| `index-small` | 12px | 16px | 600, +0.04em | index | Board rank and file glyphs, path unit numbers |

Body rises from the current 16px to 17px, matching the iOS default of 17pt and clearing the 16px mobile minimum with room for Dynamic Type. All sizes are declared in `rem` so browser and OS text scaling works; `caption` at 13px is above the 11pt floor in `typography.md > Specifications` and carries nothing that is not also stated elsewhere.

### 3.3 Layout

Spacing scale, 4-based, in `rem`: **2, 4, 8, 12, 16, 20, 24, 32, 40, 56**. Gutter is 16 on compact and 24 on regular. Vertical rhythm varies by role rather than being uniform: 8 inside a control, 12 between related lines, 24 between groups, 40 above a screen's primary action.

Radius, one system: **10px** on cards and controls, **999px** on nothing, **0** on the board and its squares. The board is the only square-cornered element in the app, which is itself a small piece of the signature.

#### The lesson screen

One sentence: the board is the subject, the prompt sits directly above it so the eye reads instruction then position without crossing anything, the coach speaks below it, and the single action is anchored at the bottom; the tab bar is gone because a lesson is a modal task.

Compact (390px):

```
┌──────────────────────────────────────┐
│ ✕            1.1.1 · The board   3/6 │  title / index (mono)
├──────────────────────────────────────┤
│ Tap e4.                              │  body-strong, left
│                                      │
│ 8 ┌────┬────┬────┬────┬────┬────┐    │  ← index-small rail
│ 7 │    │    │    │    │    │    │    │    in --content,
│ 6 ├────┼────┼────┼────┼────┼────┤    │    in the gutter,
│ 5 │    │    │    │    │    │    │    │    NOT on the squares
│ 4 ├────┼────┼────┼────┼────┼────┤    │
│ 3 │    │    │    │    │    │    │    │
│ 2 ├────┼────┼────┼────┼────┼────┤    │
│ 1 │    │    │    │    │    │    │    │
│   └────┴────┴────┴────┴────┴────┘    │
│     a    b    c    d    e    f       │
│                                      │
│ ◇ The knight on c7 attacks two       │  coach, body
│   things at once.                    │
│                                      │
│ [ Hint ]            [ Show me ]      │  secondary, --edge-strong
├──────────────────────────────────────┤
│ ███████  Play the move  ███████████  │  accent, anchored
└──────────────────────────────────────┘
```

Regular (1280px):

```
┌────────┬──────────────────────────────┬──────────────────────┐
│ ChessApp│ ✕     1.1.1 · The board  3/6 │                      │
│        ├──────────────────────────────┤ Tap e4.              │
│ ▣ Today│ 8 ┌───┬───┬───┬───┬───┬───┐  │                      │
│ ◈ Path │ 7 │   │   │   │   │   │   │  │ ◇ The knight on c7   │
│ ◉ Puzz │ 6 ├───┼───┼───┼───┼───┼───┤  │   attacks two things │
│ ♞ Play │ 5 │   │   │   │   │   │   │  │   at once.           │
│ ▤ Prog │ 4 ├───┼───┼───┼───┼───┼───┤  │                      │
│        │ 3 │   │   │   │   │   │   │  │ THIS LESSON          │
│        │ 2 ├───┼───┼───┼───┼───┼───┤  │ 1.1.1 ✓ Explain      │
│ ── 12  │ 1 │   │   │   │   │   │   │  │ 1.1.2 ✓ Which piece  │
│ streak │   └───┴───┴───┴───┴───┴───┘  │ 1.1.3 ● Tap e4       │
│        │     a   b   c   d   e   f    │ 1.1.4 ○ Find the fork│
│ Settings│                              │                      │
│        │ [ Hint ]    [ Show me ]      │ ███ Play the move ███│
└────────┴──────────────────────────────┴──────────────────────┘
```

The right column is what fills the void in H-3: the challenge index, set in the mono face, is real content the screen already owns.

#### The play screen

One sentence: the opponent and the clock frame the board top and bottom so the two people in the game bracket the position, the coach's single line sits under the board where the lesson's coach line sits, and the four controls are ranked instead of tiled.

Compact (390px):

```
┌──────────────────────────────────────┐
│ ✕   Rosa · 600              10:00    │  name / clock (mono)
│                                      │
│ 8 ┌────┬────┬────┬────┬────┬────┐    │
│ … │    │    │    │    │    │    │    │
│ 1 └────┴────┴────┴────┴────┴────┘    │
│     a    b    c    d    e    f       │
│                                      │
│ You · 600                    9:41    │  mono, mirrors the top
│                                      │
│ ◇ That knight is loose now.          │  coach, one line, max
│                                      │
│  1. e4   e5    2. Nf3  Nc6           │  index, tabular, 2 cols
│                                      │
│ [ Hint ]  [ Threats ]  [ Take back ] │  secondary row
│ Resign                               │  text only, --danger
├──────────────────────────────────────┤
│ ███████  Your move  ██████████████   │  accent, or move input
└──────────────────────────────────────┘
```

Regular (1280px): the rail on the left, the board centred in the middle column at its natural square size, and the right column carrying opponent, clock, coach line, move list and controls in one vertical stack, so the void in H-3 is filled by the game record rather than by nothing.

---

## 4. The signature

**The coordinate rail.**

A single character-wide column running down the left edge of the board on every surface, set in `--font-index` at `index-small`, in `--content` at full contrast, in the gutter rather than on the squares. And the same rail, at the same x-position, in the same face, carries the index of whatever the current screen is indexing: the ranks 8 to 1 on a board, the challenge numbers 1 to 6 in a lesson, the unit numbers 1.1.1 to 1.1.8 on the path, the move numbers in a game, the dates on a streak. One vertical index column, always in the same place, always monospaced, always the same width.

**Why it belongs to chess and not to any calm app.** Rank-and-file indexing is chess's own wayfinding system and it is not borrowed from anywhere: a1 to h8 is how every chess player who has ever lived has said where something is. The product's very first lesson teaches it. Adopting it as the app's index system means the thing that orients a learner inside a position is literally the same thing that orients them inside the app, so learning the interface and learning the notation are one act. A calm app could adopt a warm palette, generous space and a green button; it could not adopt this, because it has no ranks and no files.

**It is not decoration, it repairs two measured defects.** It replaces the 1.88:1 notation of C-2 with full-contrast text in a gutter where nothing can sit behind it, and it replaces the meaningless grey bullet beside every path node (`PathScreen.tsx:72`) with the unit number the node already has. It costs nothing: the system mono stack is free, and the rail is 16px of gutter that the board is already inset by on compact widths.

**The boldness is spent here and nowhere else.** No gradient, no glass, no shadow, no illustration, no second accent. Everything around the rail and the board is deliberately quiet, which is `branding.md > Best practices`: "Branding is most effective when it's subtle and unobtrusive."

---

## 5. Self-critique

apple-design step 3 asks the uncomfortable question: **would I have produced this same plan for a different product with a similar brief?**

For most of it, yes, and that is a finding. "Tinted warm neutral ground, one green accent at under 10%, one amber signal, system type stack, 4-based spacing, 10px radius, restrained motion" is what I would write for a meditation app, a habit tracker, a language course or a personal-finance tool given a similar brief. Those parts are correct but they are defaults, and correctness is not the same as a point of view.

**What changed as a result.**

**The display typeface was cut.** The first version of this plan gave the app a personality face for display text: a grotesk for titles, system type for controls, which is the standard studio answer and precisely the move I would have made for any of those four other products. Two things killed it. First, the measured budget: 226 KB gzipped of 300 KB is already spent, and PRD §1.3 principle 7 is a hard constraint, not an aspiration. Second, and more decisively, it was aimed at the wrong place. The distinctive thing about this product is not its headings; a learner spends almost no time reading a title and a great deal of time reading a board. Putting the identity into display text would have spent the one expressive budget the app has on the least-looked-at pixels. So the personality moved to the mono index voice, which is looked at constantly, which is chess's own language, and which costs zero bytes. That reversal is the substantive difference between this plan and the generic one.

**Green came off the board.** The first version kept `--color-square-dark` in the sage green family because it is what chess.com does and it looked fine. Measuring it against the accent showed the two were the same hue doing two different jobs (H-4). Neutral stone squares are not a stylistic preference; they are what makes the green button mean something.

**The board marks stopped inheriting the UI accent.** The first version reused `--accent` for the board highlight, as the current code does. Computing it showed `#12614A` at 2.1:1 against the dark square. Board marks became their own appearance-specific tokens tested against both squares.

**And one thing to remove.**

**Red comes off the board.** `--color-danger` currently appears as a board highlight in `Board.tsx`'s `HIGHLIGHT_STYLES.danger` and in `ARROW_COLORS.danger`. Removing it: the board goes from three highlight hues to two. The reasons are real rather than tidy. A green-and-red pair on a board is the worst possible combination for the most common colour vision deficiency, and although F-AX-2 is satisfied by shape here, satisfying a rule is not the same as being easy to look at. More importantly, three board meanings is one more than a beginner should have to hold: the board says "here" (good, ring) and "look again" (review, dashed or hatched), and the *refutation* is already shown by an animated opponent reply, which is far more informative than a red square. `--danger` stays in the system for destructive UI (Resign, delete progress) where it is the right colour and the only one.

If nothing else could be removed I would say so. This one can, and the design is better with two board meanings than three.

---

## 6. Motion

| Token | Value | Used for |
|---|---|---|
| `--motion-fast` | 120ms | Control state: press, toggle, focus |
| `--motion-piece` | 180ms | A piece moving between squares |
| `--motion-screen` | 240ms | Screen and sheet transitions |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Everything |

One easing curve, ease-out quart. No bounce, no elastic, no spring. Only `transform` and `opacity` are animated; no layout property is ever animated. There are no entrance animations, no scroll reveals, and no celebration effects, because `motion.md > Best practices` asks for motion that is "purposeful" and "brief" and warns against motion on frequent interactions, and a learner does five to ten challenges in a row.

**The one orchestrated moment: the refutation replay.** After a wrong move in a lesson or a challenge, the opponent's punishing reply plays as a single `--motion-piece` slide, the destination square takes the hatch mark, and the coach's line arrives as the slide lands. This earns its place because here motion *is* the content: the whole product thesis is that mistakes are the material (PRD §1.3 principle 1), and the difference between "that was wrong" and understanding *why* is watching the piece travel. It is the only place in the app where a still frame is genuinely less informative than a moving one. It also already exists conceptually in the code, as `refutationArrows` in the test helpers.

**Reduced motion has a full answer, not a suppression.** Under `prefers-reduced-motion: reduce` the refutation does not animate: the reply piece appears at its destination instantly, the hatch mark and the refutation arrow persist for 2 seconds instead of 200 milliseconds, and the move is announced in SAN through the board's existing live region. The information is identical; only the delivery changes. The current blanket `* { animation: none !important; transition: none !important; }` in `theme.css` is the right instinct but the wrong instrument, because it also kills the persistence timing that the reduced-motion path needs; it should become a scoped rule plus a JS-level `matchMedia` branch, which `Board.tsx` already has in `prefersReducedMotion()`.

---

## 7. Work plan

Sequenced accessibility, then conventions, then craft, then polish. Each chunk names the files it touches. Chunks within a phase touch disjoint file sets and can be taken in parallel; phases are ordered.

### Hard constraints every chunk must respect

1. **252 unit tests and 95 Playwright tests are green and must stay green.** Many assert on accessible names, roles and visible text. **Structure and semantics stay; presentation changes.** Run `npm test` and `PREVIEW=1 npx playwright test` before and after every chunk.
2. **Two tests assert on literal colour values and will break if the accent hex changes without them.** `tests/audit/audit-helpers.ts:256` matches `rgba(31, 95, 74, 0.75)` inside the accent ring's `box-shadow`. Any chunk changing `--accent` must update that regex in the same commit. By contrast `tests/e2e/play.spec.ts:37`, `tests/audit-platform/a11y.spec.ts:95` and `tests/audit-platform/controls.spec.ts:5` match on the ring *geometry* (`0px 0px 0px 5px inset`), which is deliberate and must be preserved: **keep the 5px inset ring geometry exactly.**
3. **Every touch target stays at least 44px.** The current build passes; do not regress it. Re-run the sweep after any control restyle.
4. **Contrast: 4.5:1 for body text, 3:1 for large text and for any non-text boundary that is the sole carrier of meaning.** Board squares are the stated exception in §3.1; board marks and pieces are not, and must pass the tables in §3.1.
5. **Focus rings stay visible in both appearances**, and must stop using the browser default blue.
6. **Nothing is conveyed by colour alone.** Board highlight kinds keep their distinct shapes.
7. **Reduced motion is respected**, per §6.
8. **No emoji as icons.** Monochrome typographic characters (`✓ • ★ ☆ ♛ ✕`) are not emoji and may stay.
9. **The board component is shared by every surface; changing it changes everything.** Any `Board.tsx` change is verified against the lesson, checkpoint and play flows, not just the one being worked on.

### Phase 1: Accessibility

**Chunk A1: the token file.** Replace the single light palette with both appearances as CSS custom properties under `:root` and `@media (prefers-color-scheme: dark)`, using the names and values in §3.1 and §3.2. Keep the existing Tailwind `@theme` colour names as aliases pointing at the new variables so no component's class names have to change in this chunk. Replace the blanket reduced-motion rule with the scoped version in §6.
*Files:* `src/app/theme.css`.

**Chunk A2: the review amber.** Nothing to do beyond A1 for the token itself; verify the fix at the two use sites and confirm the checkpoint node now measures 6.11:1 and 5.68:1.
*Files:* `src/path/PathScreen.tsx` (verification only, no change expected).
*Depends on:* A1.

**Chunk A3: board colours, notation and piece rule.** Move `lightSquareStyle` / `darkSquareStyle` off hardcoded `#e8e4d6` / `#8fa889` and onto the new CSS variables read at render. Set `react-chessboard`'s notation styles so the leaked `#b58863` / `#f0d9b5` can never render, and hide the in-square notation in favour of the gutter rail from chunk C1. Recolour `HIGHLIGHT_STYLES` and `ARROW_COLORS` to `--mark-good` / `--mark-review`, **keeping the 5px inset geometry**, and delete the `danger` board entries per §5. Update the colour regex in the test helper in the same commit.
*Files:* `src/board/Board.tsx`, `src/board/types.ts`, `tests/audit/audit-helpers.ts`.
*Depends on:* A1. **Touches the shared board: verify lesson, checkpoint and play.**

**Chunk A4: focus rings and form controls.** Replace the browser-default blue focus ring with a two-layer ring in `--accent` plus `--surface` that reads on both appearances, and restyle the Coach mode checkbox so it stops rendering in system blue.
*Files:* `src/app/theme.css` (focus-visible base), `src/play/ChooseOpponent.tsx`, `src/board/TextMoveEntry.tsx`.
*Depends on:* A1.

**Chunk A5: dark appearance sweep.** Find every remaining hardcoded colour outside `theme.css` and route it through a token; verify all twelve screens in both appearances against the `docs/design/before/` set.
*Files:* `src/app/Shell.tsx`, `src/screens/*.tsx`, `src/path/PathScreen.tsx`, `src/lesson/LessonPlayer.tsx`, `src/lesson/challenges/*.tsx`, `src/play/*.tsx`, `src/checkpoint/CheckpointRoute.tsx`, `src/pwa/*.tsx`, `src/coach/CoachBubble.tsx`.
*Depends on:* A1 through A4. This is the largest chunk; split by directory if two agents take it.

### Phase 2: Conventions

**Chunk B1: lift the modal tasks out of the tab bar.** Render `/lesson/:id`, `/checkpoint/:unit` and `/play/game` outside `Shell`, so a modal task has one way out (its own `✕`) rather than two contradictory ones. The routes, their headings and their accessible names do not change; only the chrome around them does.
**One test asserts the opposite of this change and must be updated in the same commit.** `tests/audit-platform/shell.spec.ts:29`, in the `deep links load directly` test, navigates to `./lesson/1.1.1` and asserts `getByRole('navigation', { name: 'Main' })` is visible. That assertion encodes the current behaviour, not a requirement: its stated intent, in the comment two lines below, is that the deep link renders something rather than an empty `<main>`. Replace the navigation assertion with an assertion that the lesson's own dismiss control is present, keep the `not.toBeEmpty()` check, and leave the same test's `./play/game` half alone since it never asserted the nav.
*Files:* `src/app/routes.tsx`, `src/app/Shell.tsx`, `src/app/routes.test.tsx`, `src/app/Shell.test.tsx`, `tests/audit-platform/shell.spec.ts`.

**Chunk B2: tab bar symbols.** Add one monochrome vector symbol per tab from a single family at a matched weight, each with the existing text label retained (the labels are asserted in tests; they stay). No emoji.
*Files:* `src/app/Shell.tsx`, plus a new `src/app/TabIcon.tsx`.

**Chunk B3: the desktop layout.** Build the three-column regular-width layout from §3.3: rail, board column, content column carrying the challenge index on lessons and the game record on play. Fill the void described in H-3.
*Files:* `src/app/Shell.tsx`, `src/lesson/LessonPlayer.tsx`, `src/play/PlayScreen.tsx`.
*Depends on:* B1. **Verify against `tests/audit/lesson-desktop.spec.ts` and `tests/audit-platform/desktop.spec.ts`.**

### Phase 3: Craft

**Chunk C1: the coordinate rail.** Build it once as a component and use it on the board gutter, the lesson challenge index and the path unit numbers. This is the signature and it should be implemented by one agent in one pass so it stays identical everywhere.
*Files:* new `src/board/CoordinateRail.tsx`, `src/board/Board.tsx`, `src/lesson/LessonPlayer.tsx`, `src/path/PathScreen.tsx`.
*Depends on:* A3. **Touches the shared board.**

**Chunk C2: the path.** Group the locked run under one boundary instead of repeating "Locked" eight times, give the active node and the checkpoint the visual difference that repetition was spending, and **replace the `🏁` emoji at `PathScreen.tsx:72`** with a vector symbol or the unit's rail number.
*Files:* `src/path/PathScreen.tsx`, `src/path/PathScreen.test.tsx`.
*Copy note:* "Locked" moves from a per-node visible subtitle to a group boundary. **The accessible name must not move with it.** `tests/audit/path-today.spec.ts:43` locates a node by the exact accessible name `1.1.2 The rook. Locked` and asserts `aria-disabled="true"` on it. That name is the correct one for a screen reader whatever the visible grouping does, so it stays verbatim on every locked node and this chunk must not touch that spec. Only the visible per-node subtitle is removed. Check `src/path/PathScreen.test.tsx` for any assertion on the visible string and update that one if present.

**Chunk C3: the type scale.** Apply the §3.2 roles; body 16px to 17px; introduce `--font-index` with tabular numerals on every counter, clock, rating, XP and move number. Sizes in `rem`.
*Files:* `src/app/theme.css`, then a sweep of every `.tsx` under `src/screens`, `src/lesson`, `src/play`, `src/path`.
*Depends on:* A1, C1.

**Chunk C4: button hierarchy and the game controls.** Three prominence levels (primary filled accent, secondary bordered `--edge-strong`, text-only), and rank the play controls accordingly: Hint and Threats secondary, Take back secondary, **Resign text-only in `--danger` with a confirmation**, per M-2.
*Files:* new `src/app/Button.tsx`, `src/play/PlayScreen.tsx`, `src/lesson/challenges/ChallengeView.tsx`, `src/screens/NotFoundScreen.tsx`.

**Chunk C5: the coach gets a voice on screen.** Wire `CoachBubble` into the lesson challenge screen and the play screen so the persona PRD §1.2 specifies is actually present, with a leading `◇` mark and body type, one line maximum during play.
*Files:* `src/coach/CoachBubble.tsx`, `src/lesson/challenges/ChallengeView.tsx`, `src/play/PlayScreen.tsx`.

**Chunk C6: the lesson close screen.** Left-align the takeaway, take it out of the accent-tinted chip so it reads as a lesson rather than a banner, distinguish earned from unearned stars by fill *and* shape (not ink alone, per M-4), and anchor the action.
*Files:* `src/lesson/LessonPlayer.tsx` (the `ph.stars` block at ~line 300), `src/lesson/LessonPlayer.test.tsx`.
*Depends on:* B1, C3, C4.

### Phase 4: Polish

**Chunk D1: the refutation replay.** Implement the orchestrated moment and its reduced-motion path per §6.
*Files:* `src/board/Board.tsx`, `src/lesson/challenges/ChallengeView.tsx`.
**Touches the shared board.**

**Chunk D2: the engine gate.** Give the Stockfish download a determinate progress state at the moment the learner has just pressed Start game, per M-5.
*Files:* `src/play/EngineGate.tsx`, `src/pwa/EngineDownload.tsx`.

**Chunk D3: card and control edges.** Move every card boundary and control border onto `--edge-strong`, decorative dividers onto `--edge`, per M-1.
*Files:* `src/screens/*.tsx`, `src/play/ChooseOpponent.tsx`, `src/app/Shell.tsx`.
*Depends on:* A1, C4.

**Chunk D4: after-shots and budget check.** Re-run the capture at both widths in both appearances into `docs/design/after/`, confirm the JavaScript budget has not moved, and diff against `docs/design/before/`.
*Files:* `docs/design/after/` only.
*Depends on:* everything.

### Quality floor, to be confirmed at the end of Phase 4

Responsive down to 320px; visible keyboard focus on desktop in both appearances; reduced motion and reduced transparency respected; the largest system text size survivable with hierarchy intact; every one of the twelve captured screens legible in both appearances; the JavaScript budget still under 300 KB.
