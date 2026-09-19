# ChessApp (working title)
## Product Requirements Document

| | |
|---|---|
| **Version** | 1.1 (adds game import, the strengths and weaknesses profile and tailored sessions, section 8.14) |
| **Date** | 16 September 2026 |
| **Owner** | Dr. Stefan Gravesande, Preqal Inc. |
| **Status** | For review |
| **Companion documents** | Research synthesis (`research/00-research-synthesis.md`) and seven research memos in the same folder |

---

## 0. Summary

ChessApp is a free, installable web app (a progressive web app, or PWA) that teaches chess to adult beginners and takes them to club level, roughly a 1600 rating on the chess.com scale. It blends the structure and habit design of Duolingo with the lesson format, puzzle variety and game review of chess.com, and it leans toward chess.com. Learners follow one guided path of short interactive lessons, prove each unit in a checkpoint, solve puzzles chosen from their own mistakes, play coached games against human-like opponents, and review every game with a coach who explains the turning points in plain language. Everything is free, with no advertising, no subscriptions and no limits on review, repetition or explanation.

The research behind this document (seven memos, about 70,000 words, roughly 500 sources) points to one gap in the market. Every ingredient of a great learning loop already exists somewhere, but no product offers even three of them together for free, and chess.com's free tier is throttled precisely at the points where learning happens. The strongest single finding is that reviewing one's own games and taking short lessons move a beginner's rating five to seven times faster per hour than playing, while generic puzzles are no better than playing. The product is built around a three-step loop in which the learner plays a game, reviews it, and then drills the mistake it revealed. The path provides the structure and the habit layer provides the reason to come back.

The first release covers four curriculum sections (new to chess through 1600), rated and themed puzzles, play against a ladder of bot personas with an in-game coach, full game review with retry and explanations, import of the learner's chess.com and Lichess games, a strengths and weaknesses profile built from every game played or imported, tailored lessons and practice sessions generated from that profile, a daily plan, streaks and quests, guest mode and accounts with sync, offline lessons and puzzle packs, and accessibility from the start. Human-versus-human play, kids' mode, coach and classroom tools, leagues and languages other than English are out of scope for the first release.

---

## 1. Vision and principles

### 1.1 Vision

Anyone with a phone should be able to go from not knowing how a knight moves to being a confident club player, for free, with a coach who knows what they get wrong and what to work on next.

### 1.2 What "a blend of Duolingo and chess.com, closer to chess.com" means in practice

From Duolingo the product takes the path (one linear route, one active node, a visible way to test out), short lessons that ramp from recognition to production, interleaved review, mastery tests, a placement test, the streak stack, daily and monthly quests, notifications anchored on unfinished business, onboarding that gives a first lesson before sign-up, one coach persona and the "one board, one instruction, one action" screen discipline.

From chess.com the product takes the lesson format (explanation, then a challenge where the learner must play the right move, then feedback), the four-tier guided levels with a library behind them, the puzzle stack (rated puzzles, custom themed practice, daily puzzle, sprint modes), Game Review with its move labels, key moments and retry, the bot ladder by rating band, the coach who talks during play, hint accounting, crowns for unassisted play, achievements, a learning rank and a two-day-grace streak.

Closer to chess.com means the product looks and behaves like a chess platform that teaches, not a language app with a chess course. The board is the centre of every screen. Play is a first-class activity, not a graded checkpoint. Ratings are real numbers on an external scale. The learner can always leave the path to play, solve or review, and the path adapts to what they did.

### 1.3 Product principles

1. **Mistakes are the material.** Nothing depletes when a learner makes a mistake. A blunder in a game becomes a puzzle. A reviewed loss earns XP. There are no hearts and no energy.
2. **Review is the engine.** Every game ends in a review, and every review ends in a drill. The default daily plan contains a game and its review.
3. **One path, honest gates.** The learner always knows what to do next. Units are unlocked by passing a checkpoint on unseen positions, not by opening lessons. A learner who already knows the material can test out.
4. **Show mastery, background the rating.** The home screen leads with what the learner can now do (pieces left hanging per game, motifs mastered, checkpoints passed). The rating estimate is honest, on the chess.com scale, smoothed over many games and labelled with a normal range of dips.
5. **The engine decides, the coach explains.** Every explanation is grounded in engine facts. A language model, if used, only phrases facts that have already been verified and never chooses a move or invents a threat.
6. **Free means free.** No advertising, no subscriptions, no gated features, no daily caps on lessons, puzzles or reviews. Sustainability comes from a client-heavy architecture that keeps costs near zero per learner.
7. **Built for a mid-range phone on a slow connection.** The app must be pleasant on a Galaxy A51 class device on 7 Mbps, offline for lessons and puzzles, and installable on Android, iOS and desktop.
8. **Test everything, ship polished.** Features ship with analytics and, where possible, as experiments. The team ships small, polished versions rather than large unfinished ones.

---

## 2. Goals and success measures

### 2.1 Goals for the first release

1. A learner who starts from zero can complete Section 1 in their first week and play a full legal game against a bot with a coach's help.
2. A learner who follows the daily plan for three months measurably improves on mastery metrics and on estimated rating.
3. At least half of games played in the app are reviewed. For comparison, chess.com learners in the largest study spent about 5 per cent of their time on review.
4. The app runs offline for lessons and puzzles, installs on all three platforms, and stays under the performance budget on the reference phone.

### 2.2 North Star and supporting metrics

The North Star is **Daily Active Learners (DAL)**, defined as accounts or guests who complete at least one learning action in a day (a lesson, a checkpoint, a puzzle set of five or more, a game review, or a coached game). Playing a game without reviewing it does not count. This keeps the team from optimising for raw play volume, which the evidence says is the least efficient activity.

| Area | Metric | First-release target (six months after launch) |
|---|---|---|
| Retention | Day 1, day 7, day 30 retention of new learners | 45 per cent, 25 per cent, 12 per cent |
| Retention | Current-user retention rate (share of learners active yesterday who are active today) | 55 per cent |
| Habit | Share of DAL with a streak of seven days or more | 35 per cent |
| Learning loop | Share of bot games followed by a completed review | 60 per cent |
| Learning loop | Share of daily plans completed in full (lesson, puzzles, game, review) | 40 per cent |
| Learning | Checkpoint first-attempt pass rate | 60 to 75 per cent (lower means the lessons are not teaching, higher means the checkpoint is too easy) |
| Learning | Median change in "pieces left hanging per game" from first ten games to games 40 to 50 | A fall of at least 40 per cent |
| Learning | Estimated rating gain per 100 hours in app, Sections 1 and 2 | 200 points or more |
| Content quality | Share of lesson challenges and puzzles flagged as wrong or ambiguous by learners after engine and human QA | Under 1 per cent |
| Performance | Interaction to Next Paint on the reference phone, app shell size, time to first lesson on 7 Mbps | Under 200 ms, under 300 KB of JavaScript, under 5 seconds |
| Cost | Hosting and inference cost per monthly active learner | Under US$0.02 at 10,000 learners, under US$0.01 at 100,000 |

The retention targets are ambitious for an education app. Duolingo does not publish absolute retention figures, but it reports that a seven-day streak makes a learner 2.4 times likelier to return the next day, which is why the streak target sits alongside them. All targets should be re-based after the first month of real data.

---

## 3. Who the product is for

### 3.1 Primary learners (first release)

**The adult beginner.** Aged roughly 16 to 45, has a phone, may have played a few games with a friend or online and lost badly, wants to be "good enough not to embarrass themselves" or to beat a specific person. The average newly registered player on chess.com is rated about 650, and the typical one lower still. They do not know what to study, they play far more than they study, and they quit after a losing streak. They need a path, a coach voice, fast wins and a reason to come back tomorrow.

**The casual online player who has plateaued.** Rated 600 to 1200 on chess.com or 1000 to 1600 on Lichess, plays ten-minute games most days, has watched some videos, has never reviewed a game properly. They need diagnosis, targeted drills and a habit of review. They import their games at onboarding, get a profile of what they do well and badly, and start with a tailored session. The placement test is the fallback, and puts them into Section 2, 3 or 4 depending on what they already know.

**The returning player.** Learned as a child, stopped for years, wants to get back into it. Knows the rules, has forgotten the rest. Tests out of Section 1 and needs the same structure as the beginner from Section 2 onward.

### 3.2 Secondary audiences (designed for, not optimised for, in the first release)

Teenagers and school club members will use the app because it is free. The product must be safe for them by default (no chat, no strangers, no personal data required to learn) even though a dedicated kids' mode is out of scope. Coaches and club leaders will want to point students at the path and see progress. A shareable progress page covers the first need and a classroom view is deferred.

### 3.3 Learner jobs to be done

1. Learn the rules properly and stop losing to Scholar's mate.
2. Stop hanging pieces and start taking free ones.
3. Know what to do after the first few opening moves.
4. Find out why a game was lost and fix that one thing.
5. Have something worth doing in ten spare minutes that feels like progress.
6. See improvement in a way that does not swing wildly from day to day.

---

## 4. Market context (from the research)

Chess.com has more than 265 million registered players and its app has over 100 million installs. Lichess runs five million games a day on a total budget of about US$720,000 a year (2025 figure). Duolingo Chess, launched in June 2025, reached "millions" of learners in three months and validated demand for a structured beginner path at enormous scale. Its reviewers agree it hits a ceiling fast, largely because for its first year it could not review the learner's own games, and the review it added in August 2026 covers only games played inside Duolingo. The Duolingo-style chess apps built between 2016 and 2020 (Magnus Trainer, Aimchess, Dr. Wolf) were all acquired by chess.com and are now in maintenance or paywalled after a few games. The AI-native coaching apps of 2024 to 2026 (Chessvia, Chessigma, Noctie) mostly charge €8 to 19 a month, partly to cover the cost of running language models, and most start from "import your games", which assumes an existing player.

Chess.com's verified prices on 15 September 2026 are US$6.99, 10.99 and 16.99 a month for Gold, Platinum and Diamond. Its free tier offers three puzzles a day, one puzzle rush, one game review at reduced depth, roughly one lesson a day beyond "Learn to Play" (the exact allowance has changed repeatedly), and no coach explanations. Its most praised feature is Game Review. Its most repeated complaints are the lack of sequencing, passive lessons that do not stick, and paywalls around exactly the review, repetition and explanation loop where learning happens.

The full comparison matrix and 26 borrowed patterns are in memo 03. The positioning that follows from it is **the free path from zero to club level, with chess.com's lesson and review quality, Lichess's generosity, Dr. Wolf's coached play and Duolingo's habit engine, in one place.**

---

## 5. Scope

### 5.1 In scope for the first release (v1)

- Onboarding with a "why chess" question, level self-report, daily goal, placement test and a first lesson before sign-up.
- A guided path of four sections (new to chess through 1600 on the chess.com scale), 38 units, about 160 lessons and about 1,000 challenges, with a checkpoint per unit and a test-out option.
- A lesson player with eight challenge types, per-variation feedback, hints with honest accounting, retry before reveal, stars and a one-line takeaway.
- Puzzles: rated puzzles with a Glicko-2 rating, themed practice with no rating impact, "Fix my mistakes" sets built from the learner's own errors, a daily puzzle with a calendar, and two sprint modes.
- Play against bots: a persona ladder by band from 250 to 1800, an in-game coach with comments, hints, threat display and take-backs, crowns for unassisted play, three time controls, and a habit score after every game.
- Game review for every game, in-app or imported: move labels, accuracy, key moments with retry, plain-language explanations, an error log and a "fix it" drill.
- Import of the learner's games from chess.com and Lichess by username, or from a PGN file, with analysis of up to 500 games and automatic pick-up of new games.
- A strengths and weaknesses profile built from every game, with strengths first, weaknesses ranked by cost, comparison with typical players at the learner's level, and a "what changed" view.
- Tailored sessions generated from the profile: a lesson rebuilt around the learner's own positions, a practice set drawn from their mistakes, a game that provokes the weakness, and its review.
- Practice drills: play a position against the engine until a goal is met (mates, endgames, motifs), and a board vision trainer.
- Progress: a six-skill profile, an honest estimated rating band, a learning rank, the error log and the streak calendar.
- Engagement: a daily plan, streaks with a two-day grace and earned freezes, XP, daily quests, a monthly challenge, mastery-based achievements, push notifications (Android and installed iOS) and email reminders.
- A single coach persona and a cast of opponent personas.
- Guest mode with local progress, accounts with sync, and data export and deletion.
- Offline app shell, lesson packs and puzzle packs, with an explicit download control.
- Accessibility: text move entry, keyboard board navigation, screen-reader readout, colour-blind-safe highlights and reduced motion.
- English only, with the interface built for translation.

