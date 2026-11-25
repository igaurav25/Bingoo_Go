/**
 * scratch/project_audit.js
 * Scans all source files in the project for:
 * 1. Syntax/parse errors via esbuild transform
 * 2. Missing/broken local file imports
 * 3. Route mismatches between frontend fetch calls and backend endpoints
 */

import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const ROOT = process.cwd();
const DIRS_TO_SCAN = ['server', 'src', 'shared', 'mobile', 'public/js'];
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.system_generated') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (EXTENSIONS.some(ext => file.endsWith(ext))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function auditSyntax() {
  console.log('=== 1. AUDITING SYNTAX & COMPILATION ===');
  const allFiles = [];
  for (const dir of DIRS_TO_SCAN) {
    getAllFiles(path.join(ROOT, dir), allFiles);
  }
  console.log(`Found ${allFiles.length} source files to check.`);

  let syntaxErrors = 0;
  for (const file of allFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const ext = path.extname(file);
    let loader = 'js';
    if (ext === '.jsx') loader = 'jsx';
    else if (ext === '.ts') loader = 'ts';
    else if (ext === '.tsx') loader = 'tsx';

    try {
      await esbuild.transform(code, {
        loader,
        target: 'es2020',
        jsx: 'automatic'
      });
    } catch (err) {
      console.error(`❌ Syntax Error in ${path.relative(ROOT, file)}:`, err.message);
      syntaxErrors++;
    }
  }

  if (syntaxErrors === 0) {
    console.log('✅ All files compiled with zero syntax errors!');
  } else {
    console.log(`⚠️ Found ${syntaxErrors} syntax error(s).`);
  }
  return syntaxErrors;
}

function auditImports() {
  console.log('\n=== 2. AUDITING RELATIVE IMPORTS ===');
  const allFiles = [];
  for (const dir of DIRS_TO_SCAN) {
    getAllFiles(path.join(ROOT, dir), allFiles);
  }

  let brokenImports = 0;
  const importRegex = /(?:import|from|require)\s*\(?['"](\.[^'"]+)['"]\)?/g;

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const dir = path.dirname(file);
      const resolvedBase = path.resolve(dir, importPath);

      const possibleExtensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.ts', '/index.tsx'];
      const exists = possibleExtensions.some(ext => fs.existsSync(resolvedBase + ext));

      if (!exists) {
        console.error(`❌ Broken import in ${path.relative(ROOT, file)}: Cannot resolve "${importPath}"`);
        brokenImports++;
      }
    }
  }

  if (brokenImports === 0) {
    console.log('✅ All relative imports resolve correctly!');
  } else {
    console.log(`⚠️ Found ${brokenImports} broken relative import(s).`);
  }
  return brokenImports;
}

function auditEndpoints() {
  console.log('\n=== 3. AUDITING BACKEND API ENDPOINTS ===');
  const apiRoutesPath = path.join(ROOT, 'server/routes/apiRoutes.js');
  const serverPath = path.join(ROOT, 'server/server.js');
  
  const apiCode = fs.readFileSync(apiRoutesPath, 'utf8') + '\n' + fs.readFileSync(serverPath, 'utf8');
  
  // Extract all defined routes: router.get('/path' or app.post('/path'
  const routeDefRegex = /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
  const definedRoutes = new Set();
  let m;
  while ((m = routeDefRegex.exec(apiCode)) !== null) {
    const method = m[1].toUpperCase();
    const route = m[2];
    definedRoutes.add(`${method} ${route}`);
    // Also add with /api prefix if defined inside router mounted at /api
    if (!route.startsWith('/api')) {
      definedRoutes.add(`${method} /api${route}`);
    }
  }

  console.log(`Detected ${definedRoutes.size} backend endpoint signatures.`);

  // Now scan frontend fetch calls in src/ and mobile/
  const clientFiles = [];
  getAllFiles(path.join(ROOT, 'src'), clientFiles);
  getAllFiles(path.join(ROOT, 'mobile'), clientFiles);
  getAllFiles(path.join(ROOT, 'public/js'), clientFiles);

  const fetchRegex = /fetch\s*\(\s*[`'"](\/api\/[^`'"]+)[`'"]/g;
  let missingEndpoints = 0;

  for (const file of clientFiles) {
    const content = fs.readFileSync(file, 'utf8');
    while ((m = fetchRegex.exec(content)) !== null) {
      const rawUrl = m[1];
      // Normalize parameterized paths like /api/tournaments/${id}/ready -> /api/tournaments/:id/ready
      const normalized = rawUrl.replace(/\$\{[^}]+\}/g, ':param').replace(/\/+$/, '');
      
      // Check if any defined route matches
      const matches = Array.from(definedRoutes).some(r => {
        const routePart = r.split(' ')[1];
        // replace :id, :code, etc. with :param
        const routeNorm = routePart.replace(/:[a-zA-Z0-9_]+/g, ':param');
        return routeNorm === normalized;
      });

      if (!matches) {
        // Some might be dynamically constructed or query parameters
        const withoutQuery = normalized.split('?')[0];
        const matchesQuery = Array.from(definedRoutes).some(r => {
          const routePart = r.split(' ')[1];
          const routeNorm = routePart.replace(/:[a-zA-Z0-9_]+/g, ':param');
          return routeNorm === withoutQuery;
        });

        if (!matchesQuery) {
          console.warn(`⚠️ Potential unrouted fetch in ${path.relative(ROOT, file)}: "${rawUrl}" (normalized: ${withoutQuery})`);
          missingEndpoints++;
        }
      }
    }
  }

  console.log(`Endpoint audit complete. Potential missing endpoints: ${missingEndpoints}`);
}

async function run() {
  await auditSyntax();
  auditImports();
  auditEndpoints();
}

run();
