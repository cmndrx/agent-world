import * as THREE from 'three';

const C={wood:0x8f5f3e,cream:0xfbfbfb,blue:0x5f86c4,teal:0x2a9d8f,coral:0xe76f51,gold:0xe9c46a,dark:0x2a2f3c};
// Each scene owns its geometry/materials and has a single deterministic cleanup path.
export class HomeActivityScene {
  constructor(sim,plan) {
    this.sim=sim; this.plan=plan; this.mode=plan.def.mode==='nap' && plan.fixture==='bed' ? 'sleep' : plan.def.mode; this.group=new THREE.Group();
    this.materials=new Set(); this.held=[]; this.age=0;
    sim.root.add(this.group);
    this.build();
  }
  box(w,h,d,color,x=0,y=0,z=0,parent=this.group) {
    const material=new THREE.MeshStandardMaterial({color,roughness:.8,flatShading:true});
    this.materials.add(material);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  ball(r,color,x,y,z,parent=this.group) {
    const material=new THREE.MeshStandardMaterial({color,roughness:.8,flatShading:true});this.materials.add(material);
    const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  hold(side,kind) {
    const g=new THREE.Group();
    const elbow=this.sim.parts[side===1?'elbowL':'elbowR'];
    g.position.set(0,-.30,.02);elbow.add(g);this.held.push(g);
    if(kind==='spoon') {this.box(.025,.025,.16,C.wood,0,0,.055,g);this.ball(.04,C.cream,0,0,.15,g);}
    if(kind==='candy') this.box(.11,.05,.07,0x613b2a,0,0,.03,g);
    if(kind==='remote'||kind==='phone') {this.box(.11,.035,kind==='phone'?.20:.16,C.dark,0,0,.04,g);this.box(.07,.008,.09,C.teal,0,.022,.05,g);}
    if(kind==='brush') {this.box(.022,.022,.24,C.wood,0,0,.08,g);this.box(.045,.025,.05,C.coral,0,0,.22,g);}
    if(kind==='palette') {this.box(.23,.025,.16,C.wood,0,0,0,g);for(let i=0;i<3;i++)this.ball(.03,[C.coral,C.teal,C.gold][i],(i-1)*.065,.025,0,g);}
    if(kind==='leaf') {const leaf=this.ball(.09,C.teal,0,0,.06,g);leaf.scale.set(.5,.2,1);}
    if(kind==='wand') {this.box(.025,.025,.35,C.wood,0,0,.14,g);this.ball(.07,C.coral,0,0,.34,g);}
    if(kind==='piece') this.ball(.045,C.coral,0,0,.035,g);
    if(kind==='star') {
      const shape=new THREE.Shape();
      for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.025:.06;const x=Math.sin(a)*r,y=Math.cos(a)*r;if(i)shape.lineTo(x,y);else shape.moveTo(x,y);}shape.closePath();
      const material=new THREE.MeshStandardMaterial({color:C.gold,roughness:.8});this.materials.add(material);
      const star=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.02,bevelEnabled:false}),material);star.rotation.x=-Math.PI/2;g.add(star);
    }
    return g;
  }
  build() {
    const m=this.mode, seat=this.plan.seated;
    if(!this.plan.existing && seat && !['sleep','bath'].includes(m)) {
      this.box(.72,.12,.70,C.blue,0,.40,-.02);this.box(.72,.60,.12,C.blue,0,.72,-.32);
      for(const x of [-.27,.27]) for(const z of [-.24,.24])this.box(.06,.4,.06,C.wood,x,.18,z);
    }
    const y=seat?.78:1.08;
    this.surfaceY=y;
    if(['meal','takeout','board','goal','paint'].includes(m)) this.box(.62,.04,.38,C.wood,0,y-.06,.38);
    if(['meal','takeout','snack','candy'].includes(m)) {
      if(m==='candy') {this.wrapper=this.box(.20,.025,.13,C.coral,.15,y,.35);this.hold(-1,'candy');}
      else {this.box(.30,m==='takeout'?.16:.045,.25,C.cream,0,y,.40);for(let i=0;i<4;i++)this.ball(.045,[C.gold,C.teal,C.coral][i%3],(i%2-.5)*.1,y+.05, .36+Math.floor(i/2)*.09);this.hold(-1,'spoon');}
      if(m==='takeout') {this.phone=this.hold(1,'phone');this.box(.22,.28,.17,0xd5a676,.34,y+.05,.34);this.lid=this.box(.30,.02,.25,C.cream,0,y+.16,.52);}
    }
    if(m==='tv') {
      this.hold(-1,'remote');
    }
    if(m==='board') {this.box(.56,.025,.42,C.cream,0,y,.42);for(let x=0;x<4;x++)for(let z=0;z<3;z++)if((x+z)%2===0)this.box(.13,.008,.13,C.teal,(x-1.5)*.135,y+.017,.28+z*.135);for(let i=0;i<4;i++)this.ball(.04,C.gold,(i-1.5)*.12,y+.06,.55);this.box(.07,.07,.07,C.dark,.23,y+.05,.3);this.hold(-1,'piece');}
    if(m==='book') {
      this.book=new THREE.Group();this.group.add(this.book);this.book.position.set(0,y+.12,.36);
      this.box(.49,.035,.32,C.teal,0,0,0,this.book);this.box(.45,.026,.29,C.cream,0,.027,0,this.book);
      this.page=this.box(.22,.006,.28,0xe6dfcf,.11,.046,0,this.book);
      for(const x of [-.12,.12])for(let z=0;z<3;z++)this.box(.16,.003,.008,C.wood,x,.045,(z-1)*.07,this.book);
    }
    if(m==='goal') {this.box(.32,.025,.23,C.cream,0,y,.4);for(let i=0;i<3;i++)this.box(.065,.008,.065,C.teal,(i-1)*.09,y+.02,.4);this.token=this.hold(-1,'star');}
    if(m==='award') {
      this.cup=new THREE.Group();this.group.add(this.cup);this.cup.position.set(0,y+.14,.34);
      this.box(.18,.07,.16,C.dark,0,-.12,0,this.cup);this.box(.05,.13,.05,C.gold,0,-.03,0,this.cup);this.ball(.13,C.gold,0,.1,0,this.cup);
      for(const s of [-1,1])this.box(.08,.16,.04,C.gold,s*.15,.07,0,this.cup);
    }
    if(m==='nap'||m==='lazy')this.box(.35,.16,.24,C.cream,.2,.65,-.03);
    if(m==='sleep') {
      if(!this.plan.existing){this.box(1.0,.45,1.9,C.blue,0,.23,0);this.box(.65,.12,.32,C.cream,0,.52,-.70);}
      this.box(.88,.09,1.18,C.blue,0,.79,.28);
    }
    if(m==='bath') {
      this.foam=[];for(let i=0;i<12;i++)this.foam.push(this.ball(.12,C.cream,(i%4-1.5)*.26,.57,(Math.floor(i/4)-1)*.22));
    }
    if(m==='paint') {
      this.box(.46,.35,.025,C.cream,0,y+.23,.58).rotation.x=-.15;
      this.box(.5,.04,.08,C.wood,0,y+.04,.59);for(const x of [-.19,.19])this.box(.025,.42,.025,C.wood,x,y+.2,.61);
      for(let i=0;i<3;i++)this.box(.13,.12,.01,[C.coral,C.teal,C.gold][i],(i-1)*.12,y+.22,.55);
      this.hold(-1,'brush');this.hold(1,'palette');
    }
  }
  pose(T,t,ik,build) {
    const m=this.mode, s=(1+Math.sin(t*1.5))*.5;
    if(this.plan.seated) {T.bodyY=-.31;T.legL=T.legR=-1.35;T.kneeL=T.kneeR=1.25;}
    const y=this.surfaceY;
    let l=[.19,y+.14,.30],r=[-.19,y+.14,.30];
    T.headX=.15;T.headY=0;
    if(['meal','snack','candy','takeout'].includes(m)) {r=[-.10,y+.12+s*(1.48-y),.39-s*.15];if(m==='takeout'&&t%9<2)r=[-.02,y+.16,.33];}
    if(m==='board'||m==='goal')r=[-.15+s*.25,y+.10,.35+s*.12];
    if(m==='tv'){r=[-.16,y+.14,.32];T.headX=0;T.headY=Math.sin(t*.3)*.08;}
    if(m==='book'){l=[.22,y+.12,.30];r=[-.22,y+.12,.30];T.headX=.28;}
    if(m==='award'){l=[.15,y+.18+s*.10,.34];r=[-.15,y+.18+s*.10,.34];T.headX=.12;}
    if(m==='nap'){T.headX=.40;T.headZ=.17;l=[.12,.85,.22];r=[-.12,.86,.22];}
    if(m==='lazy'){T.lean=-.15;T.headX=-.12;l=[.38,1.16,-.03];}
    if(m==='sleep'){T.bodyY=0;T.headX=0;l=[.12,1.3,.20];r=[-.12,1.3,.20];}
    if(m==='bath'){T.bodyY=-.85;T.lean=-.16;T.headX=-.12;l=[.33,.62,.05];r=[-.33,.61,.08+s*.12];}
    if(m==='cat'||m==='bunny'){T.bodyY=-.65;T.legL=T.legR=-1.6;T.kneeL=T.kneeR=2.0;T.lean=.25;T.headX=.4;l=[.20,.66,.29];r=[-.12+s*.24,.42,.48];}
    if(m==='fish'){T.lean=.08;T.headY=Math.sin(t*.9)*.17;r=[-.12,1.17,.49];l=[.23,1.0,.2];}
    if(m==='paint'){r=[-.12+Math.sin(t*2)*.12,y+.17+Math.cos(t*2)*.09,.32];l=[.20,y+.20,.24];}
    if(m==='celebrate'){const clap=(1+Math.sin(Math.min(t,4)*5))*.5;l=[.04+clap*.18,1.3,.28];r=[-.04-clap*.18,1.3,.28];}
    if(m==='praise'){r=[-.04,1.35,.24];l=[.25,1.15,.25];T.headX=.12+s*.12;}
    ik(T,1,l,build);ik(T,-1,r,build);
  }
  update(dt,reduced=false) {
    this.age+=dt;const t=reduced?1:this.age,m=this.mode,p=this.sim.parts;
    if(m==='sleep'){p.body.rotation.x=-Math.PI/2;p.body.position.set(0,.64,1.1);}
    if(m==='bath'){p.legL.visible=p.legR.visible=false;}
    if(m==='nap'||m==='sleep')p.eyes.scale.y=.1;
    if(this.page)this.page.rotation.z=Math.max(0,Math.sin(t*1.5))*.9;
    if(this.cup)this.cup.position.y=this.surfaceY+.14+(1+Math.sin(t*1.5))*.05;
    if(this.phone)this.phone.visible=t%9<2;
    if(this.lid)this.lid.rotation.x=-Math.min(1,t/3)*1.2;
    if(this.screen)this.screen.material.color.setHex([C.teal,C.coral,C.gold][Math.floor(t/3)%3]);
    if(this.pet){this.pet.head.rotation.y=Math.sin(t*1.5)*.3;this.pet.body.position.y=m==='cat'?Math.max(0,Math.sin(t*1.5))*.05:0;}
    if(this.foam)this.foam.forEach((f,i)=>f.scale.setScalar(1+Math.sin(t+i)*.05));
    if(this.fish)this.fish.forEach((f,i)=>{f.position.x=Math.sin(t*.9+i*2)*.2;});
  }
  dispose() {
    if(this.borrowedPet){const b=this.borrowedPet;b.parent.add(b.ambient.root);b.ambient.root.position.copy(b.position);b.ambient.root.quaternion.copy(b.quaternion);b.ambient.activityOwner=null;b.ambient.parts.body.position.y=0;b.ambient.parts.head.rotation.y=0;}
    for(const g of [this.group,...this.held]) {g.removeFromParent();g.traverse(o=>o.geometry?.dispose());}
    for(const m of this.materials)m.dispose();
    const p=this.sim.parts;p.body.rotation.x=0;p.body.position.z=0;p.legL.visible=p.legR.visible=true;p.eyes.scale.y=1;
  }
}
