const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const lines = html.split('\n');

const targets = [
  'screen-home',
  'screen-modes-hub',
  'screen-lobby',
  'screen-arrange',
  'screen-game',
  'screen-react-game',
  'screen-tournaments',
  'screen-leaderboard',
  'screen-profile',
  'screen-result'
];

targets.forEach(t => {
  const lineIdx = lines.findIndex(l => l.includes(`id="${t}"`));
  console.log(`${t}: line ${lineIdx + 1}`);
});