### 5.2 Out of scope for the first release

- Human-versus-human play, matchmaking, chat, friends and any social feed.
- A kids' mode with parental controls and a classroom or coach dashboard.
- Leagues and leaderboards.
- Sections beyond 1600.
- Native app builds. An Android store listing through a web-to-store wrapper is included at launch because it adds no app code. An iOS store build is out of scope.
- Human-like neural opponents (Maia) and language-model phrasing of explanations, both planned for the first update behind feature flags once verified on target phones and budgets.
- Languages other than English.

### 5.3 Non-goals

The product will not market cognitive or academic benefits of chess. The controlled evidence does not support them. The product will not use loss-framed penalties on accuracy, will not sell anything, and will not rank learners against each other by rating. Any ranking of learning effort is opt-in and experimental, because a game that already has a brutal public leaderboard in the rating does not need a second one by default.

---
## 6. The learning model

This section states how the product teaches. Every rule here traces to a finding in the research synthesis.

### 6.1 The loop

The core loop is **learn, apply, review, fix**.

1. **Learn.** A three-to-six-minute lesson introduces one idea with a one-screen guidebook, a short explanation on the board and a run of challenges in which the learner must play the move.
2. **Apply.** The learner plays a coached game (or a mini-game from a set position) in which the idea is likely to appear. The coach comments, allows take-backs and offers hints, and the game is scored against the current habit list.
3. **Review.** The game is reviewed automatically. Key moments are shown one at a time. At each, the learner tries to find the better move before it is revealed. Each mistake is explained in the vocabulary of the lesson it violates and logged with its theme, phase and clock.
4. **Fix.** The error log generates a short drill of similar positions, scheduled for today and again at growing intervals.

The daily plan packages one pass through the loop, sized to the learner's goal of five to twenty minutes. The path provides the order in which ideas are introduced. The error log provides the order in which they are revisited. Across many games, played in the app or imported from chess.com and Lichess, the same records add up into a strengths and weaknesses profile, and the profile generates tailored sessions that take the place of the path's lesson when a specific weakness costs more than the next idea on the path (section 8.14).

### 6.2 Sequencing rules

- **Rules, then safety, then tactics, then endgame basics, then strategy, openings last.** This is the order every structured curriculum uses (Steps Method, Heisman, Bartholomew, ChessDojo, Building Habits). Opening content before Section 3 is limited to the principles, one simple first opening for each colour taught as a target position rather than as lines, and how to meet the two beginner mates.
- **Motifs in the workbook order, placed by the puzzle ladder.** Fork, pin, back rank, skewer and discovered attack in Section 2. Removing the defender, overloading, x-ray, double check, trapped pieces and promotion tactics in Section 3. Deflection and decoy, interference, clearance, desperado, in-between moves and zugzwang in Section 4. This is the order the beginner workbooks share, with the boundary between Sections 3 and 4 set by the Lichess puzzle ladder (back-rank mate 859, mate in two 1126, fork 1325, discovered attack 1453, deflection 1519, pin 1605, zugzwang 1925), so that each motif's drills sit at a difficulty its section can reach. Pins are treated as a two-stage skill, noticing and keeping a pin in Section 2 and exploiting one in Section 3.
- **Endgames as declarative rules early, technique later.** The three rules that decide the endgames beginners actually reach (queen mate, rook mate, push the passed pawn) come in Section 1. Opposition and the rule of the square come in Section 2. Rook and pawn endgame technique come in Section 4, matching the puzzle ladder (rook endgame 1406, pawn endgame 1795).
- **Blocked, then interleaved.** Each motif is first drilled on its own inside its lesson, then mixed with earlier motifs in unit checkpoints and in the daily puzzle set, where no label announces what to look for. This is the Steps Method's "Mix" workbook logic and the interleaving evidence.
- **A thinking process as scaffolding.** Section 1 teaches "is my piece safe, can I take something, is my king safe". Section 2 teaches Heisman's Real Chess (check every check, capture and threat the opponent can reply with). Section 3 adds candidate moves and a blunder check. Section 4 adds calculation to three to five ply (a ply is one move by one side, so five ply is about two and a half moves) and "what does my opponent want". The coach prompts these steps during play and phases the prompts out as the learner's accuracy rises.
- **Habits as a checklist.** Chessbrah's Building Habits rule sets are adapted as the product's habit levels, with their rating bands remapped to the product's sections. Level one (Section 1 and unit 2.1) forbids premoves, tactics, gambits and sacrifices and requires castling early, controlling the centre, accepting equal trades and taking free pieces. Level two (from unit 2.2, when the first tactics are taught, through Section 3) allows basic tactics, keeps the ban on gambits and sacrifices, adds "keep a pin" and "rooks behind passed pawns", and requires playing to checkmate. Level three (Section 4) requires active rather than reactive play, basic endgame technique and no lost pieces. Every rule is graded automatically from the move list after each game, and the checklist a learner is graded against never penalises something the current unit teaches.

### 6.3 Repetition rules

- **Two kinds of repetition.** Concepts (a motif, a mate pattern, an endgame rule, an opening plan) are reviewed on a schedule. Each concept has a bank of at least 20 positions so that a review never repeats a position the learner has seen. Specific mistakes from the learner's own games are also scheduled, first as the exact position, then as similar positions from the concept bank.
- **The schedule.** A simple expanding ladder (same day, one day, three days, one week, two weeks, one month, three months) with a failed review sent back one rung. A per-concept half-life model can replace the ladder once there is enough data.
- **A capped queue.** The daily review queue is capped at ten items. Backlog is never shown as a debt. This is the lesson of Chessable's abandoned users.
- **Selection by difficulty and by the learner's own record.** Puzzles are chosen so the predicted success rate sits between 70 and 85 per cent, using the puzzle's Lichess rating as a prior and the learner's per-theme record as the override once there are enough attempts.

### 6.4 Assessment rules

- **Placement by fast convergence.** Self-report (new, know the rules, play casually, play rated) maps to a starting point, then an adaptive set of 12 to 15 challenges across themes with partial credit (a good move scores more than a blunder even when neither is best) refines it. An optional short game against a bot adds a habit reading.
- **Checkpoints on unseen positions.** Every unit ends in a checkpoint of eight to twelve mixed, unlabelled challenges drawn from a held-out bank of at least 30, plus one coached mini-game where relevant. Hints are disabled during a checkpoint. The pass mark is 75 per cent of the challenges, and the mini-game must reach its goal where one is set. A failed checkpoint shows which concepts were missed, assigns a remediation set of five to eight challenges on those concepts, and allows a retake once the set is done. Each attempt draws a fresh sample from the bank. After three failed attempts the coach recommends replaying the unit's lessons before the next try. A learner may attempt any checkpoint early to test out, and lessons within a unit may be taken in any order.
- **Sections complete on checkpoints, never on rating.** A section is marked complete when its last checkpoint is passed. Each section publishes a target habit score and rating band as guidance, and when a learner completes a section below them the coach recommends more games at that level, but rating never blocks the path.
- **Two numbers, kept apart.** The learning rank (Pawn, Knight, Bishop, Rook, Queen, King, then King II and so on) counts checkpoints passed. The estimated rating is a separate, smoothed estimate on the chess.com scale with a visible normal range.

### 6.5 What the product deliberately does not do

It does not charge hearts for mistakes. It does not throttle review, play or explanation. It does not rank learners against each other by rating or by default. It does not promise a timeline (the slowest learner in the research needed eight times the hours of the fastest). It does not let a language model choose moves or assess positions. It does not teach opening lines by rote before Section 4.

---

## 7. Curriculum architecture

### 7.1 Structure

| Level | Definition | Count in v1 |
|---|---|---|
| **Section** | A rating band on the chess.com rapid scale with a public "what you can do at this level" rubric | 4 (New to 400, 400 to 800, 800 to 1200, 1200 to 1600) |
| **Unit** | One capability, for example "punish a hanging piece" or "win a won king and pawn ending", with a one-screen guidebook | 38 |
| **Lesson** | One idea, three to six minutes, a lesson card plus five to ten challenges | About 160 |
| **Challenge** | One board, one instruction, one action | About 1,000, plus held-out checkpoint banks of at least 30 each |
| **Checkpoint** | The mastery test that closes a unit | 38 |
| **Story game** | An annotated game played through in guess-the-move form, one per unit from Section 2 with extra games in the two dedicated units | About 40 |
| **Drill set** | A group of set positions played against the engine until a goal is met, in the Lichess Practice style | About 30 sets, roughly 250 positions |

Sections map to chess.com rapid ratings. Lichess ratings run roughly 300 to 600 points higher at the beginner bands and 200 to 400 points higher at club level, converging above about 2100, and the app shows the conversion wherever a rating appears. Each section also publishes a one-line rubric of what a learner can do at that level. Section 1, play a full legal game and deliver a basic mate. Section 2, stop hanging pieces, take free ones and reach a safe middlegame. Section 3, win material with the basic motifs and convert a won king and pawn ending. Section 4, make a plan, calculate a short combination and hold or win a basic rook ending.

### 7.2 Section outline

The full unit and lesson list is in Appendix A. In brief:

**Section 1, Foundations (new to chess to 400).** The board and pieces taught as star-collecting mini-levels in the Lichess Learn style. Capturing, defending and piece values. Check, checkmate, stalemate and the draws. Castling and the special rules. The first mates (ladder, queen, rook, back rank) played out against the engine. The pre-move safety check. First coached games with habit level one. Six units. Short lessons matter most here. The research measured 17.8 rating points per hour of lessons for players under 400, more than three times the rate for stronger players.

**Section 2, Safety and the first tactics (400 to 800).** Real Chess and the threat scan. Forks. Pins and skewers. Back-rank and helper mates. Discovered attacks. Opening principles and a first opening for each colour, with the answers to Scholar's and Fool's mate. The endgame rules that decide games (square of the pawn, direct opposition, what can and cannot mate, the rook-pawn draw). Notation, the clock and habit level one in full. Eight units.

**Section 3, Fluency and planning (800 to 1200).** Removing the defender and overloading. X-ray, double check and discovered check. Trapped pieces and promotion tactics. Named mates, first wave. Drawing weapons. Seirawan's four elements and piece activity. Open files, the seventh rank and passed pawns. King safety. Endgames continued (distant opposition, queen against pawn, activating the king). A repertoire skeleton with plans, not lines. Candidate moves and the blunder check. The first story games. Twelve units.

**Section 4, Club player (1200 to 1600).** Deflection and decoy. Interference, clearance and desperado. In-between moves and defensive tactics. Zugzwang, the Greek gift and the second wave of named mates. Combinations as chains and calculation to five ply. Stean's six positional themes. Bishops, knights and the isolated queen's pawn. Reading imbalances and making a plan. Rook endings (Lucena, Philidor, the seventh rank, rooks behind passed pawns). Pawn endings (key squares, triangulation, breakthrough) and the wrong bishop. Opening plans through model games. Practical skills (critical moments, time trouble, tilt, the error log). Twelve units.

Section 5 (1600 to 2000) is designed but not built in the first release.

### 7.3 Lesson anatomy

Every lesson follows the same shape so the learner never has to work out how a screen works.

1. **Lesson card.** One screen. The idea in two sentences, one to three small diagrams, the habit rule it connects to, and a link to the unit's guidebook. Available at any time from the path.
2. **Explain.** One to three screens of text on the board with animated arrows and highlights. No video. The coach's voice. Never more than 60 words per screen.
3. **Challenges.** Five to ten, ramping from recognition to production. The first challenge is usually a "tap the piece" or "which square" task, the middle ones are "find the move", and the last is open-ended, either "find the best move" with no hint of the theme or "play it out".
4. **Feedback.** A correct move gets a one-line reason, never just "correct". A wrong move gets the authored feedback for that specific wrong move if one exists, otherwise the engine's refutation shown on the board in one move, then a retry. The solution is revealed only after a second miss or on request.
5. **Close.** A one-line takeaway ("Before you move, look at what your opponent's last move attacks"), stars (three for no hints and at most one miss, two for hints or two misses, one for completion), XP and the streak tick.

### 7.4 Challenge types

| Type | What the learner does | Used for |
|---|---|---|
| Find the move | Plays one move that must match a single solution | Tactics, mates, endgame moves |
| Find the sequence | Plays a two-to-four move line, the engine or an authored reply plays the opponent's moves | Combinations from Section 3 |
| Find them all | Marks every square or piece that fits (all hanging pieces, all squares the knight attacks) | Board vision, threat scanning |
| Is it safe? | Answers yes or no for a proposed move and picks the reason from three | Real Chess, counting |
| Which square | Taps a named square or the destination of a written move within a time limit | Notation, vision |
| Name the pattern | Picks the motif or mate name from three after seeing a position | Vocabulary, later interleaving |
| Play it out | Plays a position against the engine until a stated goal is met (mate within N moves, promote, hold a draw) | Mates, endgames, mini-games |
| Guess the move | Predicts the next move in an annotated game, scored on match with the master and on engine quality | Story games, opening plans |

