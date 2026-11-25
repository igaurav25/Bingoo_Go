import fs from 'node:fs';
import path from 'node:path';

function walk(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const f of fs.readdirSync(dir)) {
    if (f === 'node_modules' || f === 'dist' || f === '.git') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, list);
    else if (/\.(js|jsx|ts|tsx)$/.test(p)) list.push(p);
  }
  return list;
}

const hooks = ['useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext', 'useReducer', 'useTransition'];
for (const file of [...walk('src'), ...walk('mobile')]) {
  const code = fs.readFileSync(file, 'utf8');
  const reactImportMatch = code.match(/import\s+([\s\S]*?)\s+from\s+['"]react['"]/);
  const importedStr = reactImportMatch ? reactImportMatch[1] : '';
  for (const h of hooks) {
    const used = new RegExp(`\\b${h}\\s*\\(`).test(code);
    const imported = new RegExp(`\\b${h}\\b`).test(importedStr);
    const viaReact = new RegExp(`React\\.${h}\\b`).test(code);
    if (used && !imported && !viaReact) {
      console.log('MISSING HOOK IMPORT:', file, 'uses', h);
    }
  }
}

// Check for hardcoded placeholder/fake identities across src and mobile
const suspectStrings = ['Rohit_23', 'Rohit_45', 'Rohit_Hitman', 'Virat_King', 'MS_Cool', 'BingoKing', 'Rival_07', 'Player123', 'user-player'];
for (const file of [...walk('src'), ...walk('mobile')]) {
  const code = fs.readFileSync(file, 'utf8');
  const found = suspectStrings.filter(s => code.includes(s));
  if (found.length > 0) {
    console.log('HARDCODED IDENTITY/MOCK:', file, found);
  }
}
