import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('public/engine', { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) copyFileSync(`node_modules/stockfish/bin/${f}`, `public/engine/${f}`);
copyFileSync('node_modules/stockfish/README.md', 'public/engine/NOTICE');
writeFileSync('public/engine/SOURCE.txt', 'Stockfish.js 19.0.0 (GPL-3.0), unmodified. Source: https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.0\nStockfish: https://github.com/official-stockfish/Stockfish\n');