Every challenge with a single solution is engine-verified for uniqueness at authoring time. Challenges with multiple acceptable moves list them explicitly. A challenge is never presented with a theme label at checkpoint or in the daily puzzle set.

### 7.5 Story games

From Section 2, each unit includes one annotated game in the Logical Chess style, played through in guess-the-move form with the coach narrating why each move was played, and two units (3.12 and 4.11) are made up of story games. Games are chosen from the public domain (Morphy, Anderssen, Steinitz, Lasker, Capablanca, Alekhine, with their own or public-domain annotations rewritten in plain language) and from the Lichess database at the learner's level, so a Section 2 learner sees a 700-rated game go wrong in the way theirs do. Story games are the strategy-delivery mechanism the puzzle format cannot provide, and the research shows that narrative content lifted Duolingo's daily activity.

### 7.6 Mini-games and drills

Section 1 uses coach-standard mini-games (pawn wars, king and pawn war, queen against eight pawns, knight versus pawns, the checkmate ladder, king hunt) to teach piece movement and value through play. Later sections use set-position drill sets in the Lichess Practice style (piece checkmates, mate patterns, the fundamental and advanced motifs, pawn and rook endings), each set holding six to twelve positions. Each position has a goal, a move budget, and three stars for finishing under par.

---
## 8. Feature requirements

Each feature lists what it must do (requirements are numbered so they can be tracked), the rules that govern it, and what is deferred. Requirement identifiers use the form F-area-number.

### 8.1 Onboarding and placement

**Purpose.** Get a new learner to a first success inside two minutes, learn enough to route them, and earn the account and the install later.

| ID | Requirement |
|---|---|
| F-ON-1 | The first screen introduces the coach and asks one question, "Why chess?", with four to six answers (beat a friend or family member, get better at online play, just for fun, play in a club or tournament, help a child learn, just curious). The answer is stored and used to route content and notification copy. |
| F-ON-2 | The second screen asks the learner's level with four options mapped to a starting point on the path: new to chess (Section 1, unit 1), I know the rules (Section 2 after a short check), I play casually (placement test), I play online already (import my games, F-IM-5, with the placement test as the fallback when there are fewer than ten games). |
| F-ON-3 | The third screen asks for a daily goal (5, 10, 15 or 20 minutes) and explains that the daily plan will be sized to it. |
| F-ON-4 | The learner completes a first lesson or the placement test before any sign-up prompt. Progress is stored locally as a guest. |
| F-ON-5 | The placement test is adaptive, 12 to 15 challenges across themes, with partial credit, and ends with a result screen that says which unit the learner will start at and why, in one sentence, with a "start earlier" option. Every placement challenge is tagged to a unit. The learner is placed at the first unit whose challenges scored below 70 per cent, and never beyond the start of Section 4. Units before the placement point are marked "tested out" and count as passed for the learning rank. "Start earlier" moves the placement back by whole units. The "I know the rules" option runs a five-challenge rules check instead and places the learner at unit 2.1 on a pass, otherwise at unit 1.3. The optional bot game after placement does not change the placement, it seeds the habit score. |
| F-ON-6 | After the first lesson the app offers to install (native prompt on Android and desktop, an illustrated instruction sheet on iOS) and explains the two benefits in one line each, offline lessons and reminders. |
| F-ON-7 | A soft sign-up prompt appears after the first daily plan is completed and again at the first checkpoint, and explains that an account keeps progress safe across devices. Sign-up is never required to keep learning. |
| F-ON-8 | Notification permission is requested only after the learner has completed two days of activity, and only in response to a tap on a "remind me" control. |

**Note.** Import during onboarding is specified in F-IM-5, and import from the Review and Progress tabs in section 8.14.

### 8.2 Home and the daily plan

**Purpose.** Make the next action obvious and make the habit visible.

| ID | Requirement |
|---|---|
| F-HM-1 | The home screen shows, in order, the streak with today's status, the daily plan as a short checklist, and the current path node. Nothing on the home screen scrolls sideways and the daily puzzle and streak are always one tap from launch. |
| F-HM-2 | The daily plan contains one lesson (a new lesson, or a review lesson when the schedule says so), a set of five puzzles (drawn from the review queue and the learner's error log, topped up with puzzles at the learner's level), one game item and its review. The game item is a mini-game or set-position game of about five minutes by default, and a full game against a bot when the learner's goal is 15 minutes or more. A 5-minute goal shows the lesson and puzzles only, with the game offered as an extra. A 20-minute goal adds a story game. A game that runs past the goal still completes the plan, and an untimed game satisfies the game item. |
| F-HM-3 | The plan adapts to what the learner did outside it. A game played from the Play tab satisfies the plan's game item. A review completed from the Review tab satisfies the review item. |
| F-HM-4 | Completing the plan triggers a short celebration, the XP total for the day and the streak animation. Completing part of it shows what remains without any negative framing. |
| F-HM-5 | The home screen also offers "dessert": the daily puzzle, a sprint mode and free play, visually separate from the plan. |
| F-HM-6 | After two consecutive losses in bot games the home screen suggests a cool-down (a lesson or puzzles) before the next game. The suggestion can be dismissed and is not shown more than once a day. |
| F-HM-7 | When the profile offers a tailored session (F-TS-1), the plan's lesson, puzzle and game items are replaced by the session's items for that day, with a one-line reason at the top of the plan ("Today is about forks, they cost you three games this week"). This happens at most twice a week so the path keeps moving, and the learner can decline it and keep the path's plan. |

### 8.3 The path and lessons

| ID | Requirement |
|---|---|
| F-PA-1 | The path is a single vertical scroll of sections, units and lesson nodes with one active node. Completed nodes are tinted, the active node is highlighted, future nodes are visible but locked. Each unit shows its guidebook, its lessons, its story game if any, and its checkpoint. |
| F-PA-2 | Any checkpoint can be attempted early. Passing it marks the unit complete and unlocks the next. Failing it leaves the unit as it was. |
| F-PA-3 | Review lessons appear on the path automatically when concepts are due, marked differently from new lessons, and can be done at any time from the Practice tab. |
| F-PA-4 | The lesson player follows the anatomy in section 7.3 and supports all eight challenge types in section 7.4. |
| F-PA-5 | Hints are available on every lesson challenge and disabled during checkpoints. A hint first highlights the piece to move, a second hint highlights the destination. Stars follow the rules in section 7.3 and mastery credit follows the hint accounting in F-PZ-4. |
| F-PA-6 | Wrong moves are answered with authored feedback for that move where it exists, otherwise with a one-move engine refutation on the board, then a retry. |
| F-PA-7 | Every lesson can be replayed. Replays earn reduced XP and do not change mastery unless the replay is a scheduled review. |
| F-PA-8 | A library view lists every lesson by section, theme and skill for learners who want to jump around, with a clear note that the path is the recommended route. |
| F-PA-9 | Lessons are fully usable offline once their section pack is downloaded. |

### 8.4 Puzzles

**Purpose.** Chess.com-grade puzzle variety, Lichess-grade generosity, and a puzzle stream that is driven by the learner's own mistakes rather than by volume.

| ID | Requirement |
|---|---|
| F-PZ-1 | **Rated puzzles.** An unlimited stream of puzzles from the curated Lichess pool, each with a rating, chosen so the learner's predicted success is between 70 and 85 per cent. The learner has a puzzle rating computed with Glicko-2, the rating method that tracks both a number and how certain it is, starting at 800 with a high uncertainty, computed on the device and reconciled on the server. Each puzzle shows its rating, its themes and the learner's time after completion, never before. |
| F-PZ-2 | **Themed practice.** The learner picks one or more themes and a difficulty band and solves without a timer and without rating impact. Themes carry the one-sentence definitions from the Lichess theme list. Every lesson links to the themed practice for its motif. |
| F-PZ-3 | **Fix my mistakes.** A set built from the learner's error log, first the exact positions from their games (with the opponent's move replayed), then similar positions from the concept bank, scheduled on the repetition ladder. "Similar" means the same primary theme tag and a puzzle rating within 150 points of the learner's puzzle rating. Mistakes the tagger cannot classify (positional or quiet-move errors) are logged as judgement errors and produce a link to the relevant lesson instead of a drill. This set is the first item in the daily plan's puzzle slot whenever it is non-empty. |
| F-PZ-4 | **Hint accounting.** Correct moves made before any hint earn full credit. Correct moves after a hint earn progress credit but no rating change. A puzzle failed after a hint counts as failed for mastery. The rule is shown in the hint control's tooltip. |
| F-PZ-5 | **Explain on miss.** After any miss, a "Why?" control shows the refutation of the learner's move and the reason the solution works, in one to three sentences, with the relevant lesson linked. |
| F-PZ-6 | **Daily puzzle.** One puzzle a day for everyone, with three attempts, a calendar of solved days, and an explanation after completion. Solving it within 48 hours counts toward the streak. |
| F-PZ-7 | **Sprint.** A three-minute run of ascending puzzles with a time bonus for combos and a ten-second penalty for misses, and a personal best. **Streak run.** No clock, puzzles get harder, one miss ends the run, one skip allowed. Both are unlimited and shown as dessert. |
| F-PZ-8 | **Puzzle dashboard.** Per-theme performance over the last 30 days, strengths and improvement areas, and the relationship between puzzle rating and estimated game rating explained in one sentence (puzzle ratings run higher than game ratings and the gap is normal). |
| F-PZ-9 | Puzzle packs for the learner's current and next band are downloadable for offline solving. |

**Deferred.** Two items wait for a later release, puzzle tiers with prestige cycles (a long-term ladder at zero content cost) and a puzzle battle against friends.

### 8.5 Play against bots

**Purpose.** The single most praised beginner experience in the research is a coach who comments during a game, praises good moves and allows take-backs. It must be free and tied to the curriculum.

| ID | Requirement |
|---|---|
| F-PL-1 | **The bot ladder.** About 20 named bot personas from 250 to 1800 on the chess.com scale, four or five per section band, each with an avatar, a short description, an opening preference and a playing style (aggressive, solid, trader, attacker) expressed through move selection weights. Bot ratings must be calibrated against real learner results and adjusted before launch so a "600" bot is beaten about half the time by 600-rated learners. |
| F-PL-2 | **Human-like errors.** Bots in the first release use the engine with multi-line sampling and a rating-tuned error model that decides when to err (more often in complex positions and never in trivially forced ones) and what kind of error to make (leave a piece hanging, miss a mate, allow a fork), so that beginners meet the mistakes humans of that rating make. A neural human-like model (Maia-2) replaces this behind a flag in the first update once size and latency on target phones are verified. |
| F-PL-3 | **Coach mode.** Optional in every bot game, on by default in Sections 1 and 2. The coach comments on the learner's moves (a hanging piece, a threat ignored, a good capture, castling done), offers a hint on request (piece first, then square), can show the opponent's current threats as arrows, allows unlimited take-backs, and asks the section's thinking-process questions at key moments. Comments are rule-generated from engine facts and the motif tagger. The coach never speaks more than once per move and can be muted. |
| F-PL-4 | **Crowns.** A game earns three crowns with no hints or take-backs, two with one to three, one with four or more. Crowns feed achievements and the habit score but never the rating estimate. |
| F-PL-5 | **Time controls.** Untimed, 10+0 and 15+10. When the daily plan calls for a full game it defaults to 10+0 in Sections 1 and 2 and 15+10 from Section 3. Games with less than ten seconds a move on average are flagged in review as "too fast to learn from". |
| F-PL-6 | **Lesson-linked games.** After a lesson, the plan's game may be a mini-game or set position that starts where the lesson's idea is likely to arise, with a stated goal. |
| F-PL-7 | **Habit score.** After every game the move list is graded against the learner's current habit level (castled by move ten, no early queen, equal trades accepted, no hanging pieces, took free pieces, king activated in the endgame, and so on). The result is shown as a short checklist with ticks and one suggestion. |
| F-PL-8 | Every game ends with the review offered as the next action, and the review counts toward the plan and the streak. |
| F-PL-9 | Bot play works offline, including coach mode, since the engine, the tagger and the personas run on the device. |

**Deferred.** The first update adds a teaching-mode opponent that deliberately steers into the current lesson's pattern. Personality voice and chat lines beyond short text comments wait for a later release.

### 8.6 Game review

