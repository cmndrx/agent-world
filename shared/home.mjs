// Locations under the Agent World home directory (~/.agent-world by default).
// Override with AGENT_WORLD_HOME, e.g. for demos and tests.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PRIVACY_LEVELS } from './schema.mjs';

export function homeDir() {
  return path.resolve(process.env.AGENT_WORLD_HOME || path.join(os.homedir(), '.agent-world'));
}

export const eventsDir = () => path.join(homeDir(), 'events');
export const householdsFile = () => path.join(homeDir(), 'households.json');
export const configFile = () => path.join(homeDir(), 'config.json');

const DEFAULT_CONFIG = { privacy: 'targets', staleAfterMinutes: 180 };

export function readConfig() {
  try {
    const cfg = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configFile(), 'utf8')) };
    if (!PRIVACY_LEVELS.includes(cfg.privacy)) cfg.privacy = DEFAULT_CONFIG.privacy;
    return cfg;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function ensureHome() {
  fs.mkdirSync(eventsDir(), { recursive: true });
}
