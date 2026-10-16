// Stable authored anchors; saved mounts remain owned but unplaced if their anchor disappears.
import { YAW, rotate } from '../web/src/home-floorplans.js';
export const fireplaceAnchor = it => `fireplace:${it.x}:${it.z}:${it.facing}`;
export function tvMounts(items) {
  return items.filter(it=>it.kind==='fireplace').map(it=>{
    const [dx,dz]=rotate(0,.13,YAW[it.facing] || 0);
    return {anchor:fireplaceAnchor(it),x:Math.round(it.x*4)/4,z:Math.round(it.z*4)/4,
      screenX:it.x+dx,screenZ:it.z+dz,y:1.92,rot:['s','w','n','e'].indexOf(it.facing),facing:it.facing};
  });
}
export const mountedTV = (d,items) => tvMounts(items).find(m=>m.anchor===d.anchor);
