// Persisted town layout (town.json): streets and home plots on the grid (shared/town.mjs). The bridge is the
// only writer. The first load migrates the old row layout (style.json `layout` / `streets`), after backing up
// the files it reads. Migration is versioned and repeatable: style.json is never modified, so a damaged
// town.json is set aside and the layout is migrated again from the same source.

import fs from 'node:fs';
import path from 'node:path';
import { TOWN_VERSION, checkPlacement, eligiblePlots, emptyTown, layoutProblems, migrateRows, placeHome, retireHome, withNetwork } from '../shared/town.mjs';

const write = (file, value) => {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
  fs.renameSync(file + '.tmp', file);
};

export class TownStore {
  /** @param {string} dir AGENT_WORLD_HOME */
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'town.json');
    this.town = null;
    this.tail = Promise.resolve();
  }

  /** Serialize every layout and activation change (capacity checks included) behind one lock. */
  exclusive(fn) {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => {});
    return run;
  }

  backup(label, files) {
    const target = path.join(this.dir, 'backups', `${label}-${Date.now()}`);
    fs.mkdirSync(target, { recursive: true });
    for (const name of files) {
      const source = path.join(this.dir, name);
      if (fs.existsSync(source)) fs.copyFileSync(source, path.join(target, name));
    }
    return target;
  }

  /**
   * Load town.json, or migrate the row layout. `active` lists active projects in the order the old client
   * filled free plots; `style` is the saved style.json.
   */
  load({ style = {}, active = [] } = {}) {
    let saved = null;
    if (fs.existsSync(this.file)) {
      try {
        saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (saved?.version !== TOWN_VERSION || !Array.isArray(saved.roads) || !Array.isArray(saved.homes)) throw Error('Unknown town layout version.');
      } catch (e) {
        // Keep the unreadable file for inspection, then migrate again from the untouched source.
        const kept = this.backup('town-unreadable', ['town.json']);
        this.loadError = `${e.message} The previous town.json is kept in ${kept}.`;
        saved = null;
      }
    }
    if (saved) {
      this.town = { ...emptyTown(), ...saved, civic: Array.isArray(saved.civic) ? saved.civic : [], pendingRemoval: saved.pendingRemoval || {}, retired: saved.retired || [] };
      this.problems = layoutProblems(this.town);
      return this.town;
    }
    // Back up what the migration reads (only when there is a layout or an active project to carry over).
    const backup = (style.layout || []).some(Boolean) || active.length ? this.backup('town-migration', ['style.json', 'selected-projects.json', 'households.json']) : null;
    const { town, report } = migrateRows({ layout: style.layout, streets: style.streets, active });
    this.town = { ...town, migratedFrom: { kind: 'rows-v1', at: new Date().toISOString(), backup, plots: (style.layout || []).length, report } };
    this.problems = layoutProblems(this.town);
    write(this.file, this.town);
    return this.town;
  }

  save(next) {
    this.town = next;
    write(this.file, next);
    return next;
  }

  home(project) {
    return this.town.homes.find((h) => h.project === project) || null;
  }

  /**
   * Keep homes in step with the active projects: inactive projects leave the grid (their plot is remembered);
   * an active project without a plot is kept with a repair note. `autoPlace` (demo only) gives it a plot.
   */
  reconcile(active, { autoPlace = false } = {}) {
    let town = this.town;
    let changed = false;
    for (const h of [...town.homes]) if (!active.includes(h.project)) { town = retireHome(town, h.project); changed = true; }
    for (const project of active) {
      if (town.homes.some((h) => h.project === project)) continue;
      const remembered = town.retired?.find((r) => r.project === project);
      const spot = remembered && checkPlacement(town, remembered, { project }).ok ? remembered : autoPlace ? eligiblePlots(town, { project, limit: 1 })[0] : null;
      if (spot) town = placeHome(town, project, spot);
      else town = withNetwork({ ...town, homes: [...town.homes, { id: `home-${project.length}-${town.homes.length + 1}-${Date.now().toString(36)}`, project, i: null, j: null, rot: 0, repair: 'Choose a plot for this home.' }], revision: town.revision + 1 });
      changed = true;
    }
    if (changed) this.save(town);
    return changed;
  }
}
