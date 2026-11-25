/**
 * build.js
 *
 * Builds and verifies the React BINGO frontend bundle into public/dist/
 * Supports:
 * - Production build: `node build.js`
 * - Watch mode:       `node build.js --watch`
 * - Artifact verify:  `node build.js --verify`
 */

import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('public', 'dist');
const outJs = path.join(distDir, 'bingo-react.js');
const outCss = path.join(distDir, 'bingo-react.css');

export function verifyDistArtifacts() {
  if (!fs.existsSync(outJs) || fs.statSync(outJs).size < 1024) {
    throw new Error(`Missing or invalid JS bundle at ${outJs}`);
  }
  if (!fs.existsSync(outCss) || fs.statSync(outCss).size < 128) {
    throw new Error(`Missing or invalid CSS bundle at ${outCss}`);
  }
  return {
    jsPath: outJs,
    jsSize: fs.statSync(outJs).size,
    cssPath: outCss,
    cssSize: fs.statSync(outCss).size
  };
}

const isWatch = process.argv.includes('--watch');
const verifyOnly = process.argv.includes('--verify');
const isProd = process.env.NODE_ENV === 'production' || !isWatch;

const buildOptions = {
  entryPoints: ['src/index.jsx'],
  bundle: true,
  outfile: outJs,
  format: 'esm',
  sourcemap: !isProd,
  minify: false,
  minifySyntax: true,
  keepNames: true,
  target: ['es2020'],
  loader: {
    '.js': 'jsx',
    '.jsx': 'jsx',
    '.css': 'css'
  },
  define: {
    'process.env.NODE_ENV': isProd ? '"production"' : '"development"'
  }
};

async function run() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  if (verifyOnly) {
    try {
      const stats = verifyDistArtifacts();
      console.log(`✅ Verified frontend bundle: ${stats.jsSize}B JS, ${stats.cssSize}B CSS`);
      process.exit(0);
    } catch (err) {
      console.error('❌ Build verification failed:', err.message);
      process.exit(1);
    }
  }

  console.log(`⚡ Building React BINGO application with esbuild (mode: ${isWatch ? 'watch' : (isProd ? 'production' : 'development')})...`);

  try {
    if (isWatch) {
      const ctx = await esbuild.context({
        ...buildOptions,
        plugins: [
          {
            name: 'verify-on-rebuild',
            setup(build) {
              build.onEnd((result) => {
                if (result.errors.length > 0) {
                  console.error('❌ Rebuild failed with errors.');
                } else {
                  console.log(`🔄 Rebuilt React bundle cleanly at ${new Date().toLocaleTimeString()}`);
                }
              });
            }
          }
        ]
      });
      await ctx.watch();
      verifyDistArtifacts();
      console.log('👀 Watching src/ and shared/ for frontend changes...');
    } else {
      await esbuild.build(buildOptions);
      const stats = verifyDistArtifacts();
      console.log(`✅ React BINGO bundle built successfully at public/dist/bingo-react.js (${Math.round(stats.jsSize / 1024)} KB JS, ${Math.round(stats.cssSize / 1024)} KB CSS)!`);
    }
  } catch (err) {
    console.error('❌ Build failed:', err);
    process.exit(1);
  }
}

run();
