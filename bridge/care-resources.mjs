import { buildingPlanFor } from '../web/src/home-floors.js';
import { tierPlan, frontWallBlocks } from '../web/src/home-tier-plans.js';
import { overlaps } from '../web/src/home-activities.js';
import { NavGrid } from '../web/src/nav.js';
import { DECOR } from '../shared/style.mjs';
import { mountedTV } from '../shared/tv-mounts.mjs';

export const decorRect = d => {
  const def=DECOR[d.item], [w,h]=d.rot%2?[def.d,def.w]:[def.w,def.d];
  return [d.x-w/2,d.z-h/2,d.x+w/2,d.z+h/2];
};
const optional=new Set(['plant','rug','armchair','sideTable','floorLamp','planter','bench','column','tv']);
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
