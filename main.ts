// Vice Cover — the entrypoint handed to make.fun (Node 22, stdlib only).
//
// What it does, in plain terms: it gathers the two folders that make up the
// entry — app/ (the cover maker itself) and screenshots/ (the four pictures
// of it at work) — copies them into the output directory, then asks the
// vendored make.fun library to write dossier.json, the summary the judge
// reads. Nothing else is installed or fetched; the program only moves files
// that already sit beside it.
//
// Local check (the grader's /output is replaced by a folder of your choice):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Then look inside out/ for app/, screenshots/ and dossier.json.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The scorer's caps, as the kit states them: the dossier text is capped at
// 160 KiB, at most 4 screenshots of 256 KiB each, and app/ stays under 993
// files and 48 MiB in total. Passing them here keeps a local run honest:
// an entry the scorer would refuse is refused here first, with a clear error.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function main() {
  const repoRoot = fileURLToPath(new URL('.', import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  const appDir = join(repoRoot, 'app');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(join(appDir, 'index.html'))) {
    throw new Error('app/index.html is missing — nothing to hand in');
  }
  const shotFiles = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((name) => !name.startsWith('.'))
    : [];
  if (shotFiles.length < 3 || shotFiles.length > 4) {
    throw new Error(`expected 3 or 4 screenshots, found ${shotFiles.length}`);
  }

  mkdirSync(outDir, { recursive: true });
  copyTree(appDir, join(outDir, 'app'));
  copyTree(shotsDir, join(outDir, 'screenshots'));

  writeFileSync(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, DOSSIER_CAPS),
  );
  console.log(`handed in ${shotFiles.length} screenshots and app/ to ${outDir}`);
}

main();
