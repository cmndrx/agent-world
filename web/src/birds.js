// Bounded, shared scenery geometry. Model forward is +X.
import * as THREE from 'three';

function wedge(points, depth=.03) {
  const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1});
  g.rotateX(Math.PI/2);g.translate(0,depth/2,0);return g;
}
function wingAngle(age){
  const period=.78,total=period*3+1.5,cycle=((age%total)+total)%total;
  if(cycle>=period*3)return .12;
  const p=(cycle%period)/period,stroke=p<.4?.524-(p/.4)*.873:-.349+((p-.4)/.6)*.873;
  const enter=THREE.MathUtils.smoothstep(cycle,0,.18),exit=THREE.MathUtils.smoothstep(cycle,period*3-.18,period*3);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(.12,stroke,enter),.12,exit);
}
export class BirdFlock {
  constructor() {
    this.root=new THREE.Group();this.birds=[];
    this.materials=[0x3a4150,0xd8d2c6,0xc89a68].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));
    this.geometries=[new THREE.IcosahedronGeometry(1,0),wedge([[.13,0],[-.13,0],[-.22,.32],[-.03,.32]]),wedge([[-.02,-.025],[-.23,-.025],[-.31,.24],[-.25,.27]]),wedge([[-.18,-.10],[-.43,-.13],[-.36,0],[-.43,.13],[-.18,.10]])];
    for(let i=0;i<9;i++) {
      const root=new THREE.Group();root.scale.setScalar(1.4);this.root.add(root);
      const add=(g,m,x,y,z,sx=1,sy=1,sz=1,parent=root)=>{const mesh=new THREE.Mesh(this.geometries[g],this.materials[m]);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;};
      add(0,0,0,0,0,.30,.13,.14);add(0,1,.025,-.06,0,.23,.085,.12);add(0,0,.25,.055,0,.13,.115,.115);add(0,2,.40,.035,0,.10,.04,.045);add(3,0,0,0,0);
      const wings=[];
      for(const side of [-1,1]){const shoulder=new THREE.Group(),tip=new THREE.Group();shoulder.position.set(.02,.025,side*.10);shoulder.scale.z=side;root.add(shoulder);add(1,0,0,0,0,1,1,1,shoulder);tip.position.set(0,0,.30);shoulder.add(tip);add(2,0,0,0,0,1,1,1,tip);wings.push({shoulder,tip,side});}
      this.birds.push({root,wings});
    }
  }
  update(t,from,dir,reduced=false) {
    this.root.visible=!reduced;
    for(let i=0;i<9;i++){
      const b=this.birds[i],row=Math.ceil(i/2),side=i%2?1:-1;
      b.root.position.copy(from).addScaledVector(dir,t*10-row*1.6);
      b.root.position.x+=side*row*1.4*-dir.z;b.root.position.z+=side*row*1.4*dir.x;
      b.root.position.y+=Math.sin(t*.8+i)*.20;
      const age=t+i*.173;
      // Ease the last beat into a glide; the distal hinge follows 65 ms later.
      const flap=wingAngle(age);
      b.root.rotation.set(Math.sin(age*.7)*.05,Math.atan2(-dir.z,dir.x),Math.sin(age*.9)*.06);
      for(const w of b.wings){w.shoulder.rotation.x=-w.side*flap;w.tip.rotation.x=-THREE.MathUtils.clamp(wingAngle(age-.065)-flap,-.17,.17);}
    }
  }
  dispose(){this.root.removeFromParent();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
