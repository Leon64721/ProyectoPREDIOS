#!/usr/bin/env node
'use strict';

/**
 * Lint de sintaxis para el proyecto.
 *
 * La mayoría del frontend real vive en partials .html con <script> embebido
 * (app_core_js.html, app_matriz_js.html, app_alertas_js.html, app_permisos_js.html,
 * app_equipos_js.html, etc.) — Google Apps Script HtmlService, no archivos .js
 * sueltos. Un linter genérico que solo mira *.js no cubre nada de eso.
 *
 * Este script replica el patrón manual que ya se usaba en el proyecto (ver
 * TODOS.md / DOCUMENTACION_TECNICA_VIVA.md): extrae el contenido de cada
 * <script>...</script> de los .html tocados y le corre `node --check`, además
 * de los .js normales.
 *
 * Uso:
 *   node scripts/lint-html-scripts.js            (todo el repo)
 *   node scripts/lint-html-scripts.js archivo.js archivo.html ...   (solo esos)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.husky',
  '.gstack',
  '.claude',
  'graphify-out',
  'consolidacion_colab', // Python, no JS — no aplica node --check
]);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
      out.push(full);
    }
  }
  return out;
}

function extractScriptBlocks(html) {
  const blocks = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

/**
 * Neutraliza scriptlets de plantilla de Apps Script (<?= expr ?> / <?!= expr ?>)
 * reemplazándolos por `null` — se evalúan server-side antes de llegar al
 * navegador, así que no son JS válido tal cual, pero el resto del bloque sí
 * debe seguir siendo JS real y validable.
 */
function stripGasScriptlets(source) {
  return source.replace(/<\?!?=?[\s\S]*?\?>/g, 'null');
}

function checkJsSource(rawSource, label) {
  const source = stripGasScriptlets(rawSource);
  const tmp = path.join(require('os').tmpdir(), `lint-${Date.now()}-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(tmp, source);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    return null;
  } catch (e) {
    return e.stderr ? e.stderr.toString() : e.message;
  } finally {
    fs.unlinkSync(tmp);
  }
}

function main() {
  const argFiles = process.argv.slice(2);
  const files = argFiles.length > 0
    ? argFiles.map((f) => path.resolve(ROOT, f)).filter((f) => f.endsWith('.js') || f.endsWith('.html'))
    : walk(ROOT, []);

  let checked = 0;
  let failed = 0;

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (!fs.existsSync(file)) continue;

    if (file.endsWith('.js')) {
      checked += 1;
      const err = checkJsSource(fs.readFileSync(file, 'utf8'), rel);
      if (err) {
        failed += 1;
        console.error(`❌ ${rel}\n${err}`);
      }
    } else if (file.endsWith('.html')) {
      const html = fs.readFileSync(file, 'utf8');
      const blocks = extractScriptBlocks(html);
      blocks.forEach((block, i) => {
        if (!block.trim()) return; // <script src="..."> sin contenido inline
        checked += 1;
        const err = checkJsSource(block, `${rel} <script> #${i + 1}`);
        if (err) {
          failed += 1;
          console.error(`❌ ${rel} <script> #${i + 1}\n${err}`);
        }
      });
    }
  }

  console.log(`\n${checked - failed}/${checked} bloques de JS válidos.`);
  if (failed > 0) {
    console.error(`${failed} bloque(s) con error de sintaxis.`);
    process.exit(1);
  }
}

main();
