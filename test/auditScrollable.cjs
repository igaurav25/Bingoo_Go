const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');

const screenRegex = /<section[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/section>/gi;
let m;
while ((m = screenRegex.exec(html)) !== null) {
  const id = m[1];
  const content = m[2];
  const hasScrollable = content.includes('screen-scrollable');
  console.log(`${id}: has screen-scrollable? ${hasScrollable}`);
}
