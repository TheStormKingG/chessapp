# ChessApp

| | |
|---|---|
| **Date** | 16 September 2026 |
| **Owner** | Dr. Stefan Gravesande, Preqal Inc. |
| **Status** | Companion to the PRD v1.1 and the wireframe canvas |

## 1. The idea behind every screen

One idea runs through the whole interface. The learner plays a game, reviews it, and drills the mistake it revealed. The path supplies the order in which ideas are introduced, the error log supplies the order in which they come back, and the daily plan packages one pass through that loop in the time the learner chose. Everything else on the screen exists to make the next step obvious and the return tomorrow likely.

The research behind the PRD found that reviewing one's own games and taking short lessons move a beginner's rating five to seven times faster per hour than playing, while generic puzzles are no better than playing. The interface is arranged so that the high-value activities are the easy ones to reach and the low-value ones are the dessert.

## 2. Five destinations, one board

The bottom bar has five tabs, Today, Path, Puzzles, Play and Progress. Every screen inside them is built from the same three parts. A board at the top. The coach speaking beneath it. One primary action at the bottom. The board is the same component everywhere, so a learner who has solved a puzzle already knows how to play a game or answer a review. On a desktop the same three parts sit side by side, the board on the left and the coach and lesson on the right, with the navigation in a rail.

The coach is one persona with a fixed personality, warm and dry, never academic. The coach's lines are text in the first release and are generated from a template bank keyed on verified engine facts, so the coach never says something the engine has not confirmed.

## 3. Today is the front door

The streak sits in the corner and never moves. Beneath it the plan is a short checklist, one lesson, five puzzles, one game and its review, sized to the five, ten, fifteen or twenty minute goal the learner chose at onboarding. Anything the learner does elsewhere in the app ticks the matching item, so the plan adapts to the learner rather than the other way round. Below the plan sits the current path node and a row of dessert, the daily puzzle, a sprint and free play. After two losses in a row the plan offers a cool-down instead of a rematch, because the beginner band is the one most prone to tilt.

## 4. The path is linear and honest

The path is one vertical scroll with one active node. Completed nodes are tinted, future nodes are visible but locked, and a checkpoint closes every unit. Any checkpoint can be attempted early to test out. Amber review nodes appear when an idea falls due.

A lesson opens with a lesson card, one or two explain screens with arrows drawn on the board, and five to ten challenges that ramp from tapping a piece to finding the best move with no hint of the theme. Hints come in two stages, the piece first and then the square, and the hint accounting is shown plainly so the learner understands what hints cost. A wrong move gets authored feedback for that specific move and a retry before anything is revealed. Stars, a one-line takeaway and XP close the lesson.

## 5. Puzzles are driven by the learner's own mistakes

"Fix my mistakes" leads the Puzzles screen and the daily plan whenever it has items. It holds the exact positions from the learner's games first, then similar positions, on a schedule that brings each idea back just before it would be forgotten. Rated puzzles, themed practice with no timer and no rating, the daily puzzle with its calendar, two sprint modes and a vision trainer sit beneath it as variety. The theme is hidden while solving. After a miss, a "Why?" control shows the refutation and links to the lesson that teaches the idea. A thirty-day dashboard shows strengths and weaknesses by theme.

## 6. Play is coached

Opponents are named characters in the learner's band, each with a style and an opening preference, and they make the mistakes humans of that level make rather than the strange errors of a weakened engine. Coach mode, on by default for beginners, comments at most once per move, shows the opponent's threats on request, offers a hint in two stages and allows take-backs. Crowns reward playing without help. Three time controls are offered, untimed, ten minutes, and fifteen minutes with a ten second increment. Every game ends with the review offered as the next action.

## 7. Review is where the learning happens

The summary shows accuracy for both sides, the move at which the game left the opening book, a count of moves by label, the phase where the game turned, and a habit checklist graded automatically from the move list. Three to five key moments follow, a good move the learner found, a chance they missed and the mistake that decided the game. At each one the learner tries to find the better move before it is revealed. Explanations are short, in the coach's voice, built only from verified engine facts, and they point back to the lesson the mistake violates. Each mistake is written to the error log with its theme and phase. The review closes with a "fix it" drill of three to five puzzles and one suggested lesson.

## 8. Your own games become the curriculum

A learner who already plays online enters a chess.com or Lichess username, or drops in a PGN file, and the app fetches their recent games and analyses them exactly as it reviews its own. The ten most recent games are analysed at once, so a first picture appears within about five minutes, and the rest follow in the background. New games are picked up each time the app opens.

The results add up into a strengths and weaknesses profile, the first screen of the Progress tab. It opens with three things the learner does well, because learners who see what they can do keep going. Beneath that sit the three weaknesses that cost the most, ranked by how often they occur and how much each costs, each with a plain name, a count, a note on whether most players at that level share it, and the lesson and drill that fix it. Every figure sits beside the typical value for the learner's level, in words rather than numbers, and a "what changed" section compares the last twenty games with the twenty before. Below ten games the profile shows counts only, and to thirty games its comparisons are labelled early, so it never over-claims.

From the profile the app builds a tailored session. The lesson that fixes the top weakness is rebuilt around the learner's own positions, with the coach naming the game each came from. A practice set draws first from their mistakes and then from similar positions, with one strength mixed in so the learner is not told what to look for every time. A game is chosen to provoke the weakness, an opponent who plays the opening they struggle with, or a game that starts a few moves before the pattern arose in their own game. The review of that game closes with a verdict on the weakness and the date of the next check. Tailored sessions take the place of the path's plan at most twice a week, so the path keeps moving, and the learner can always decline one.

## 9. Progress shows mastery first and the rating second

Six skill bars, board vision, tactics, endgames, openings, strategy, and thinking and habits, each link to the drill that improves that skill. The learner's three most frequent mistakes are named. The learning rank counts checkpoints passed. The estimated rating is shown as a band on the chess.com scale with the Lichess equivalent beside it, a trend over the last thirty games, and a shaded zone marking the normal range of dips. The two numbers, progress and strength, are kept apart on purpose. A shareable progress card carries the rank, the streak and mastered skills, and no rating.

## 10. What the interface deliberately leaves out

There are no hearts, no energy, no leaderboard, no chat, no advertising and no paywall. Nothing depletes when a learner makes a mistake, because the mistake is the material. The app installs to the home screen, works offline for lessons, puzzles and play once packs are downloaded, and offers a text move entry mode with a spoken readout so a learner who cannot see the board can use every screen.

## 11. About the wireframes

The wireframes on the canvas are twenty phone screens, mid-fidelity and mobile-first at 390 pixels wide, with one desktop layout to show how the same three parts rearrange on a larger screen. Green is the single accent and marks primary actions and completed work. Amber marks review items. Dashed boxes are annotations for the build team, not interface. The phone screens are linked, so pressing Play on any of them clicks through the bottom bar and the lesson, play and review flows. Copy is illustrative and drawn from the PRD. The coach's name, the brand colours and the typeface are open decisions, and the opponent names are placeholders.
