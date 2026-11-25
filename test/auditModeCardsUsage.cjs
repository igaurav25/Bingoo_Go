const fs = require('fs');

const js = fs.readFileSync('public/js/gameClient.js', 'utf8');
const lines = js.split('\n');

lines.forEach((l, i) => {
  if (l.includes('modeCards')) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
