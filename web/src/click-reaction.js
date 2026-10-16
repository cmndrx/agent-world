// Transient render-only acknowledgment. Never changes activity, navigation, care or truth.
import * as THREE from 'three';
const WORK=new Set(['thinking','reading','editing','running','searching','delegating']);
const clamp=THREE.MathUtils.clamp;
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function clickKind(sim) {
  if(sim.leaving || sim.gone)return null;
  if(sim.truth && sim.observationConnected!==false && ['waiting_for_user','error'].includes(sim.state))return null;
  return sim.truth && sim.observationConnected===true && WORK.has(sim.state)?'busy':'friendly';
}
export class ClickReaction {
  constructor(){this.active=null;this.cooldown=0;this.cameraPosition=new THREE.Vector3();this.headPosition=new THREE.Vector3();this.direction=new THREE.Vector3();this.inverse=new THREE.Quaternion();this.up=new THREE.Vector3(0,1,0);this.euler=new THREE.Euler();}
  start(sim,camera,reduced=false){
    if(this.active){this.active.camera=camera;return false;}
    if(this.cooldown>0)return false;
    const kind=clickKind(sim);if(!kind)return false;
    this.active={kind,camera,reduced,age:0,duration:reduced?(kind==='busy'?.45:.65):(kind==='busy'?.85:1.55),yaw:sim.root.rotation.y,baseYaw:sim.root.rotation.y,baseJoints:{...sim.joints}};return true;
  }
  cancel(){this.active=null;this.cooldown=.30;}
  tick(dt,sim){
    this.cooldown=Math.max(0,this.cooldown-dt);
    const a=this.active;if(!a)return;
    if(clickKind(sim)!==a.kind || sim.leaving || sim.gone){this.cancel();return;}
    a.age+=dt;if(a.age>=a.duration)this.cancel();
  }
  compose(sim,T,dt){
    const a=this.active;if(!a)return;
    const busy=a.kind==='busy',reduced=a.reduced;
    const rise=reduced?.10:busy?.15:.25,fall=reduced?.10:busy?.30:.25;
    const weight=clamp(Math.min(a.age/rise,(a.duration-a.age)/fall),0,1);
    sim.root.updateWorldMatrix(true,true);
    sim.parts.head.getWorldPosition(this.headPosition);a.camera.getWorldPosition(this.cameraPosition);
    this.direction.copy(this.cameraPosition).sub(this.headPosition);
    if(sim.root.parent){sim.root.parent.getWorldQuaternion(this.inverse).invert();this.direction.applyQuaternion(this.inverse);}
    const horizontal=Math.hypot(this.direction.x,this.direction.z);
    if(horizontal>.001)a.yaw=Math.atan2(this.direction.x,this.direction.z);
    else {this.direction.x=Math.sin(a.yaw)*.001;this.direction.z=Math.cos(a.yaw)*.001;}
    const supported=busy || sim.seated || !!sim.homeScene || sim.isVisitor;
    const bodyYaw=sim.root.rotation.y;
    if(!supported){const turn=angle(a.yaw-bodyYaw);sim.root.rotation.y=bodyYaw+turn*weight;}
    const relative=angle(a.yaw-sim.root.rotation.y);
    const mix=(key,value)=>T[key]=THREE.MathUtils.lerp(T[key],value,weight);
    mix('twist',clamp(relative,busy?-.17:-.436,busy?.17:.436));
    // Head aim is in the supported body's/spine's frame, including a lying body's tilt.
    this.inverse.setFromAxisAngle(this.up,-sim.root.rotation.y);this.direction.applyQuaternion(this.inverse);
    this.inverse.copy(sim.parts.body.quaternion).invert();this.direction.applyQuaternion(this.inverse);
    this.euler.set(T.lean,T.twist,0,'XYZ');this.inverse.setFromEuler(this.euler).invert();this.direction.applyQuaternion(this.inverse);
    mix('headY',clamp(Math.atan2(this.direction.x,this.direction.z),busy?-.35:-.96,busy?.35:.96));
    mix('headX',-clamp(Math.atan2(this.direction.y,Math.hypot(this.direction.x,this.direction.z)),-.175,busy?.14:.524));
    // Freeze held-item choreography and use a hand with no prop. Both occupied: head only.
    const held=sim.homeScene?.held || [];
    const freeR=!held.some(g=>g.parent===sim.parts.elbowR);
    const freeL=!held.some(g=>g.parent===sim.parts.elbowL);
    const side=freeR?'R':freeL?'L':null;
    if(side){const sign=side==='R'?-1:1;
      const sweep=reduced?0:busy?Math.sin(clamp((a.age-.15)/.25,0,1)*Math.PI)*.20:Math.sin(clamp((a.age-.45)/.60,0,1)*Math.PI*4)*.18;
      mix(`arm${side}x`,-.12);mix(`arm${side}z`,sign*((busy?1.30:2.25)+sweep));mix(`elbow${side}`,busy?-.9:-.65);
    }
  }
}
