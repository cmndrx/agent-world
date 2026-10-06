// Label declutter: keep thought bubbles readable when several Sims share a room. Each frame, labels are
// placed in priority order (needs you, errors, selected, hovered, nearest, then by distance). A label that
// would overlap one already placed is lifted above it, with a thin leader line back to its Sim. If it
// would have to climb too far, a low-priority label is tucked away until there's room. Labels that matter
// (needs you, errors, selected) are never hidden, so the truth stays visible.

import * as THREE from 'three';

const MARGIN = 4;
let lastPlaced = []; // agent bubble rectangles from the latest pass; signs give way to them
const MAX_LIFT = 120;
const v = new THREE.Vector3();

const priority = (sim) => (sim.selected ? 6 : sim.state === 'waiting_for_user' ? 5 : sim.state === 'error' ? 4 : sim.hovered ? 3 : sim.expanded ? 2 : 1);

/**
 * @param {Iterable<import('./sim.js').Sim>} sims
 * @param {THREE.Camera} camera
 * @param {number} width
 * @param {number} height
 */
export function declutter(sims, camera, width, height) {
  const items = [];
  for (const sim of sims) {
    if (!sim.root.visible || sim.labelMode === 'hidden' || !sim.labelHtml) {
      setOffset(sim, 0, false);
      continue;
    }
    sim.label.getWorldPosition(v);
    const dist = v.distanceTo(camera.position);
    v.project(camera);
    if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) {
      setOffset(sim, 0, false);
      continue;
    }
    if (!sim.labelSize) sim.labelSize = { w: sim.bubbleEl.offsetWidth || 40, h: sim.bubbleEl.offsetHeight || 30 };
    items.push({ sim, x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, dist, p: priority(sim), ...sim.labelSize });
  }
  items.sort((a, b) => b.p - a.p || a.dist - b.dist);

  const placed = (lastPlaced = []);
  for (const it of items) {
    // The bubble sits centered on its anchor (translateY(-50%)), lifted by dy.
    let dy = 0;
    for (let tries = 0; tries < 8; tries++) {
      const top = it.y - it.h / 2 - dy;
      const bottom = top + it.h;
      const hit = placed.find((r) => it.x - it.w / 2 < r.right + MARGIN && it.x + it.w / 2 > r.left - MARGIN && top < r.bottom + MARGIN && bottom > r.top - MARGIN);
      if (!hit) break;
      dy += bottom - (hit.top - MARGIN);
    }
    const crowded = dy > MAX_LIFT && it.p < 4;
    if (crowded) dy = 0;
    else placed.push({ left: it.x - it.w / 2, right: it.x + it.w / 2, top: it.y - it.h / 2 - dy, bottom: it.y + it.h / 2 - dy });
    setOffset(it.sim, dy, crowded);
  }
}

function setOffset(sim, target, crowded) {
  // Ease toward the target so labels glide instead of jumping when Sims walk past each other.
  const dy = (sim.labelDy ?? 0) + (target - (sim.labelDy ?? 0)) * 0.25;
  sim.labelDy = Math.abs(dy - target) < 0.5 ? target : dy;
  sim.crowded = crowded;
  const px = `${sim.labelDy.toFixed(1)}px`;
  if (sim.bubbleEl.style.getPropertyValue('--dy') !== px) sim.bubbleEl.style.setProperty('--dy', px);
}

const SIGNS = '.biz-sign, .lot-sign, .commons-sign, .commons-title, .street-sign, .conversation-shelf, .downtown-title, .street-tag, .garden-chip';

/**
 * World signs (homes, businesses, streets, shelves): never cover an agent's bubble, and where two signs
 * overlap, the nearer one (lower on screen) wins and the other fades until there's room. Call every few
 * frames, after the label renderer has positioned everything.
 */
export function declutterSigns(root) {
  const els = [...root.querySelectorAll(SIGNS)];
  const items = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    items.push({ el, r });
  }
  items.sort((a, b) => b.r.bottom - a.r.bottom);
  const placed = lastPlaced.map((p) => ({ left: p.left, right: p.right, top: p.top, bottom: p.bottom }));
  for (const { el, r } of items) {
    const hit = placed.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom + 2 && r.bottom > p.top - 2);
    el.classList.toggle('occluded', hit);
    if (!hit) placed.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  }
}
