const fs = require('fs');

const js = fs.readFileSync('public/js/gameClient.js', 'utf8');
const lines = js.split('\n');

lines.forEach((l, i) => {
  if (l.includes('btn-back-nav') || l.includes('data-back') || l.includes('popstate') || l.includes('navigateTo')) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
