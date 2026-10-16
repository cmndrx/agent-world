// Pure simulation contracts. No persistence, receipts, provider calls or reward hooks.
import { ACTIVITIES } from '../../shared/catalogs/activities.js';
import { YAW, rotate } from './home-floorplans.js';
import { NavGrid } from './nav.js';
import { resourceReason, interestForActivity } from '../../shared/interest-care.mjs';

const modes = {
  eat_a_favorite_meal: 'meal', enjoy_candy_or_chocolate: 'candy', order_takeout: 'takeout',
  grab_a_snack: 'snack', watch_tv: 'tv', play_board_games: 'board', take_a_nap: 'nap',
  sleep_in: 'sleep', take_a_bubble_bath: 'bath', enjoy_a_lazy_day: 'lazy', read_a_book: 'book',
  complete_a_personal_goal: 'goal', earn_an_award: 'award', celebrate_an_achievement: 'celebrate',
  play_with_a_cat: 'cat', care_for_a_bunny: 'bunny', watch_aquarium_fish: 'fish',
  paint_a_picture: 'paint', receive_praise: 'praise',
};
const honest = { goal: 'Personal goal scene', award: 'Award scene', celebrate: 'Celebration scene', praise: 'Praise response' };
export const HOME_ACTIVITIES = ACTIVITIES.filter(a => a.buildingIds.includes('home')).map(a => ({
  ...a, mode: modes[a.id], label: `${honest[modes[a.id]] || a.label} · simulated`,
}));
export const homeActivity = id => HOME_ACTIVITIES.find(a => a.id === id);
export const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const rectAt = (x,z,w,d) => [x-w/2,z-d/2,x+w/2,z+d/2];
const pointRect = (p,r,pad=0) => p.x > r[0]-pad && p.x < r[2]+pad && p.z > r[1]-pad && p.z < r[3]+pad;
export function copyNav(nav, rect, radius=nav.radius) {
  const n = new NavGrid(nav.b, nav.cell, radius);
  n.blocked.set(nav.blocked);
  if (rect) n.addRect(rect);
  return n;
}
const reachable = (nav, seen, p) => {
  const [i,j] = nav.toCell(p.x,p.z);
  return nav.walkable(p.x,p.z) && !!seen[j*nav.w+i];
};

/** Find a reachable station on this floor only. Full reserved envelope must leave existing routes intact. */
export function planHomeActivity({ id, floor, nav, from, pet = null, protectedSpots = [], occupied = [], solidRects=floor.obstacles }) {
  const def = homeActivity(id);
  if (!def?.mode) return null;
  if (resourceReason(interestForActivity(id), {items:floor.items,pet,floor:floor.index || 0})) return null;
  const seen = nav.reachableFrom(from);
  const blocked = r => occupied.some(o => overlaps(r,o));
  const at = (it,x,z) => { const [dx,dz] = rotate(x,z,YAW[it.facing] || 0); return {x:it.x+dx,z:it.z+dz}; };
  const access = p => reachable(nav,seen,p);
  const items = floor.items || [];
  // Reuse a whole bed for lying sleep, a couch lane for seated handheld scenes.
  const seated = ['meal','candy','takeout','snack','tv','board','lazy','book','goal','award','paint'].includes(def.mode);
  for (const it of items) {
    const bed = ['sleep','nap'].includes(def.mode) && it.kind === 'bed';
    const bath = def.mode === 'bath' && it.kind === 'bath';
    const recline = false;
    const couch = seated && ['couch','loveseat','armchair'].includes(it.kind);
    if (!bed && !bath && !couch && !recline) continue;
    let rect = it.rect;
    if(couch && rect) {
      const footCorners=[at(it,-.45,.9),at(it,.45,.9)];
      rect=[Math.min(rect[0],...footCorners.map(p=>p.x)),Math.min(rect[1],...footCorners.map(p=>p.z)),Math.max(rect[2],...footCorners.map(p=>p.x)),Math.max(rect[3],...footCorners.map(p=>p.z))];
    }
    if (!rect || blocked(rect)) continue;
    const approaches = bed ? [[1.4,0],[-1.4,0],[0,1.7]] : bath ? [[-.38,.9]] : [[0,.95]];
    for (const [x,z] of approaches) {
      const spot = {...at(it,x,z), face:YAW[it.facing] || 0};
      if (!access(spot)) continue;
      const center = at(it,bath ? -.38 : 0,0);
      const existingTV=def.mode==='tv' && items.some(tv=>{
        const yaw=YAW[it.facing]||0,dx=tv.x-center.x,dz=tv.z-center.z;
        return ['tv','television'].includes(tv.kind) && dx*Math.sin(yaw)+dz*Math.cos(yaw)>.5 && Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw))<1.5 && Math.hypot(dx,dz)<5 && !floor.partitions.some(r=>{
          for(let t=.05;t<1;t+=.05) if(pointRect({x:center.x+dx*t,z:center.z+dz*t},r))return true;
          return false;
        });
      });
      if(def.mode==='tv' && !existingTV)continue;
      return {def,spot,rect,center,face:spot.face+(recline?Math.PI/2:0),seated:couch,fixture:it.kind,existing:true,existingTV};
    }
  }
  // Durable resources never fall back to temporary scene furniture.
  if (['tv','bath','sleep','nap','lazy'].includes(def.mode)) return null;
  // Portable kits occupy an actual room, never a lobby, landing, hall, office or work desk.
  const large = ['bath','sleep'].includes(def.mode);
  const sizes = def.mode==='bath' ? [[2.1,2],[1.8,1.6]] : [[large?2.1:1.2,large?2:['celebrate','praise'].includes(def.mode)?1.2:1.8]];
  const rooms = (floor.rooms || []).filter(r => !/hall|landing|lobby|corridor|office|study|business|work/i.test(r[0]));
  const protectedReach = protectedSpots.filter(p => access(p));
  for (const [w,d] of sizes) for (const room of rooms) {
    for (let z=room[3]+d/2+.1; z<=room[5]-d/2-.1; z+=.25) for (let x=room[2]+w/2+.1; x<=room[4]-w/2-.1; x+=.25) {
      const compactBath=def.mode==='bath' && w<2;
      const rect=rectAt(x,z,w,d), spot={x,z:compactBath?z+.47:z-.35,face:0};
      if (blocked(rect) || protectedSpots.some(p=>pointRect(p,rect,.35))) continue;
      const clear=!solidRects.some(r=>overlaps(rect,r));
      if (!clear || !access(spot)) continue;
      // The envelope already includes the body/clearance; do not inflate it twice.
      const after=copyNav(nav,rect,0), afterSeen=after.reachableFrom(from);
      if (protectedReach.some(p=>!reachable(after,afterSeen,p))) continue;
      return {def,spot,rect,center:{x,z:compactBath?z-.25:large||['celebrate','praise'].includes(def.mode)?z:z-.35},face:0,seated:seated || large,fixture:large ? def.mode : 'kit',existing:false,compactBath};
    }
  }
  return null;
}