**Purpose.** The highest-evidence activity in the research, free and unlimited, with retry before reveal and explanations that point back to the curriculum.

| ID | Requirement |
|---|---|
| F-RV-1 | Every game played in the app is analysed on the device by the engine with a visible progress bar, in under 60 seconds for a 40-move game. The depth is not fixed: it is chosen at runtime from a measured analysis rate for that device, at depth 14 where the device allows and stepping down to 12 or 10 where it does not, never below 10. The depth actually used is disclosed to the learner on the summary. Key moments are then re-analysed at a higher depth. Imported games are analysed the same way. If analysis exceeds 90 seconds the review is shown with the moves analysed so far and completes in the background. |
| F-RV-2 | **Move labels.** Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss and Blunder are assigned from the change in expected score using the published Lichess win-probability curve, with thresholds that are more generous at lower ratings. Great is assigned to an only move. Brilliant is assigned to a sound sacrifice that was not already winning, and is expected to be rare. All icons and colours are the product's own design. Plain definitions are one tap away. |
| F-RV-3 | **Summary.** Accuracy for each side, the opening name with the move at which the game left the bundled opening book, the move count by label, and the phase in which the game turned. |
| F-RV-4 | **Key moments.** Three to five moments chosen by the size of the swing in expected score, with at least one of each kind where present, a good move the learner found, a chance the learner missed, and the mistake that decided the game. At each moment the position is shown before the learner's move and the learner is asked to find the better move (retry before reveal). "Show me" reveals the answer. |
| F-RV-5 | **Explanations.** Each key moment has a one-to-three-sentence explanation built from verified facts (the refutation line, the motif tagged in the solution, the material and expected score before and after) and linked to the lesson that teaches the idea ("This is the fork from Unit 2.2, replay it?"). In the first release explanations are templated. Language-model phrasing over the same facts, with output validation and caching, is planned for the first update. |
| F-RV-6 | **Error log.** Every mistake and blunder is written to the learner's error log with its theme, phase, clock time, the lesson it maps to, and a flag for whether the error is typical at the learner's level (from the puzzle ladder in the first release, from a human-like model later). |
| F-RV-7 | **Fix it.** The review ends with a three-to-five-puzzle drill built from the error log and a single suggested next lesson. Completing the drill completes the plan's review item. |
| F-RV-8 | **Full analysis.** A move list with evaluation, the ability to play through variations, and the engine's top three lines on request, for learners who want it. This view is secondary and never the default. |
| F-RV-9 | **Import.** A learner can review games imported from chess.com, Lichess or a PGN file exactly as they review in-app games. Import mechanics, scope and the profile it feeds are specified in section 8.14. Imported games feed the rating estimate only after the learner confirms the username is their own account (F-AC-5). |
| F-RV-10 | Reviews of games played in the app work offline. Imports require a connection. |

### 8.7 Practice drills and vision trainer

| ID | Requirement |
|---|---|
| F-PR-1 | A Practice tab lists drills by category, mates (piece checkmates, mate patterns), motifs (fundamental and advanced), endgames (pawn, rook, minor piece) and the Section 1 mini-games, each with a goal, a par and stars. |
| F-PR-2 | The vision trainer has three modes, find the square, find the destination of a written move, and count the attackers of a square, with a 30-second timer, board orientation choice and a personal best per mode. |
| F-PR-3 | The review queue and "fix my mistakes" set are also reachable from Practice. |

---
### 8.8 Progress and mastery

**Purpose.** Show mastery, background the rating, and keep progress and proficiency apart.

| ID | Requirement |
|---|---|
| F-PG-1 | **Skill profile.** Six skills, each with a mastery percentage and a link to the drill that improves it, presented within the strengths and weaknesses profile of section 8.14. Board vision (hanging pieces per game, vision trainer scores), Tactics (per-motif mastery from checkpoints, puzzles and games), Endgames (drill completion and endgame accuracy in games), Openings (share of games leaving known lines after move eight, habit rules in the opening), Strategy (Section 3 and 4 checkpoint results, accuracy in quiet positions), Thinking and habits (habit score, time per move, blunders in winning positions). |
| F-PG-2 | **Estimated rating.** A single estimate on the chess.com rapid scale, shown as a band (for example "about 750 to 850") with a trend over the last 30 games and a note that dips of 100 points are normal. The estimate is the Glicko-2 rating from bot games, where each bot is a rated entity calibrated in beta, blended with the puzzle rating converted to the game scale by subtracting a band-specific offset of about 250 to 350 points. The puzzle share of the blend starts at one half with no games played and falls to one tenth by 30 games. The band's width is the current rating uncertainty. It is labelled "provisional" until 20 bot games and "estimate" until the learner confirms an external account, whose recent results are then blended in at the same weight as bot games. When the server's recomputed value differs from the device's, the server value wins and the change is shown as a normal update. The Lichess equivalent is shown beside it. |
| F-PG-3 | **Learning rank.** Pawn, Knight, Bishop, Rook, Queen and King by checkpoints passed, then King II, III and so on, shown on the profile and used for the shareable progress card. This adapts chess.com's learning rank, which has no bishop, so that every piece appears. |
| F-PG-4 | **Error log view.** The learner's recurring mistakes grouped by theme, with counts, trend and the drill link. The three most costly are surfaced as "your three things to fix" and drive the tailored sessions in section 8.14. |
| F-PG-5 | **Streak calendar.** A month view of active days, freezes used and milestones. |
| F-PG-6 | **Shareable progress card.** An image with the learning rank, streak, three mastered skills and no rating, for sharing outside the app. |

### 8.9 Engagement layer

**Purpose.** This layer adapts Duolingo's habit engine to chess. Streaks count effort and never outcomes. XP rewards learning actions and never wins alone. The first release has no hearts, no energy and no leagues.

| ID | Requirement |
|---|---|
| F-EN-1 | **Streak.** One qualifying action a day extends the streak: a lesson, a checkpoint, a set of five puzzles, a game review, a coached game or the daily puzzle. If a day is missed and the learner holds a streak freeze, the freeze is used automatically at the end of that day and the streak continues. If no freeze is held, the streak pauses for a two-day grace period and resets at the end of the third day without a qualifying action. Freezes are earned by the weekly quest in F-EN-3 and up to two can be held. Nothing is sold, so there is no paid repair. Days are counted in the device's local time zone at the time of the action. Milestones at 3, 7, 14, 30, 60, 100, 200 and 365 days have their own animation and a shareable card. |
| F-EN-2 | **XP.** Lesson 10 to 20 by length, puzzle 2 to 5 weighted by difficulty, checkpoint 50, story game 20, bot game 10 regardless of result, review of any game 15, review of a loss 25, drill 5 to 10. XP is never paid for a win alone and never deducted. |
| F-EN-3 | **Daily and weekly quests.** Three daily quests drawn from a pool (review a game, solve five "fix my mistakes" puzzles, finish a lesson, play a 15+10 game, earn 50 XP), each paying a small reward (an XP boost for 15 minutes or a cosmetic). Completing all three pays a bonus. One weekly quest, complete five daily plans in the week, pays a streak freeze. |
| F-EN-4 | **Monthly challenge.** A themed month (for example "Endgame March") with a badge for completing a set number of quests. |
| F-EN-5 | **Achievements.** Tied to demonstrated skill and effort, never to volume alone. Examples: first checkpoint, first game with no hanging pieces, first back-rank mate delivered in a game, ten reviewed losses, a full section, a 30-day streak. Displayed in a showcase on the profile. |
| F-EN-6 | **Cosmetics.** Board colours, piece sets and coach reactions unlocked by achievements and quests. Never anything that affects learning. |
| F-EN-7 | **Notifications.** One reminder a day at most, at the learner's usual time, with copy tests across a small set of templates. Copy is anchored on the learner's unfinished business ("You left a rook hanging yesterday, want to see why?") or the streak, never guilt for its own sake. Quiet hours are respected. Push on Android, desktop and installed iOS, email as the fallback and for weekly summaries. The learner can turn each channel off in two taps. |
| F-EN-8 | **Cool-down.** As in F-HM-6. Tilt is strongest in the beginner band and the evidence says a break weakens it. |

**Deferred and conditional.** The first update may test a weekly league ranked on learning XP with no demotion, opt-in only, as an experiment. Friend streaks and study buddies wait for social features. A home-screen widget waits for a native shell.

### 8.10 The coach and the cast

| ID | Requirement |
|---|---|
| F-CO-1 | One coach persona, named and drawn, with a consistent personality (warm, dry, encouraging, never academic), who appears in lessons, during coached games, in reviews and in notifications. Name and design are open decisions (section 17). |
| F-CO-2 | The coach's voice is text in the first release, written to a style guide (short sentences, plain words, a light joke on captures and blunders, never sarcasm at the learner's expense). Recorded or synthesised voice is deferred. |
| F-CO-3 | Opponent personas are distinct characters with a one-line bio, an opening preference and a style, and are the face of the bot ladder. |
| F-CO-4 | Every coach line is generated from a template bank keyed on engine facts and motif tags, reviewed by the content lead, so that the coach never states something the engine has not verified. |

### 8.11 Accounts, guest mode and sync

| ID | Requirement |
|---|---|
| F-AC-1 | Guest mode stores all progress on the device and works fully offline. A guest may use the app indefinitely, with one caveat the app explains. Safari on iOS deletes a website's stored data after seven days without use unless the app is installed to the Home Screen, so an uninstalled iOS guest is warned before a long absence would cost them progress and is offered installation or an account. |
| F-AC-2 | Sign-up by email magic link, Google or Apple. Signing up merges local progress into the account, and signing in on a second device restores it. Merge rules: events from both sources are combined by their identifiers, the streak with the higher count wins and keeps its calendar, ratings are recomputed from the combined event log, and the error log is combined. Guest data stays on the device under the account after sign-in and is removed on sign-out only when the learner confirms. |
| F-AC-3 | Progress sync is an append-only event log with an outbox on the device, so that offline activity is never lost. Events carry the day they were recorded on the device, and the server credits that day. Settings use the most recent change by timestamp. Events that refer to content the server does not yet know (a newer pack version) are stored and resolved when that version is published. Duplicate completions of the same daily item from two devices count once. |
| F-AC-4 | The learner can export all their data and delete their account, and both are self-service. |
| F-AC-5 | Confirming a Lichess or chess.com username as the learner's own account adds those games to the rating estimate (F-PG-2). Import itself needs no confirmation (F-RV-9). No password for those sites is ever requested. |
| F-AC-6 | No chat, no public profiles, no friend lists and no personal data beyond an email in the first release. Under-13s can use guest mode without providing anything. |

### 8.12 Offline and installability

| ID | Requirement |
|---|---|
| F-OF-1 | The app shell, the rules library, the board, the piece set and the sounds are cached on first visit. |
| F-OF-2 | The engine (about 7 MB) is downloaded with a visible progress bar the first time a feature needs it, or in the background on an unmetered connection, and cached. |
| F-OF-3 | Each section's lesson pack and each band's puzzle pack can be downloaded from a Downloads screen showing sizes. Packs are versioned and updated in the background. |
| F-OF-4 | Persistent storage is requested after the first pack download. On iOS the app explains that installing to the Home Screen keeps progress and content safe. |
| F-OF-5 | An update to the app shows an "update available" notice and applies on the next launch, never mid-lesson. |
| F-OF-6 | Offline activity is queued and synced when the connection returns. |

### 8.13 Error handling

| ID | Requirement |
|---|---|
| F-ER-1 | If the engine fails to load or runs out of memory, lessons and puzzles continue to work from their stored solutions, bot play and review show a one-line explanation with a retry, and the failure is reported to error tracking with the device class. |
| F-ER-2 | If a review exceeds its time budget, the partial review is shown and completes in the background (F-RV-1). |
| F-ER-3 | If a pack download fails or the device is out of storage, the app says which pack failed and how much space it needs, and keeps whatever was already downloaded. |
| F-ER-4 | If an import returns an unknown username, a rate-limit response or a network error, the app says so in plain words and offers a retry after a stated wait. |
| F-ER-5 | If the opening explorer or the tablebase is unavailable, the features that depend on them show a short "offline" note and everything else continues. Drills that need the tablebase fall back to the engine. |
| F-ER-6 | If persistent storage is refused, the app continues and repeats the installation advice at the next natural moment. |
| F-ER-7 | If a server-side recomputation changes a rating, a streak or a checkpoint result, the change is shown as a normal update with a one-line reason, never as an error. |

### 8.14 Game import, the strengths and weaknesses profile, and tailored sessions

