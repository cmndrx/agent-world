import { buildingPlanFor, floorBounds } from '../web/src/home-floors.js';
import { tierPlan, frontWallBlocks } from '../web/src/home-tier-plans.js';
import { planHomeActivity, overlaps } from '../web/src/home-activities.js';
import { NavGrid } from '../web/src/nav.js';
import { DECOR } from '../shared/style.mjs';
import { resourceReason } from '../shared/interest-care.mjs';
import { residentCharacters } from '../shared/foundation.mjs';
import { mountedTV } from '../shared/tv-mounts.mjs';
import { INTEREST_CARE } from '../shared/interest-care.mjs';

export const decorRect = d => {
  const def=DECOR[d.item], [w,h]=d.rot%2?[def.d,def.w]:[def.w,def.d];
  return [d.x-w/2,d.z-h/2,d.x+w/2,d.z+h/2];
};
const optional=new Set(['plant','rug','armchair','sideTable','floorLamp','planter','bench','column','tv']);
export function careEligibility({home,character,style={},level=1,interest,ignoreReservations=false}) {
  const tier=tierPlan(level), bp=buildingPlanFor(tier.key);
  const residents=residentCharacters(home), index=residents.findIndex(c=>c.id===character.id);
  // Saved inactive identities may change preferences without becoming residents.
  const seat=bp.seats[Math.max(0,index)];
  if (!seat) return {reason:'This resident has no supported home floor.'};
  const hs=style.homes?.[home.project] || {}, decor=hs.decor || [];
  const f=bp.floors[seat.floor], rects=decor.filter(d=>!DECOR[d.item]?.walkable).map(decorRect);
  const items=f.index ? f.items : f.items.filter(it=>!(optional.has(it.kind)&&it.rect&&rects.some(r=>overlaps(it.rect,r))));
  const added=f.index ? [] : decor.flatMap(d=>{
    const mount=d.item==='fireplace_tv' ? mountedTV(d,items) : null;
    if(d.item==='fireplace_tv'&&!mount)return [];
    return [{kind:mount?'television':d.item,x:mount?.screenX??d.x,z:mount?.screenZ??d.z,facing:mount?.facing || ['s','w','n','e'][d.rot],rect:DECOR[d.item]?.walkable?null:decorRect(d),floor:0}];
  });
  const floor={...f,items:[...items,...added]};
  const reason=resourceReason(interest,{items:floor.items,pet:hs.pet,floor:f.index});
  if(reason)return {reason};
  const b=floorBounds(f.rects),nav=new NavGrid(f.index?{x0:b.x0-.25,z0:b.z0-.25,x1:b.x1+.25,z1:b.z1+.25}:{x0:-11,z0:-5,x1:11,z1:11.5});
  const desks=bp.seats.slice(0,residents.length).filter(s=>s.floor===f.index).map(s=>s.desk);
  const solids=[...f.partitions,...items.map(it=>it.rect).filter(Boolean),...desks.map(d=>d.block),...(f.index?f.obstacles.filter(r=>!f.items.some(i=>i.rect===r)&&!f.desks.some(d=>d.block===r)): [[-7.25,-5.25,-6.95,5.25],[6.95,-5.25,7.25,5.25],[-7.25,-5.25,7.25,-4.95],...frontWallBlocks(tier)]),...(!f.index?rects:[])];
  for(const r of solids)nav.addRect(r);
  const occupied=ignoreReservations?[]:home.characters.filter(c=>c.id!==character.id&&c.care?.pending?.floor===f.index).map(c=>c.care.pending.plan.rect);
  const protectedSpots=desks.flatMap(d=>[d.chair,d.wait,d.visitorWait,...d.guests,d.entrance].filter(Boolean));
  const plan=planHomeActivity({id:INTEREST_CARE[interest]?.activityId,floor,nav,from:seat.desk.chair,pet:hs.pet,protectedSpots,occupied,solidRects:solids});
  if(!plan)return {reason:'No reachable, unoccupied station on this resident’s floor. Clear its approach or choose another activity.'};
  return {plan,floor:f.index,layout:JSON.stringify([tier.key,hs,residents.map(c=>c.id)]),reason:null};
}
export function validateTelevisions(clean, previous, level) {
  const f=buildingPlanFor(tierPlan(level).key).floors[0], mounts=new Set();
  for(const d of clean?.decor || []) {
    if(!['television','fireplace_tv'].includes(d.item))continue;
    const unchanged=previous?.decor?.some(old=>JSON.stringify(old)===JSON.stringify(d));
    if(d.item==='fireplace_tv') {
      if(mounts.has(d.anchor))throw Error('This fireplace already has a TV.');
      mounts.add(d.anchor);
      const m=mountedTV(d,f.items);
      if(unchanged&&!m)continue; // orphan remains owned, unplaced
      if(!m || d.x!==m.x || d.z!==m.z || d.rot!==m.rot)throw Error('Choose a valid ground-floor fireplace mount.');
    } else {
      const r=decorRect(d);
      if(r[0]<-6.95 || r[2]>6.95 || r[1]<-4.95 || r[3]>4.95)throw Error('Place the TV inside the ground-floor room.');
      const solids=[...f.partitions,...f.items.filter(i=>!optional.has(i.kind)).map(i=>i.rect).filter(Boolean),...f.desks.map(d=>d.block),...(clean.decor || []).filter(o=>o.id!==d.id&&!DECOR[o.item].walkable).map(decorRect)];
      if(solids.some(o=>overlaps(o,r)))throw Error('The TV overlaps furniture or a wall.');
      const nav=new NavGrid({x0:-11,z0:-5,x1:11,z1:11.5});
      for(const o of solids)nav.addRect(o);
      const spots=f.desks.flatMap(d=>[d.chair,d.wait,d.visitorWait,...d.guests]);
      const before=nav.reachableFrom(f.stations.entrance);nav.addRect(r);
      const after=nav.reachableFrom(f.stations.entrance);
      if(spots.some(p=>{const [x,z]=nav.toCell(p.x,p.z);return before[z*nav.w+x]&&!after[z*nav.w+x];}))throw Error('The TV would block a desk or doorway.');
    }
  }
}
