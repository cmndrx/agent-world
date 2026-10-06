// Grid navigation for a lot: A* over furniture footprints, then string-pulled for natural paths.
// Coordinates are lot-local (x, z).

const SQRT2 = Math.SQRT2;

export class NavGrid {
  /**
   * @param {{x0:number,z0:number,x1:number,z1:number}} bounds walkable area
   * @param {number} cell cell size in world units
   * @param {number} radius agent radius; obstacles are inflated by this
   */
  constructor(bounds, cell = 0.25, radius = 0.25) {
    this.b = bounds;
    this.cell = cell;
    this.radius = radius;
    this.w = Math.ceil((bounds.x1 - bounds.x0) / cell);
    this.h = Math.ceil((bounds.z1 - bounds.z0) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
  }

  /** Mark an axis-aligned rectangle [x0,z0,x1,z1] as blocked (inflated by the agent radius). */
  addRect([x0, z0, x1, z1]) {
    const r = this.radius;
    const [i0, j0] = this.toCell(Math.min(x0, x1) - r, Math.min(z0, z1) - r);
    const [i1, j1] = this.toCell(Math.max(x0, x1) + r, Math.max(z0, z1) + r);
    for (let j = Math.max(0, j0); j <= Math.min(this.h - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(this.w - 1, i1); i++) this.blocked[j * this.w + i] = 1;
    }
  }

  addCircle(x, z, rad) {
    this.addRect([x - rad, z - rad, x + rad, z + rad]);
  }

  toCell(x, z) {
    return [Math.floor((x - this.b.x0) / this.cell), Math.floor((z - this.b.z0) / this.cell)];
  }

  center(i, j) {
    return { x: this.b.x0 + (i + 0.5) * this.cell, z: this.b.z0 + (j + 0.5) * this.cell };
  }

  isBlocked(i, j) {
    return i < 0 || j < 0 || i >= this.w || j >= this.h || this.blocked[j * this.w + i] === 1;
  }

  /** Whether a world point is walkable (used for the player's avatar too). */
  walkable(x, z) {
    const [i, j] = this.toCell(x, z);
    return !this.isBlocked(i, j);
  }

  inBounds(x, z) {
    return x >= this.b.x0 && x < this.b.x1 && z >= this.b.z0 && z < this.b.z1;
  }

  nearestFree(i, j, maxR = 12) {
    if (!this.isBlocked(i, j)) return [i, j];
    for (let r = 1; r <= maxR; r++) {
      let best = null;
      let bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (this.isBlocked(i + di, j + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bestD) {
            bestD = d;
            best = [i + di, j + dj];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Straight segment clear of obstacles? Samples at half-cell steps. */
  clear(a, b) {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(dist / (this.cell * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const [i, j] = this.toCell(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      if (this.isBlocked(i, j)) return false;
    }
    return true;
  }

  /** Every cell reachable on foot from `from` (flood fill, no corner cutting). Indexed j * w + i. */
  reachableFrom(from) {
    const seen = new Uint8Array(this.w * this.h);
    const start = this.nearestFree(...this.toCell(from.x, from.z));
    if (!start) return seen;
    const queue = [start[1] * this.w + start[0]];
    seen[queue[0]] = 1;
    for (let q = 0; q < queue.length; q++) {
      const ci = queue[q] % this.w;
      const cj = (queue[q] / this.w) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (this.isBlocked(ni, nj)) continue;
          if (di && dj && (this.isBlocked(ci + di, cj) || this.isBlocked(ci, cj + dj))) continue;
          const n = nj * this.w + ni;
          if (!seen[n]) {
            seen[n] = 1;
            queue.push(n);
          }
        }
      }
    }
    return seen;
  }

  /**
   * Path from `from` to `to` as a list of waypoints (excluding `from`, ending exactly at `to`).
   * Start/goal may sit inside furniture (a chair, the couch): we route via the nearest free cell.
   */
  findPath(from, to) {
    const [si0, sj0] = this.toCell(from.x, from.z);
    const [gi0, gj0] = this.toCell(to.x, to.z);
    const s = this.nearestFree(si0, sj0);
    const g = this.nearestFree(gi0, gj0);
    if (!s || !g) return [to];

    const W = this.w;
    const start = s[1] * W + s[0];
    const goal = g[1] * W + g[0];
    const gScore = new Float32Array(W * this.h).fill(Infinity);
    const came = new Int32Array(W * this.h).fill(-1);
    const closed = new Uint8Array(W * this.h);
    const heap = new MinHeap();
    const hfn = (i, j) => {
      const dx = Math.abs(i - g[0]);
      const dz = Math.abs(j - g[1]);
      return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
    };
    gScore[start] = 0;
    heap.push(start, hfn(s[0], s[1]));

    let found = false;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % W;
      const cj = (cur / W) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (this.isBlocked(ni, nj)) continue;
          // No corner cutting.
          if (di && dj && (this.isBlocked(ci + di, cj) || this.isBlocked(ci, cj + dj))) continue;
          const n = nj * W + ni;
          const cost = gScore[cur] + (di && dj ? SQRT2 : 1);
          if (cost < gScore[n]) {
            gScore[n] = cost;
            came[n] = cur;
            heap.push(n, cost + hfn(ni, nj));
          }
        }
      }
    }
    if (!found) return [to];

    const cells = [];
    for (let c = goal; c !== -1; c = came[c]) cells.push(this.center(c % W, (c / W) | 0));
    cells.reverse();

    // String-pull: keep only the waypoints needed for line of sight.
    const pts = [{ x: from.x, z: from.z }, ...cells];
    const out = [];
    let a = 0;
    if (si0 !== s[0] || sj0 !== s[1]) {
      // Starting inside furniture (e.g. seated): step out to the first free cell before cutting corners.
      out.push(pts[1]);
      a = 1;
    }
    while (a < pts.length - 1) {
      let far = a + 1;
      while (far + 1 < pts.length && this.clear(pts[a], pts[far + 1])) far++;
      out.push(pts[far]);
      a = far;
    }
    // The goal itself may be inside furniture (a chair, the couch); the last hop goes straight in.
    out.push({ x: to.x, z: to.z });
    return out;
  }
}

class MinHeap {
  constructor() {
    this.items = [];
    this.prios = [];
  }
  get size() {
    return this.items.length;
  }
  push(item, prio) {
    const a = this.items;
    const p = this.prios;
    a.push(item);
    p.push(prio);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (p[parent] <= p[i]) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      [p[i], p[parent]] = [p[parent], p[i]];
      i = parent;
    }
  }
  pop() {
    const a = this.items;
    const p = this.prios;
    const top = a[0];
    const lastItem = a.pop();
    const lastPrio = p.pop();
    if (a.length) {
      a[0] = lastItem;
      p[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && p[l] < p[m]) m = l;
        if (r < a.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        [p[i], p[m]] = [p[m], p[i]];
        i = m;
      }
    }
    return top;
  }
}