**Purpose.** A learner who already plays online should be able to hand the app their games and get back three things, an honest picture of what they do well and badly, a lesson built around their own mistakes, and a practice session that drills exactly those mistakes. This is the diagnosis-to-prescription loop the research found in Aimchess and Chessigma, both paid and both starting from an existing games history, and in chess.com's Insights, which diagnoses at the Diamond tier but never prescribes. Here it is free, works from the first game the learner plays in the app, and connects directly to the curriculum.

**How the analysis works, in plain terms.** Every game, whether played in the app or imported, is run through the engine and the motif tagger (section 10.3). Each move is labelled, each mistake is tagged with the pattern it involves, the phase of the game, the clock and the lesson that teaches it, and each game is graded against the habit checklist. The profile is what emerges when those records are added up across many games. It answers seven questions. Which patterns does the learner find and which do they miss. In which phase do their games turn. Which openings score well and which do not. How often they leave a piece hanging or drop a winning position. How they use the clock. Which habit rules they keep. And how each of these compares with a typical player at their level.

*Import.*

| ID | Requirement |
|---|---|
| F-IM-1 | **Sources.** A learner can import games by entering a chess.com username, a Lichess username, or by pasting or uploading a PGN file. Chess.com games are fetched through the app's import proxy from the public monthly archives, one request at a time, newest month first. Lichess games are fetched through the Lichess export API. No password for either site is ever requested. |
| F-IM-2 | **Scope of an import.** The first import takes the most recent 50 games in rapid, blitz and daily. The learner can ask for more in batches of 50 up to 500. Bullet games are imported but excluded from the profile by default, because the research shows their errors are clock-driven rather than skill-driven, and the learner can include them with one switch. |
| F-IM-3 | **Analysis order and speed.** The ten most recent games are analysed at once on the device with a visible progress bar, at the review depth in F-RV-1, so the learner sees a first profile within about five minutes. The rest are analysed in the background while the app is open, and continue on a later visit if the app is closed. The profile updates as games complete and shows how many games it is based on. |
| F-IM-4 | **Keeping it current.** Once a username is entered, the app checks for new games each time it opens and on a daily job when the learner is signed in, and adds them to the profile. The learner can turn this off. |
| F-IM-5 | **Onboarding.** The level screen (F-ON-2) offers "Import my games" as a fourth route for players who already play online. The first ten games are analysed during onboarding, the profile seeds the error log and the placement, and the learner's first daily plan is a tailored session (F-TS-1) rather than the path's first lesson. |
| F-IM-6 | **Every imported game gets a full review** (section 8.6), listed in the Review tab with the source, the opponent and the result. Imported games feed the error log, the habit score and the profile. They feed the rating estimate only after the learner confirms the username is their own account (F-AC-5). |
| F-IM-7 | **Limits and honesty.** The import proxy respects the source sites' rate limits and caches monthly archives so a re-import costs nothing. If a source is unreachable or a username does not exist, the app says so plainly (F-ER-4). Imported game data belongs to the learner, is stored under their account, and is covered by the same export and deletion rules as everything else (F-AC-4). |

*The strengths and weaknesses profile.*

| ID | Requirement |
|---|---|
| F-SW-1 | **Where it lives.** The profile is the first screen of the Progress tab and is also reachable from Today when it has changed. It replaces the six bare skill bars of F-PG-1 with the same six skills plus the detail behind each. |
| F-SW-2 | **Strengths first.** The profile opens with three things the learner does well, chosen from patterns they find more often than typical players at their level, phases in which their accuracy is above their band, openings they score well in, and habit rules they keep. The research on mastery goals says learners who see what they can do keep going, so strengths are never an afterthought. |
| F-SW-3 | **Weaknesses, ranked by cost.** Beneath the strengths sit the three weaknesses that cost the most, ranked by how often they occur multiplied by how much expected score they lose, with recent games weighted more heavily. Each shows a plain name ("Knight forks against you"), a count ("9 times in 20 games"), the typical-for-level flag ("most players at your level miss this too" or "unusual for your level"), and the lesson and drill that fix it. |
| F-SW-4 | **The detail behind each skill.** Tapping a skill opens its breakdown. Tactics shows each pattern with found, missed and allowed counts. Endgames shows accuracy by ending type and conversions of winning positions. Openings shows the learner's five most played lines as White and Black with results, accuracy, and the move at which they usually leave the book, plus what players at their level play there. Board vision shows pieces left hanging and free pieces missed per game. Thinking and habits shows the habit score trend, moves made in under ten seconds, and blunders in winning positions. Strategy shows accuracy in quiet positions and in positions with no forcing moves. |
| F-SW-5 | **Compared with your level.** Every number in the profile sits beside the typical value for the learner's band, taken from the rating-bucketed mistake statistics mined from the Lichess database (section 9.1). The comparison is worded, never just a number ("you hang pieces about half as often as most 800s"). |
| F-SW-6 | **Confidence and sample size.** The profile shows how many games it is built on. Below ten games it shows only counts and no comparisons. From ten games it shows comparisons labelled "early". From thirty games the labels drop. The research shows three or four recurring patterns appear within about twenty games, so the profile is designed to be useful early without over-claiming. |
| F-SW-7 | **Change over time.** A "what changed" section compares the last 20 games with the 20 before, in words ("you have stopped leaving the back rank open, forks are still the main problem"). It is also the content of the weekly summary email and push (F-EN-7). |
| F-SW-8 | **Shareable and exportable.** The profile can be exported as an image without the rating, and the underlying data as a file, for a learner who works with a human coach. |

*Tailored sessions.*

