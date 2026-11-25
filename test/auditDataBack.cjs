const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');

const matches = [...html.matchAll(/data-back=["']([^"']+)["']/g)].map(m => m[1]);
console.log('data-back targets found in index.html:', matches);
