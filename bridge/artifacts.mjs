import fs from 'node:fs';
import path from 'node:path';
import { evidenceReferences } from '../shared/work-loop.mjs';

const MAX_BYTES = 65536;
const TEXT_EXT = new Set(['.md','.txt','.json','.csv','.log','.js','.mjs','.css','.html','.yaml','.yml','.ts','.tsx','.jsx']);
// Read only references belonging to this task, inside its real local project. No arbitrary file API.
export function previewArtifact(task, requested) {
  const refs = [...evidenceReferences(task.evidence), ...(task.references || []).filter(r => r.kind === 'output').map(r => ({ value:r.value }))];
  if (typeof requested !== 'string' || !requested.startsWith('/') || !refs.some(r => r.value === requested)) throw new Error('Choose a recorded local output.');
  if (!path.isAbsolute(task.project)) throw new Error('This home has no local project folder. Copy the path or open its web link.');
  const root = fs.realpathSync(task.project); const real = fs.realpathSync(requested);
  const relative = path.relative(root, real);
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative) || relative.split(path.sep).some(p => p.startsWith('.')) || path.relative(task.project, requested).split(path.sep).some(p => p.startsWith('.'))) throw new Error('Only visible files within this project can be previewed.');
  if (!TEXT_EXT.has(path.extname(real).toLowerCase())) throw new Error('Preview supports text outputs. Copy the path for other formats.');
  if (!fs.statSync(real).isFile()) throw new Error('Choose a regular text file.');
  const fd = fs.openSync(real, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new Error('Choose a regular text file.');
    const bytes = Buffer.alloc(Math.min(stat.size,MAX_BYTES)); fs.readSync(fd,bytes,0,bytes.length,0);
    if (bytes.includes(0)) throw new Error('Binary content cannot be previewed.');
    return { path:requested, text:bytes.toString('utf8'), truncated:stat.size > MAX_BYTES, readAt:new Date().toISOString() };
  } finally { fs.closeSync(fd); }
}
