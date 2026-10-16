import * as THREE from 'three';
import {buildPerson,lookFromSeed} from './models.js';
import {armIK} from './sim.js';

// Building-local anchors from Tyler's authored-interior specification. Scenery only.
export const CIVIC_STAFF=Object.freeze({
  fire_station:{role:'Crew firefighter',at:[6.2,.14,-3.8],shirt:0x34363c,pants:0x34363c,helmet:0xd8a24a,stripe:0xe8d981},
  police:{role:'Station officer',at:[-4.2,.14,.25],shirt:0x3c64b4,pants:0x25334b,seated:true,cap:true},
  library:{role:'Librarian',at:[-5.6,.50,.20],yaw:0,shirt:0x7c6a9e,pants:0x3d4050,book:true},
  school:{role:'Teacher',at:[-6,.14,-8.4],yaw:0,shirt:0xd8a24a,pants:0x3d4050},
  hospital:{role:'Ward nurse',at:[-6,.14,-.15],shirt:0x4fb3a5,pants:0x4fb3a5,seated:true},
  city_dump:{role:'Weighbridge attendant',at:[10.6,.14,6.05],shirt:0xd9883a,pants:0x354c3d,helmet:0xd8a24a,stripe:0xeae3b9,seated:true},
  water_tower:{role:'Pump technician',at:[-2,.14,.90],shirt:0x5aa3d9,pants:0x3977a3,helmet:0xeee5d0,stripe:0xeee5d0},
  power_plant:{role:'Control operator',at:[4.4,.14,2.55],shirt:0x3b4149,pants:0x3b4149,helmet:0xeee5d0,stripe:0xe8c547,seated:true,headphones:true},
});
export class CivicStaff {
  constructor(kind,seed=1) {
    this.def=CIVIC_STAFF[kind];this.kind=kind;const d=this.def;
    this.parts=buildPerson({...lookFromSeed(seed),shirt:d.shirt,pants:d.pants,shoes:0x2a2f3c,top:'long',...(d.helmet?{hairStyle:0}:{}),accessory:d.cap?'cap':d.headphones?'headphones':'none'});
    this.root=this.parts.root;this.root.name=`${d.role} · simulated town staff`;this.root.position.set(...d.at);this.root.rotation.y=d.yaw??Math.PI;
    this.parts.badge.visible=false;this.owned=new Set();this.phase=seed*.731;
    const box=(w,h,z,color,x,y,depth,parent)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.85});this.owned.add(m);const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,z),m);mesh.position.set(x,y,depth);parent.add(mesh);return mesh;};
    if(d.helmet){
      const material=new THREE.MeshStandardMaterial({color:d.helmet,roughness:.8,flatShading:true});this.owned.add(material);
      const dome=new THREE.Mesh(new THREE.SphereGeometry(.34,8,4,0,Math.PI*2,0,Math.PI/2),material);dome.position.y=.53;dome.scale.z=.94;this.parts.head.add(dome);
      box(.73,.045,.68,d.helmet,0,.54,.015,this.parts.head);
      if(kind==='fire_station')box(.58,.08,.17,d.helmet,0,.51,-.32,this.parts.head);
    }
    if(d.stripe)box(.51,.07,.025,d.stripe,0,.40,.192,this.parts.spine);
    else box(.09,.12,.025,0xeee5d0,-.13,.46,.19,this.parts.spine);
    this.card=box(d.book?.30:.21,.025,d.book?.23:.26,d.book?0x299c99:0xe6ddc5,0,-.30,.08,this.parts.elbowL);
    box(d.book?.27:.18,.008,.20,0xfaf3e3,0,.018,0,this.card);
    if(d.book) this.page=box(.13,.008,.19,0xd8d2c6,.07,.025,0,this.card);
    this.update(0,true);
  }
  update(t,reduced=false){
    const p=this.parts,d=this.def,age=reduced?1:(t+this.phase)%12;
    const glance=reduced?0:Math.sin(Math.max(0,Math.min(1,(age-4)/2))*Math.PI)*.28;
    p.body.position.y=d.seated?-.42:0;p.legL.rotation.x=p.legR.rotation.x=d.seated?-1.45:0;p.kneeL.rotation.x=p.kneeR.rotation.x=d.seated?1.45:0;
    p.spine.rotation.set(.04,0,0);p.head.rotation.set(.12,glance,0);
    p.armL.rotation.set(-.45,0,.14);p.elbowL.rotation.x=-1.25;
    p.armR.rotation.set(-.35,0,-.12);p.elbowR.rotation.x=-1.05+(reduced?0:Math.sin(age*2)*.04);
    if(d.seated){const T={lean:.04,twist:0,bodyY:-.42};armIK(T,-1,[-.18,.81+(reduced?0:Math.sin(age*2)*.006),.40]);p.armR.rotation.set(T.armRx,0,T.armRz);p.elbowR.rotation.x=T.elbowR;}
    if(this.kind==='school' && !reduced && age>3&&age<5){p.armR.rotation.set(-.6,0,-.45);p.elbowR.rotation.x=-.8;}
    if(this.kind==='water_tower')p.head.rotation.x=age>4&&age<6?.2:-.06;
    p.torso.scale.y=1+(reduced?0:Math.sin(t*1.8+this.phase)*.006);
    if(this.page)this.page.rotation.z=reduced?0:Math.sin(Math.max(0,Math.min(1,age-3))*Math.PI)*.7;
  }
  dispose(){this.root.removeFromParent();this.root.traverse(o=>o.geometry?.dispose());this.owned.forEach(m=>m.dispose());this.owned.clear();}
}
