const fs = require('fs');

const js = fs.readFileSync('public/js/gameClient.js', 'utf8');

const modeKeys = [
  'quick-match',
  'private-room',
  'team-2v2',
  'friend-challenge',
  'knockout',
  'league',
  'practice',
  'offline',
  'survival',
  'time-challenge',
  'friends-league',
  'friends-knockout',
  'friends-hybrid'
];

modeKeys.forEach(k => {
  const hasModeCard = js.includes(`mode-${k}`);
  const hasBtnHandler = js.includes(`btn-start-${k}`) || js.includes(`btn-play-mode-${k}`) || js.includes(`btn-create-${k}`) || js.includes(`btn-launch-${k}`);
  console.log(`Mode "${k}": has mode navigation? ${hasModeCard}, button handler found? ${hasBtnHandler}`);
});