| ID | Requirement |
|---|---|
| F-TS-1 | **What a tailored session is.** A one-off session built from the profile rather than from the path, sized to the learner's daily goal. It contains one tailored lesson (F-TS-3), a practice set of six to ten puzzles (F-TS-4), one targeted game or mini-game (F-TS-5), and the review of that game. It is offered whenever the profile changes materially (a new weakness enters the top three, or an import completes) and on demand from the profile screen with "Train on this". The daily plan (F-HM-2) swaps in a tailored session in place of the path's lesson at most twice a week, so the path still progresses. |
| F-TS-2 | **How it chooses.** The session targets the highest-cost weakness that the curriculum can address at the learner's band. A weakness above the learner's band (a Section 4 idea for a Section 2 learner) is shown in the profile with "later on the path" and is not drilled yet. Two weaknesses can be combined when they share a lesson. The choice and the reason are stated in one sentence at the top of the session. |
| F-TS-3 | **The tailored lesson.** The lesson that teaches the weakness is reassembled with the learner's own positions. The lesson card and explain screens stay as authored. The challenges are drawn first from the learner's own games (the position before the mistake, with the opponent's move replayed, verified by the engine to have a single clear answer), then from the concept bank at the learner's difficulty. The coach's feedback names the game ("This is from your game against Rosa on Tuesday"). If a learner has already completed the lesson on the path, the tailored version counts as a review lesson. |
| F-TS-4 | **The practice set.** Six to ten puzzles, own positions first, then similar positions from the concept bank, interleaved with one or two puzzles from a strength so the learner is not told what to look for every time. Positions that the engine cannot verify as single-answer are shown as "play it out" drills instead. |
| F-TS-5 | **The targeted game.** A bot game or mini-game chosen to provoke the weakness. For an opening weakness the opponent plays the line the learner struggles with, as the other colour. For a tactical weakness the game starts from one of the learner's own positions a few moves before the pattern arose, or the teaching-mode opponent (first update) steers toward it. For an endgame weakness the game is a set-position drill of that ending. Coach mode is on and prompts the relevant thinking-process question at the key moment. |
| F-TS-6 | **Closing the loop.** The session ends with the review of the game, a one-line verdict on the weakness ("two forks seen, one missed, better than last week"), and the next check date, when the app will look at whether the weakness has moved. The result is written back to the profile so the next session targets the next thing. |
| F-TS-7 | **For learners with no games yet.** Before any games exist, the profile is seeded from checkpoint results and puzzle attempts, and the first tailored session is offered after the learner's tenth in-app game. |

**Deferred.** Comparison of the learner's profile with a named friend, and a coach's view of several learners' profiles, wait for social and classroom features.

### 8.15 Accessibility

| ID | Requirement |
|---|---|
| F-AX-1 | A non-visual mode, in the Lichess blind-mode style, offers text move entry in standard notation, a keyboard-navigable board, a spoken or screen-reader readout of the position, of the last move and of feedback, and the same for lessons and puzzles. This is built with the lesson player, not retrofitted. |
| F-AX-2 | Highlights for good and bad moves never rely on red and green alone. |
| F-AX-3 | Piece animation and celebration effects respect the reduced-motion setting. |
| F-AX-4 | Touch targets are at least 44 pixels, boards are full width on phones and text scales with the system setting. |
| F-AX-5 | Every screen passes automated accessibility checks and the core flows are tested with VoiceOver and TalkBack before launch. |

---

## 9. Content strategy and pipeline

### 9.1 Sources

| Content | Source | Licence | Note |
|---|---|---|---|
| Puzzles | Lichess puzzle database, 6.1 million rated and tagged puzzles | CC0 | Curated to about 200,000 covering every theme and band, shipped as packs |
| Puzzle theme names and definitions | Lichess theme list (English) | CC0 | Reused verbatim where they read plainly, rewritten where they do not |
| Opening names | lichess-org chess-openings, about 3,500 named lines | CC0 | Built into a lookup keyed on position |
| Opening statistics by rating band | Lichess opening explorer API | Terms of use, one request at a time | Cached on the server, shown as "what players at your level do here" |
| Endgame truth | Lichess tablebase API, plus a bundled three-to-four-piece set for drills | Terms of use | Used for endgame drill goals and "only winning moves" |
| Story games | Public-domain games and annotations (Morphy to Alekhine), and Lichess games at the learner's band | Public domain and CC0 | All annotations rewritten in the coach's voice |
| Lesson positions and challenges | Authored by the content lead, engine-verified | Original | The main authoring effort |
| Mistake statistics by band | Mined from the roughly 6 per cent of Lichess games that carry engine evaluations, and the puzzle ladder | CC0 | Used for "typical at your level" flags and the bot error model |

Chess.com data is used only to fetch a learner's own games on demand. No chess.com assets (pieces, sounds, board colours, move-label glyphs) are copied.

### 9.2 Authoring format and workflow

Lessons are authored as move trees with comments, the same shape as a Lichess interactive study, and stored as JSON. The content lead may author directly in Lichess Studies (a format coaches already know) and export PGN, which the pipeline converts. Each challenge carries the position, the solution or acceptable solutions, per-variation feedback for expected wrong moves, hints, the theme tags and the habit rule it connects to.

The pipeline runs four checks before any challenge is published. The engine confirms the solution is best and, for single-solution challenges, that the second-best move is clearly worse. The motif tagger (the software that recognises which pattern a solution uses) confirms the tagged theme is present in the solution. A difficulty estimate is attached from the nearest Lichess puzzles. A human reviews every challenge in a lesson at least once. An independent audit of Duolingo Chess found about a quarter of one section's puzzles were ineffective or borderline, most often because the stated theme was not present or the position had several solutions, and this pipeline exists to make that impossible.

### 9.3 Volume and effort

The first release needs about 160 lessons, about 1,000 lesson challenges, 38 checkpoint banks of at least 30 held-out challenges each, about 40 story games, about 30 drill sets holding roughly 250 positions, 200,000 curated puzzles, a coach template bank of a few hundred lines, and 38 unit guidebooks. With engine assistance for candidate generation and verification, one experienced content lead can author and review roughly two lessons a day with their checkpoint items, which puts Sections 1 and 2 at about six weeks and Sections 3 and 4 at about ten weeks. Story games and drills add about four weeks. These are planning estimates and should be re-based after Section 1.

### 9.4 Quality bar

Every challenge must have exactly the solutions it claims. Every explanation must name only pieces, squares and moves present in the verified fact sheet. Every lesson must be readable by a 15-year-old with no chess vocabulary beyond what earlier lessons taught. Every checkpoint must be passable by a learner who did the unit and failable by one who did not, checked by pilot data. Learners can flag any item as wrong or confusing in one tap and flags are triaged weekly. When a challenge is corrected after learners have attempted it, the corrected challenge gets a new version, earlier attempts are kept in the log but excluded from mastery, and affected learners are not penalised.

---
## 10. Technical architecture

### 10.1 Principles

The heavy work (rules, board, engine, human-like model, review, repetition scheduling) runs on the learner's device. The server does identity, sync, content delivery and notifications. This is the architecture that lets Lichess serve five million games a day on about US$70,000 a year of servers (its 2022 server bill), and it is what makes "free forever" affordable. Two costs stay out of the design, sign-in services priced per user, and engine or language-model work done on the server while a learner waits.

### 10.2 Stack

The stack aligns with the owner's existing toolchain (Next.js, Vercel, Supabase) so that AI-assisted development in Cursor can move fast.

| Layer | Choice | Licence | Why |
|---|---|---|---|
| Framework | Next.js (App Router) with React and TypeScript, deployed on Vercel | MIT | Owner's stack, route-level code splitting, server components for the few server-rendered pages |
| PWA | Serwist (Workbox for Next.js) with a custom service worker, a web manifest with maskable icons and screenshots | MIT | Precache the shell, cache packs and the engine at runtime, background update notice |
| Rules and notation | chess.js 1.x | BSD-2 | Permissive, small, sufficient. Lesson move trees are stored as JSON so the client never parses PGN variations |
| Board | react-chessboard 5.x, with a custom board component as a fallback if drag performance on low-end Android disappoints | MIT | Permissive and mobile-ready. chessground is better engineered but GPL, so it is only an option if the app goes open source |
| Engine | stockfish.js "lite single-threaded" build in a dedicated Web Worker speaking UCI text over messages, upgraded to Stockfish 19 when published | GPL-3 (engine kept as a separate, unmodified binary with licence and source pointer shipped in the app) | About 7 MB, no special headers, depth 18 to 22 in seconds on a mid-range phone, more than enough for teaching |
| Human-like model (first update) | Maia-2 exported to ONNX, run with ONNX Runtime Web | MIT | The permissive human-like model. Maia-3 is more accurate but AGPL |
| Local data | Dexie (IndexedDB) with an outbox table | Apache-2 | Puzzles, packs, progress, error log, attempts, all offline |
| Backend | Supabase (Postgres, Auth, Row Level Security, Edge Functions, scheduled jobs) | Apache-2 | Owner's stack, Auth included at no per-user cost within plan limits |
| Content storage | Cloudflare R2 (or Supabase Storage at small scale) for versioned packs | Service | Free egress, immutable versioned objects |
| Push | Web Push with VAPID keys from a scheduled Edge Function, email through a transactional provider | Open standard | Android, desktop and installed iOS covered, email as fallback |
| Analytics and errors | PostHog (self-hosted or free tier) for product analytics and experiments, Sentry for errors | MIT (client libraries) | Experiments are a first-class need |
| Content pipeline | Python with python-chess and the Stockfish command-line engine, run offline in CI | GPL (server side, not distributed) | Verification, tagging, pack building |
| Pieces and sounds | cburnett pieces under their BSD option or the Apache-licensed chessnut set, sounds recorded or sourced under CC0 | Permissive | Lichess's default sounds and chess.com's assets are not free to reuse |

### 10.3 Client components

- **Board and rules.** One board component used everywhere, with modes for lesson, puzzle, play, review and drill. Legal move generation, check and mate detection and notation from chess.js.
- **Engine service.** A single worker instance per page with a request queue, UCI options set for teaching (Hash 16 to 32 MB, Threads 1, MultiPV as needed), and an idle timeout that terminates the worker to free memory. Paused while a drag is in progress.
- **Analysis service.** Runs a game through the engine at fixed depth, converts evaluations to expected score with the Lichess curve, assigns labels with rating-aware thresholds, selects key moments by swing, runs the motif tagger on each key moment, and produces the review object and the error log entries.
- **Motif tagger.** A port of the pattern rules in the Lichess puzzle tagger to TypeScript over chess.js, used by the review, the coach and the pipeline. First-release scope: hanging piece, fork, pin, skewer, discovered attack and check, double check, back-rank mate, mate in one to three, removing the defender, overloading, deflection, attraction, trapped piece, promotion, perpetual check and stalemate. The tagger is tested against a labelled sample of 2,000 Lichess puzzles and must agree with their tags at least 95 per cent of the time before release.
- **Coach service.** Maps engine facts and tags to lines from the template bank, with per-persona variation.
- **Bot service.** Builds each bot from a persona file (rating, style weights, opening preferences, error parameters), requests multi-line output from the engine, samples a move by rating and style, and applies the error model. Swaps to Maia-2 sampling when the flag is on.
- **Scheduler.** Maintains concept and mistake review items on the expanding ladder and assembles the daily plan and the puzzle set.
- **Rating service.** Glicko-2 for puzzles (learner versus puzzle, using the puzzle's rating and deviation) and for bot games (learner versus bot as a rated entity), and a blended estimate for display. Computed on device for instant feedback and recomputed on the server from the event log as the authoritative value.
- **Sync.** Every state change is an event with a client-generated identifier. Events are written locally and to the outbox, flushed on start, on reconnect and after each write. The server applies events idempotently and returns snapshots and deltas.

### 10.4 Server components

- **Auth and profiles.** Supabase Auth with email magic link, Google and Apple. Row Level Security on every table so a learner can only read and write their own rows.
- **Events and snapshots.** An append-only `events` table keyed by user, a materialised `progress_snapshot` per user rebuilt by a job, and read endpoints for "snapshot since".
- **Content manifest.** A signed manifest listing pack versions and sizes. Packs are immutable objects on R2.
- **Import proxy.** An Edge Function that fetches a user's games from Lichess or chess.com one request at a time with caching and rate limits, so the browser never calls those APIs directly with a user's identity. Chess.com monthly archives are cached by their tags so a re-import of an unchanged month costs nothing, and a daily job checks for new games for signed-in learners who opted in (F-IM-4).
- **Profile builder.** A function that adds up the per-game records (labels, tagged mistakes, habit results, phase accuracy, opening lines) into the strengths and weaknesses profile, ranks weaknesses by cost, compares each figure with the band statistics, and writes the "what changed" summary. It runs on the device after each review and on the server from the event log as the authoritative value, the same split as the rating service.
- **Session builder.** A function that turns the top addressable weakness into a tailored session (section 8.14), selecting the lesson, the learner's own positions that the engine has verified as single-answer, concept-bank puzzles at the right difficulty, and the targeted game setup.
- **Batch analysis worker (optional).** Imports of several hundred games can outrun a phone. A server-side queue running the same engine at the same depth is held in reserve for imports over 50 games, off the request path, at a few seconds of CPU per game.
- **Explorer and tablebase cache.** An Edge Function that proxies and caches Lichess explorer and tablebase responses, keyed by position and rating band, to stay within the etiquette of shared infrastructure.
- **Notifications.** A daily job selects learners due a reminder, picks a template, and sends push or email.
- **Analytics pipeline.** Product events to PostHog, with a nightly export of learning metrics (mastery deltas, checkpoint pass rates, review rates) to Postgres for the dashboards in section 12.

### 10.5 Data model (sketch)

Content is delivered as versioned JSON packs, not database rows, so the client can work offline and the server stays simple.

**Content packs.** `sections`, `units`, `lessons`, `challenges` (position, prompt, solutions, wrong-move feedback, hints, tags, habit rule, difficulty), `checkpoint_banks`, `story_games` (moves, per-move commentary, guess-the-move scoring), `drills`, `puzzles` (identifier, position, moves, rating, deviation, themes), `personas`, `coach_templates`, `openings`.

**Learner data (device and server).** `profile` (why, goal, level, coach settings), `events` (append-only, typed), `lesson_progress`, `concept_mastery` (per concept, mastery and next review date), `error_log` (position, move, theme, phase, clock, lesson, typical flag, status), `puzzle_attempts`, `games` (moves, clock, persona, coach on or off, crowns, habit results), `reviews` (labels, key moments, explanations), `imported_games` (source, source identifier, month, analysis status), `profile_snapshot` (per skill and per pattern counts, comparisons, strengths, ranked weaknesses, what changed, games counted), `tailored_sessions` (target weakness, items, result, next check date), `ratings` (puzzle, bot, estimate, deviation), `streak`, `quests`, `achievements`, `downloads`, `outbox`.

### 10.6 Move classification rules (Lichess conversion, chess.com bands)

Expected score from centipawns: win per cent equals 50 plus 50 times (2 divided by (1 plus e to the power of minus 0.00368208 times centipawns) minus 1). Per-move accuracy equals 103.1668 times e to the power of minus 0.04354 times the win per cent drop, minus 3.1669. Labels are assigned by the drop in win per cent, with the thresholds in Appendix C scaled by the learner's rating band so that a 1.5-pawn disadvantage is "still playable" for a 600 and "lost" for a 1600. Mate-related judgements follow the Lichess rules. Great and Brilliant follow the rules stated in F-RV-2. The app implements the formulas from the published description and does not copy code from the Lichess repository, which is AGPL.

### 10.7 Bot error model (first release)

For each move the bot requests the top five to ten engine lines and converts them to expected scores. A base error probability is set per persona rating (calibrated so that the persona's results against learners match its label) and multiplied by a complexity factor (more legal captures and checks, more error) and by a phase factor (the opening error share falls with rating, as in the data). When the bot errs it chooses among lines whose refutation the tagger can name, preferring the error types typical for the band (hanging a piece and missing mate in one below 800, missing forks and back-rank threats from 800 to 1200, mis-trading and passive retreats above). The bot never errs in a trivially forced position and never plays an illegal or instant-loss move above its band. Style weights bias the sample toward captures and checks (attacker), toward trades (trader) or toward quiet development (solid).

### 10.8 Browser and device support

Chrome and Edge on Android and desktop (last two years), Safari on iOS and macOS from 16.4, Firefox from 100, and Android WebView through a trusted web activity. The reference test device is a Galaxy A51 or Nokia G100 class phone on a throttled 7 Mbps, 94 ms connection. The engine ships in two builds, a faster one that uses the browser's WebAssembly SIMD feature (a way of doing several calculations at once) and a slower one for browsers without it, and the app picks the right build at load time.

---

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | App shell under 300 KB of JavaScript compressed. Time to first lesson under five seconds on the reference connection. Interaction to Next Paint under 200 ms on the reference phone, including while a piece is being dragged (during which the engine is paused). The engine is never on the critical path of first load. Board thumbnails in lists are static images. |
| Offline | Lessons, puzzles, drills, bot play and reviews of in-app games work with no connection once packs and the engine are cached. Sync is automatic and idempotent. |
| Reliability | Crash-free sessions above 99.5 per cent. No data loss on refresh, tab close or device sleep. Service worker updates never interrupt an activity. |
| Security | All data over HTTPS. Row Level Security on every learner table. No secrets in the client. Import and proxy endpoints rate-limited per user and per IP. Dependencies scanned in CI. |
| Privacy | The only personal data required for an account is an email address. Guest mode requires nothing. Product analytics are pseudonymous and exclude email. No third-party advertising or tracking SDKs. Self-service export and deletion. A privacy notice in plain language. The design is safe for under-13s by default because there is no chat, no profile discovery and no data collection in guest mode. |
| Licensing | A "Licences" screen lists every third-party component with its licence, and for Stockfish the version, the GPL notice and a link to the exact source. Any modification to the engine or its build is published. |
| Localisation readiness | All strings externalised, dates and numbers formatted by locale, layout tested with 30 per cent longer strings. English only at launch. |
| Accessibility | WCAG 2.2 AA for all screens, plus the non-visual board mode in F-AX-1. |
| Observability | Error tracking, performance monitoring on real devices, uptime checks, and dashboards for the metrics in section 2. |

---

## 12. Analytics and experimentation

Every feature ships with events. The team maintains three dashboards.

**Habit.** Daily active learners, current-user retention rate, day 1, 7 and 30 retention by cohort, streak distribution, daily plan completion, notification opt-in and open rates.

**Learning.** Checkpoint pass rates by unit (to find lessons that do not teach and checkpoints that are too easy), per-concept mastery curves, review rate of games, error-log trends, hanging pieces per game by cohort week, estimated rating gain per 100 hours by section, puzzle success rate against the 70 to 85 per cent target, share of learners with an import and a profile, tailored-session completion rate, and whether a targeted weakness falls in the 20 games after a tailored session compared with the 20 before.

**Quality and cost.** Content flags per thousand plays, engine analysis time by device class, performance metrics, cost per monthly active learner.

Experiments run through feature flags with cohort assignment. Four are planned for the first quarter after launch. The first compares targeted puzzles drawn from the error log with generic puzzles, measured on rating gain per hour. The second compares showing the rating estimate on the home screen with keeping it on the profile. The research identifies both of these as questions no published study has answered. The third compares coach comments during the game with comments after the game only. The fourth compares the two-day streak grace with a one-day grace.

---

## 13. Free model and sustainability

The product is free with no advertising, no subscription and no gated features, and this document treats that as a constraint to design around rather than a temporary state.

**Cost.** With the client-heavy architecture, the research's hosting estimate is about US$40 to 130 a month at 10,000 monthly active learners, US$200 to 900 at 100,000, and US$1,000 to 6,000 at one million, or about one cent or less per learner per month. The design excludes the two things that would multiply that cost, sign-in services priced per user and engine or language-model work done on the server while a learner waits. Language-model explanations, when added, are pre-generated for catalogue positions and cached per position for learner games, at a budget of about three per game.

**What keeps it free.** The content supply chain is built on CC0 data and original authoring. The engine and the human-like model are open source and run on the device. Puzzle and lesson packs are static files with free egress. Growth costs are dominated by content authoring, which is a fixed cost.

**Options for later, not commitments.** If the product grows past the point where the owner wishes to fund it, the Lichess model (a supporter badge for voluntary donations with no feature difference) is the only monetisation consistent with the principles in section 1.3. Institutional licences for schools and clubs, with the same free product for learners and a paid dashboard for teachers, are a second option. Both are out of scope for this document.

---
## 14. Release plan

The plan assumes a small team, one product owner (the document owner), two engineers working with AI-assisted tooling, one content lead who is a strong player or coach, and part-time design. Durations are estimates to re-plan after each phase. The order is chosen so that a usable learning loop exists as early as possible and content is the long pole.

| Phase | Duration | Scope | Exit test |
|---|---|---|---|
| **0. Foundations** | Weeks 1 to 6 | Design system and coach persona. Board, rules and engine worker. Lesson player with its non-visual mode. Lesson JSON format, authoring pipeline and verification. One bot with coach mode. Analytics and error tracking. Section 1 content. Guest mode. | A tester with no chess knowledge completes Section 1 on a mid-range Android phone and plays a legal game against the bot. |
| **1. Alpha** | Weeks 7 to 16 | Sections 1 and 2. Onboarding and placement. Rated and themed puzzles, daily puzzle. Bot ladder for the first two bands with coach mode and habit score. Basic review (labels, key moments, retry). Daily plan, streak, XP, quests. Offline shell and Section 1 and 2 packs. Non-visual mode extended to puzzles and play. | Twenty to fifty invited learners use the app for four weeks. Day 7 retention above 20 per cent and a review rate above 40 per cent. Checkpoint pass rates within the target band. |
| **2. Beta** | Weeks 17 to 30 | Sections 3 and 4. Full review with explanations, error log and fix-it drills. Import from chess.com, Lichess and PGN, with onboarding import. The strengths and weaknesses profile and tailored sessions. Story games and drills. Accounts and sync. Push and email. Downloads screen and persistent storage. Sprint and streak run. Skill profile, rating estimate, learning rank. Achievements and monthly challenge. Full accessibility pass. | Two hundred to five hundred open-beta learners for six weeks. Metrics on track for the section 2 targets. Content flag rate under 1 per cent. Performance budget met on the reference phone. |
| **3. Launch** | Weeks 31 to 36 | Hardening, content fixes from beta, licences screen, privacy notice, store listing for Android via a trusted web activity, launch content and landing page. | Public launch. |
| **First update (v1.1)** | The quarter after launch | Maia-2 human-like bots behind a flag. Language-model phrasing of explanations behind a flag with a budget. Teaching-mode opponent. Server-side batch analysis for large imports if device analysis proves too slow. Learning-XP league as an opt-in experiment. The four experiments in section 12. | Flags promoted only if the experiments show a gain on learning or retention with no loss on the other. |
| **v2 (planned, not committed)** | Later | Section 5 (1600 to 2000). Friend streaks and a study buddy. A kids' mode with parental controls. Teacher and club dashboards. Additional languages, starting with Spanish and Portuguese. A native iOS shell if push and store discovery become growth blockers. Human-versus-human play only if the team can staff moderation and fair play. | Decided after v1 data. |

---

## 15. Risks and mitigations

| Risk | Likelihood and impact | Mitigation |
|---|---|---|
| Content is the long pole and quality slips under schedule pressure | High, high | Engine verification and tagging in the pipeline, one human review per lesson, learner flags, and a hard rule that a section does not ship with unverified challenges. Re-plan after Section 1. |
| Engine performance or memory on low-end phones and in iOS web views | Medium, high | Lite single-threaded build, hash capped at 32 MB, worker terminated when idle, fixed-depth review with a progress bar, SIMD detection with fallback, weekly testing on the reference device. |
| iOS storage eviction and missing push in Safari tabs lose learners' progress and reminders | Medium, medium | Account sync as the real fix, an early and well-explained install prompt, a server-set recovery cookie, email as the reminder fallback. |
| Bot ratings do not match human ratings, so learners meet opponents that are far too strong or too weak | High, medium | Calibrate personas against learner results in alpha and beta, adjust error parameters per persona, show bots as bands not exact numbers until calibrated. |
| The product drifts into a puzzle stream because puzzles are cheap to ship and easy to measure | Medium, high | The North Star excludes unreviewed play and counts a puzzle set once a day rather than by volume, the default daily plan contains a game and a review, and the learning dashboard tracks review rate and hanging pieces per game rather than puzzles solved. |
| Language-model explanations teach wrong ideas with confident prose | Medium, high | Deferred to the first update, grounded in verified facts only, output validated against the fact sheet, templates as the fallback, cached per position. |
| Licence non-compliance (GPL engine, non-free pieces or sounds, chess.com assets) | Low, high | The licence matrix in Appendix D, a licences screen, original assets only, engine kept as a separate unmodified binary with source pointer, a pre-launch licence review. |
| Retention below target because the beginner band is prone to tilt and quits after losses | Medium, high | Streaks on effort, no penalties for mistakes, cool-down nudges, coach mode on by default, fast first wins in Section 1, and the four experiments in section 12. |
| Costs grow with success | Low, medium | Client-heavy architecture, static packs with free egress, no per-user auth pricing, explanations cached, cost per learner tracked monthly. |
| Chess.com or Lichess change or restrict their public game APIs, or rate-limit the import proxy | Medium, medium | PGN file import as the source that cannot be taken away, monthly-archive caching so each game is fetched once, one request at a time with a descriptive user agent, and the profile built from in-app games as well so the product does not depend on imports. |
| Analysing hundreds of imported games on a phone is slow or drains the battery | Medium, medium | The first ten games are analysed at once and the rest in the background only while the app is open, at review depth, with progress shown. The server batch worker is held in reserve and switched on if beta shows device analysis is too slow. |
| The profile over-claims from too few games | Medium, medium | No comparisons below ten games, "early" labels to thirty, weaknesses ranked by cost rather than count, and copy that says how many games the profile is built on. |
| A single content lead or engineer is a bus-factor risk | Medium, medium | The authoring format and pipeline are documented so a second author can start within a week, and all content lives in version control. |
| Scope creep toward online play, social features and kids' mode before the loop is proven | Medium, high | Section 5.2 and the release plan are the contract. Anything not in them waits for v1 data. |

---

## 16. Dependencies and assumptions

- Lichess keeps publishing its puzzle and game databases under CC0 and keeps its explorer and tablebase APIs open under the current terms. If either changes, the pipeline already holds local copies and the app degrades gracefully by hiding the explorer feature.
- The stockfish.js maintainer publishes a Stockfish 19 lite build. Until then the Stockfish 18 build is used.
- Maia-2 can be exported to ONNX at a size and latency acceptable on the reference phone. If not, the first-release bot model stays and Maia moves to the server for a "human-like second opinion" in reviews only.
- Supabase plan limits cover the expected user counts for the first year at the Pro tier. Costs are reviewed monthly against section 13.
- The content lead is a player of at least club strength with coaching experience, or the team engages one.

---

## 17. Open decisions

| Decision | Options | Needed by |
|---|---|---|
| Product name and domain | Working title "ChessApp" | Phase 0 |
| Coach persona name, look and voice | To be designed with the design system | Phase 0 |
| Open source or proprietary | Proprietary with permissive libraries (as specified), or AGPL which unlocks chessground, chessops and Maia-3 and fits a "free forever" positioning | Phase 0, since it changes the board and rules libraries |
| Section 1 delivery style | Star-collecting mini-levels (Lichess Learn style) as specified, or the plainer lesson format used elsewhere | Phase 0 |
| Board component | react-chessboard as specified, or a custom component from the start | Phase 0, decided by a drag-performance test on the reference phone |
| Pack storage | Cloudflare R2 from day one, or Supabase Storage until 10,000 learners | Phase 1 |
| Product analytics vendor | PostHog (self-hosted or cloud), or Plausible plus a custom events table | Phase 0 |
| Pilot cohort | Invited adults, a local school or club cohort, or both | Phase 1 |
| First non-English languages | Spanish and Portuguese are the obvious regional choices | v2 |

---

## Appendix A. Curriculum detail

Bands are chess.com rapid ratings. Each unit ends in a checkpoint on unseen positions. "Habit" names the Building Habits rule the unit introduces or reinforces. Every unit from 2.1 onward includes one story game, and units marked SG carry extra or specific games. Mini-games and drill sets are marked D.

### Section 1. Foundations (new to chess to 400)

| Unit | Lessons | Habit and extras |
|---|---|---|
| 1.1 The board and the pieces | The board, files, ranks and square names. The rook. The bishop. The queen. The king. The knight. The pawn, promotion and en passant. Setting up the board. | D: rook road, bishop rails, knight hops, pawn parade. Vision trainer introduced. |
| 1.2 Capturing and value | Attack, capture and defend. Piece values. Take free pieces. Do not leave pieces free. Counting attackers and defenders on one square. | Habit: take hanging pieces, never hang your own. D: pawn wars, queen against eight pawns, knight against pawns. |
| 1.3 Check, mate and draws | Check and the three ways out. Checkmate. Mate in one. Stalemate. The three draws (stalemate, repetition, insufficient material). | D: king hunt (mate, do not stalemate). |
| 1.4 Castling and the rules of play | Castling both sides and its four conditions. En passant again. Touch move, offering a draw, resigning, notation basics, setting the clock. | Habit: castle as soon as possible. |
| 1.5 Your first mates | The ladder mate. King and queen against king. King and rook against king. The back-rank mate. Meeting Scholar's mate and Fool's mate. | D: the checkmate ladder (queen and rook, two rooks, queen, rook). |
| 1.6 Safety first | The three questions before every move (is my piece safe, can I take something, is my king safe). Look at all checks and captures. Your first full game with the coach. | Habit level one in full: no gambits, no sacrifices, castle early, centre first, accept equal trades. First coached games. |

### Section 2. Safety and the first tactics (400 to 800)

| Unit | Lessons | Habit and extras |
|---|---|---|
| 2.1 Real Chess | What does the opponent's last move threaten? The threat scan (checks, captures, threats for the opponent). Hanging pieces on both sides. Counting on a contested square. The sanity check before you move. | Habit: look at the opponent's threats before your own idea. |
| 2.2 Forks | The knight fork. The pawn fork. The queen fork and the family fork. Setting up a fork with a check. | Habit level two begins here, basic tactics are now allowed. SG: a 700-rated game decided by a fork. |
| 2.3 Pins and skewers | The absolute pin. The relative pin. Spotting a pin on both sides. The skewer. Keeping a pin rather than capturing early. | Habit: keep a pin. |
| 2.4 Back-rank and helper mates | The back-rank weakness and making an escape square. Support mate. Corridor mate. Smothered mate, the pattern. Damiano's mate. | Habit: make an escape square for the king after development. |
| 2.5 Discovered attacks | Discovered attack. Discovered check. Batteries on a line. | |
| 2.6 Opening principles and your first opening | Centre, development, castle early. Do not move the same piece twice, do not bring the queen out early. The Italian Game as White. Meeting 1.e4 with 1...e5 and 1.d4 with 1...d5. The target position (central pawns, minor pieces out, castled, rooks connected). | Habit: attack a bishop or knight on g4, g5, b4 or b5 with the flank pawn. |
| 2.7 Endgame rules that decide games | What can and cannot mate. The rule of the square. King in front of the pawn and direct opposition. The rook-pawn draw. The promotion race. Activate the king in the endgame. | Habit: activate the king and attack pawns in the endgame. D: king and pawn war. |
| 2.8 Notation, the clock and slow games | Reading and writing full notation. Using most of your time and never playing a bad move fast. Going over your own game to find the first mistake. | Habit: manage the clock. SG: two beginner games reviewed move by move. |

### Section 3. Fluency and planning (800 to 1200)

| Unit | Lessons | Habit and extras |
|---|---|---|
| 3.1 Removing the defender and exploiting pins | Capture the guard. Overloading. Winning a pinned piece by attacking it again. Deflection, first look. | |
| 3.2 X-ray, double check and discovered check in depth | X-ray attacks and defences. Double check. Discovered check with gain. | |
| 3.3 Trapped pieces and promotion | Trapping a piece. Promotion tactics and under-promotion. Advanced pawns as weapons. | Habit: rooks belong behind passed pawns. |
| 3.4 Named mates, first wave | Anastasia's, Arabian, Greco's and Opera mates. Morphy's, Pillsbury's and Boden's mates. Lolli's, Épaulette, Dovetail and Hook mates. Blind swine on the seventh. | D: mate patterns I and II. |
| 3.5 Drawing weapons | Perpetual check. Stalemate tricks as a defence. When to take a draw. | Habit: play to checkmate, never resign. |
| 3.6 The four elements | Force, time, space and pawn structure. Piece activity and improving the worst piece. Trading when ahead, avoiding trades when behind. | Habit: capture toward the centre with pawns. |
| 3.7 Files, ranks and pawns | Open files and doubling rooks. The seventh rank. Passed pawns. Isolated, doubled and backward pawns as targets. | Habit: double rooks on open files. |
| 3.8 King safety and attacking the king | The pawn shield and when not to castle. Batteries against the king. Opening lines with pawn advances. Recognising an attack coming. | Habit: do not weaken the king's pawns without reason. |
| 3.9 Endgames continued | Distant and diagonal opposition. King and pawn against king, complete. Queen against a pawn on the seventh. Rook against a pawn. Passed pawns must be pushed and blockaded. | D: pawn endgame set. |
| 3.10 Building a repertoire skeleton | What a repertoire is and why plans beat lines. White, the Italian in depth or the London System or the Queen's Gambit. Black against 1.e4, the Caro-Kann or the Scandinavian. Black against 1.d4, the Slav or the Queen's Gambit Declined. What players at your level do here (the explorer at your band). | Habit: develop to aggressive squares, castle early with judgement. |
| 3.11 Candidate moves and the blunder check | Two or three candidate moves before calculating. Checks, captures and threats for the opponent's replies. Forcing lines to three ply. The blunder check as the last step. Time budgeting by phase. | Habit: premove only when recapturing or under ten seconds. |
| 3.12 Story games | Four annotated games in the Logical Chess style, guess the move. | SG: Morphy at the Opera and three games at 1000 level. |

### Section 4. Club player (1200 to 1600)

| Unit | Lessons | Habit and extras |
|---|---|---|
| 4.1 Deflection and decoy | Deflection in depth. Decoy and attraction. The removal-of-the-guard family together. | |
| 4.2 Interference, clearance and desperado | Interference. Line and square clearance. Desperado. | |
| 4.3 In-between moves and defence | The zwischenzug. Counter-attack instead of retreat. Interposition and desperado defence. Recognising the opponent's threats two moves deep. | Habit level three: active not reactive chess, no lost pieces. |
| 4.4 Zugzwang, the Greek gift and named mates, second wave | Zugzwang as a weapon. The Greek gift sacrifice. Légal's, Blackburne's, Mayet's, Réti's and Anderssen's mates. Triangle and kill-box mates. | |
| 4.5 Combinations and calculation | Combinations as chains of motifs. Comparing candidates rather than analysing one to death. Forcing lines to five ply. Knowing when a position is critical. | Habit: piece-value rules (three minor pieces beat a queen, two rooks beat a queen, two pieces beat a rook). |
| 4.6 Stean's six | Outposts and holes. Weak pawns. Open and half-open files. Colour complexes and the good and bad bishop. Space. The minority attack. | |
| 4.7 Bishops, knights and the isolated pawn | The bishop pair in open positions. Knight against bishop rules of thumb. Playing with and against the isolated queen's pawn. Pawn majorities and creating a passed pawn. | |
| 4.8 Reading the position and making a plan | The imbalances. Which side of the board to play on. The initiative. What does my opponent want (prophylaxis, first look). Exchanging to a plan. | Habit: look for key squares and outposts. |
| 4.9 Rook endings | The Lucena bridge. The Philidor defence. The rook on the seventh. Rooks behind passed pawns. Cutting the king off. The active rook. | D: rook endgame set. |
| 4.10 Pawn endings and the wrong bishop | Key squares. Triangulation and outflanking. The breakthrough. The wrong-coloured bishop. Opposite-coloured bishops and the drawing tendency. | D: pawn endgame set II. |
| 4.11 Opening plans through model games | The slow Italian plan. The Carlsbad minority attack. The King's Indian Attack plan. The Caro-Kann c5 break. How to study one model game. | SG: five model games. |
| 4.12 Practical skills | Critical moments and where the time goes. Time trouble rules (never move with under ten seconds unless forced). Playing the board not the rating, recovering after a blunder, tilt and the cool-down. Keeping an error log and reading it. | Section complete on the checkpoint. The target habit score and estimated band are shown as guidance. |

---

## Appendix B. Puzzle theme difficulty ladder

Median puzzle rating by theme from an original analysis of 5.05 million rated Lichess puzzles (September 2026 dump, deviation at most 100, at least 50 plays). Puzzle ratings run about 250 points above game ratings on Lichess, and chess.com game ratings run a further 300 to 600 points below Lichess at the beginner end, so a "1300" puzzle sits near the 700 to 900 chess.com band. The ladder is a starting assumption, and the learner's own record overrides it once there are enough attempts.

| Theme | Median puzzle rating | Share rated under 1200 | Section where drilled |
|---|---|---|---|
| Back-rank mate | 859 | 85 per cent | 1 and 2 |
| Mate in one | 927 | 81 per cent | 1 |
| Smothered mate | 978 | 70 per cent | 2 and 3 |
| Mate in two | 1126 | 60 per cent | 2 |
| Attacking f2 or f7 | 1121 | 58 per cent | 2 |
| Skewer | 1303 | 43 per cent | 2 |
| Fork | 1325 | 41 per cent | 2 |
| Mate in three | 1345 | 38 per cent | 3 |
| Hanging piece (with a preparatory move) | 1385 | 39 per cent | 3 |
| Rook endgame | 1406 | 37 per cent | 4 |
| X-ray | 1406 | 30 per cent | 3 |
| Discovered attack | 1453 | 30 per cent | 2 and 3 |
| Promotion | 1480 | 31 per cent | 3 |
| Deflection | 1519 | 24 per cent | 3 and 4 |
| Capturing the defender | 1584 | 12 per cent | 3 |
| Pin (exploiting it) | 1605 | 19 per cent | 3 |
| Double check | 1622 | 20 per cent | 3 |
| Sacrifice | 1649 | 19 per cent | 4 |
| Attraction | 1652 | 10 per cent | 4 |
| Trapped piece | 1659 | 7 per cent | 3 |
| Intermezzo | 1664 | 11 per cent | 4 |
| Interference | 1675 | 14 per cent | 4 |
| Knight endgame | 1698 | 23 per cent | 4 |
| Bishop endgame | 1717 | 20 per cent | 4 |
| Pawn endgame | 1795 | 19 per cent | 4 |
| Clearance | 1807 | 12 per cent | 4 |
| Zugzwang | 1925 | 12 per cent | 4 |
| Defensive move | 1976 | 8 per cent | 4 and later |
| Quiet move | 2048 | 7 per cent | Later |

Below 800 puzzle rating, four puzzles in five are mates and half are mate in one. From 1800 upward the growth is in defensive moves, quiet moves and long lines.

---

## Appendix C. Move label thresholds

The app assigns labels by the drop in expected score (win per cent) between the best move and the move played, using the published Lichess conversion from centipawns to win per cent. The base thresholds follow chess.com's documented expected-points bands (5, 10 and 20 points), which are stricter than Lichess's (10, 20 and 30), because the product is closer to chess.com. The band scaling then makes the labels more generous for lower ratings, which both platforms say they do.

| Label | Base drop in win per cent | Section 1 and 2 scaling | Section 3 | Section 4 |
|---|---|---|---|---|
| Best | 0 | same | same | same |
| Excellent | under 2 | under 3 | under 2.5 | under 2 |
| Good | 2 to 5 | 3 to 8 | 2.5 to 6 | 2 to 5 |
| Inaccuracy | 5 to 10 | 8 to 15 | 6 to 12 | 5 to 10 |
| Mistake | 10 to 20 | 15 to 25 | 12 to 22 | 10 to 20 |
| Blunder | 20 or more | 25 or more | 22 or more | 20 or more |
| Miss | A mistake or worse played when the opponent's previous move was a mistake or worse | same | same | same |
| Great | The only move that keeps the evaluation from dropping by a mistake or more | same | same | same |
| Brilliant | A sound sacrifice (material given up and not immediately regained) that is best or excellent, from a position that was not already clearly winning | same | same | same |
| Book | A move within the first ten moves that appears in at least 5 per cent of games from that position in the bundled opening book (built from the Lichess database across all bands, so it works offline) | same | same | same |

Mate handling follows the Lichess rules (allowing a forced mate is a blunder unless the position was already lost by a wide margin, and delaying a mate carries no label). Thresholds are to be tuned in beta so that the label distribution at each band looks like the distribution on the incumbent platforms.

---

## Appendix D. Licence matrix

| Asset | Licence | Use in this product | Obligation |
|---|---|---|---|
| Lichess games, evaluations, puzzles | CC0 | Content pipeline and shipped puzzle packs | None |
| Lichess puzzle theme names (English) | CC0 | Reused | None |
| lichess-org chess-openings | CC0 | Opening names | None |
| Lichess explorer and tablebase APIs | Terms of use | Proxied and cached | One request at a time, cache, consider donating |
| Stockfish and stockfish.js | GPL-3 | Separate unmodified engine binary in a worker speaking UCI | Ship licence and source pointer, publish any modifications |
| Maia-2 | MIT | Human-like model (first update) | Notice |
| chess.js | BSD-2 | Rules | Notice |
| react-chessboard, cm-chessboard, Workbox, Serwist, ONNX Runtime Web | MIT | Client | Notice |
| Dexie | Apache-2 | Local data | Notice |
| cburnett pieces (BSD option) or chessnut (Apache-2) | Permissive | Piece set | Attribution |
| Sounds | Own recordings or CC0 | Sounds | None |
| python-chess | GPL-3 | Server-side pipeline only | None (not distributed) |
| Public-domain classic games and annotations | Public domain | Story games | Check the specific edition |
| chess.com public API | Terms of use, no data licence | Fetch a learner's own games on demand | Do not mirror, do not copy assets |
| Not used | chessground and chessops (GPL), Maia-3 (AGPL), Lichess sounds (non-free), non-commercial piece sets, chess.com assets, TWIC, Lumbras (non-commercial), ChessBase | | |

---

## Appendix E. Glossary

**Band.** A rating range used to group learners and content. **Checkpoint.** The test that closes a unit, on positions the learner has not seen. **Concept.** A teachable idea (a motif, a mate pattern, an endgame rule, an opening plan) with its own bank of positions. **Error log.** The learner's record of mistakes from games, tagged by theme. **Expected score.** The chance of winning from a position, used instead of raw engine numbers to judge moves. **Glicko-2.** The rating method used for puzzles and bot games, which tracks a rating and how certain it is. **Habit score.** How well a game followed the current habit rules. **Key moment.** A position in a review where the game turned or a chance was found or missed. **Motif.** A named tactical pattern such as a fork or a pin. **Motif tagger.** Software that recognises which motif a solution uses. **Path.** The single guided route through sections, units and lessons. **PWA.** A website that installs like an app and works offline. **Rating estimate.** The app's smoothed guess at the learner's chess.com-scale strength. **Repetition ladder.** The growing set of intervals at which a concept is reviewed. **UCI.** The plain-text protocol used to talk to a chess engine.

---

## Appendix F. Research index

The seven memos in the `research` folder, with what each contributed to this document.

| Memo | Used for |
|---|---|
| 00 Research synthesis | The ten findings in section 4 and the principles in section 6 |
| 01 Pedagogy and learning science | The learning model, coaching practice, repetition and interleaving rules, the case against marketing cognitive benefits |
| 02 Books and skill taxonomy | The section and unit outline in Appendix A, motif order, named mates, endgame sequencing |
| 03 Apps and platforms teardown | Feature parity with chess.com, the 26 borrowed patterns, the market gaps, pricing context |
| 04 Duolingo mechanics | The path, lesson anatomy, streak stack, quests, notifications, onboarding, the case against hearts and rating-based leagues, Duolingo Chess's Game Review design |
| 05 Data, engines and PWA technology | The stack, licences, engine builds, move classification formulas, explanation grounding, offline and iOS constraints, cost estimates |
| 06 Tutorials, classes and roadmaps | Building Habits rule sets, ChessDojo structure, rating conversions, class cadence, mini-games, assessment design |
| 07 Empirical improvement data | The Southwick per-hour figures, the puzzle ladder in Appendix B, error profiles by band, tilt and streak evidence, the mastery-over-rating rule |
