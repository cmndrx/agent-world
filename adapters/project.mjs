// Shared helpers for adapters.

import fs from 'node:fs';
import path from 'node:path';

const cache = new Map();

/** Walk up to the nearest git root so sessions in subfolders join the same household. */
export function projectRoot(cwd) {
  if (cache.has(cwd)) return cache.get(cwd);
  let dir = cwd;
  let root = cwd;
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      root = dir;
      break;
    }
    dir = path.dirname(dir);
  }
  cache.set(cwd, root);
  return root;
}

/** Path relative to the project root, or the basename if it lies outside. */
export function relTo(root, p) {
  if (typeof p !== 'string' || !p) return undefined;
  const r = path.relative(root, path.resolve(root, p));
  return r && !r.startsWith('..') ? r : path.basename(p);
}
