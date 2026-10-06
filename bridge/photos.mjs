// Photo album (play layer): JPEGs taken in photo mode, stored in ~/.agent-world/photos. They are your own
// screenshots of the world, kept local, and never sent anywhere by the bridge.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { photosDir } from '../shared/home.mjs';

export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const MAX_PHOTOS = 300;
const ID = /^[a-z0-9-]{6,40}$/;

const file = (id) => path.join(photosDir(), `${id}.jpg`);

/** Newest first: [{ id, at }]. */
export function listPhotos() {
  let names = [];
  try {
    names = fs.readdirSync(photosDir());
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith('.jpg') && ID.test(n.slice(0, -4)))
    .map((n) => ({ id: n.slice(0, -4), at: fs.statSync(path.join(photosDir(), n)).mtime.toISOString() }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export const photoIds = () => new Set(listPhotos().map((p) => p.id));

/** Save JPEG bytes. Throws with a readable message for anything that isn't a reasonable JPEG. */
export function savePhoto(bytes) {
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('That photo is too large.');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('Photos must be JPEG images.');
  if (listPhotos().length >= MAX_PHOTOS) throw new Error(`The album holds ${MAX_PHOTOS} photos. Delete a few to make room.`);
  fs.mkdirSync(photosDir(), { recursive: true });
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(file(id) + '.tmp', bytes);
  fs.renameSync(file(id) + '.tmp', file(id));
  return { id, at: new Date().toISOString() };
}

export function photoPath(id) {
  return ID.test(id) && fs.existsSync(file(id)) ? file(id) : null;
}

export function deletePhoto(id) {
  const p = photoPath(id);
  if (!p) throw new Error('Photo not found.');
  fs.unlinkSync(p);
}
