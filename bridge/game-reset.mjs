import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyGameplay } from '../shared/gameplay.mjs';
import { emptyStyle } from '../shared/style.mjs';

export function resetTown(directory, { confirmed, passes, voice, computerUse }) {
  if (confirmed !== true) throw Error('Confirm the game reset first.');
  if (passes.proposals.some(p => ['approved', 'queued', 'running'].includes(p.status))
    || passes.runs.some(r => ['running', 'queued'].includes(r.status))
    || ['connecting', 'live', 'approval'].includes(voice.status)
    || ['connecting', 'approval'].includes(computerUse.status)) {
    throw Error('Finish or stop queued work, voice and app connections before resetting.');
  }
  const backup = path.join(directory, 'backups', `game-reset-${Date.now()}-${randomUUID()}`);
  fs.mkdirSync(backup, { recursive: true });
  for (const file of ['gameplay.json', 'selected-projects.json', 'style.json', 'households.json', 'conversations.json', 'passes.json']) {
    const source = path.join(directory, file);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(backup, file));
  }
  const gameplay = emptyGameplay(), style = emptyStyle();
  for (const [file, value] of [['gameplay.json', gameplay], ['selected-projects.json', []], ['style.json', style]]) {
    const target = path.join(directory, file);
    fs.writeFileSync(target + '.tmp', JSON.stringify(value, null, 2));
    fs.renameSync(target + '.tmp', target);
  }
  return { gameplay, style, backup };
}
