// Prints every challenge of a unit as prose + an ASCII board + legal-move facts,
// so a reviewer can check what the text CLAIMS against what the position IS.
// Review instrument only: not part of the build. Run it per unit before
// flipping that unit live -- `node scripts/dump-challenges.mjs 2.4` -- and read
// the output against each board. It exists because no automated gate catches
// prose that contradicts its own position: verify:content checks that answers
// are right, not that the sentences around them are true.
import { readdirSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const unit = process.argv[2];
if (!unit) { console.error('usage: dump-challenges.mjs <unit-id>'); process.exit(2); }
const dir = `content/section-2/unit-${unit}`;

const board = (fen) => {
  const c = new Chess(fen);
  const rows = c.board().map((rank, i) =>
    `${8 - i} ` + rank.map((sq) => (sq ? (sq.color === 'w' ? sq.type.toUpperCase() : sq.type) : '.')).join(' '));
  return rows.join('\n') + '\n  a b c d e f g h';
};

let count = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const arr = j.challenges ?? j.bank ?? [];
  console.log(`\n${'='.repeat(70)}\nFILE ${dir}/${f}  (${arr.length} challenges)`);
  for (const ch of arr) {
    count++;
    console.log(`\n--- ${f} :: ${ch.id}  [${ch.type}]`);
    // EVERY field except the position itself. An allow-list was the bug this
    // instrument shipped with: it printed prompt/explanation/options and left
    // out reason, reasons, hints and wrong -- 45.6% of the learner-facing
    // prose, and where a severe defect was actually found. A deny-list cannot
    // silently omit a field a future content schema adds.
    for (const [k, v] of Object.entries(ch))
      if (k !== 'fen' && v !== undefined) console.log(`  ${k}: ${JSON.stringify(v)}`);
    if (ch.fen) {
      const c = new Chess(ch.fen);
      console.log(`  fen: ${ch.fen}`);
      console.log(board(ch.fen).split('\n').map((l) => '   ' + l).join('\n'));
      console.log(`  toMove: ${c.turn() === 'w' ? 'White' : 'Black'}  inCheck: ${c.isCheck()}  legalMoves: ${c.moves().length}`);
      console.log(`  matesInOne: ${JSON.stringify(c.moves().filter((m) => { const t = new Chess(ch.fen); t.move(m); return t.isCheckmate(); }))}`);
    }
  }
}
console.error(`INSTRUMENT: unit ${unit} — ${count} challenges dumped`);
if (count === 0) { console.error('INSTRUMENT BROKEN — 0 challenges dumped'); process.exit(1); }
