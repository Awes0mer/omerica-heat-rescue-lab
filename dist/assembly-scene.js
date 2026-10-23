/** Original procedural Heat Rescue assembly visualization. MIT, Omer Orman.
 * Three.js is separately MIT licensed in vendor/three/LICENSE.
 * Geometry, coolant traces and electricity pulses are illustrative, not a
 * dimensional engineering drawing or a calibrated flow-speed measurement.
 * This module only renders supplied snapshots; it never changes the model.
 */
import * as THREE from './vendor/three/three.module.js';

const COLORS = { ink: 0x111b28, shell: 0x283340, silver: 0xb2c6d3, copper: 0xc77b51,
  cyan: 0x69e2f5, gold: 0xf3cf72, board: 0x0c4144, dark: 0x07101b, red: 0xf27e62 };
const clamp = THREE.MathUtils.clamp;

export function mountAssembly(host, {onSelect, onTogglePipe, onInspect} = {}) {
  const noOp = () => {};
  const empty = {available:false,setSnapshot:noOp,setDesign:noOp,setExploded:noOp,setThermal:noOp,setView:noOp,resize:noOp,dispose:noOp};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  } catch (error) {
    const message=document.createElement('div');
    message.className='assembly-webgl-fallback';
    message.textContent='The 3D assembly needs WebGL. The live readings and pipe controls below still work.';
    message.setAttribute('role','status');host.append(message);
    return {...empty,dispose(){message.remove();}};
  }
  const canvas=renderer.domElement;
  canvas.className='assembly-canvas';canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline:none';
  canvas.setAttribute('aria-label','Interactive simulated cooling assembly. Drag to rotate, scroll to zoom. Select a server or click a valve to change its pipe.');
  canvas.setAttribute('role','img');canvas.tabIndex=0;host.append(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0c1522);
  scene.fog=new THREE.Fog(0x0c1522,23,50);
  const camera=new THREE.PerspectiveCamera(40,1,.1,100);
  const root=new THREE.Group();scene.add(root);
  const geometries=new Set(),materials=new Set(),textures=new Set(),pickables=[];
  const parts=[],flowPaths=[],fans=[],pulseLights=[];
  let disposed=false,latest=null,selected=1,exploded=false,thermal=false,explodeAmount=0,designOnly=false;
  let hasSize=true,onScreen=true;
  let clock=0,previous=performance.now(),frameId=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');

  function mat(color,opts={}) {
    const m=new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.65,...opts});materials.add(m);return m;
  }
  const shell=mat(COLORS.shell),dark=mat(COLORS.dark,{roughness:.7}),silver=mat(COLORS.silver,{roughness:.28,metalness:.86});
  const boardMat=mat(COLORS.board,{roughness:.65,metalness:.25}),chipMat=mat(0x17212b,{roughness:.65});
  const copper=mat(COLORS.copper,{metalness:.88,roughness:.28});
  const gold=mat(COLORS.gold,{metalness:.7,roughness:.25,emissive:0x674416,emissiveIntensity:.15});
  const glass=mat(0x5bd5e8,{transparent:true,opacity:.23,metalness:.15,roughness:.17,depthWrite:false});
  const hose=mat(0x75d5e6,{transparent:true,opacity:.35,metalness:.15,roughness:.2,depthWrite:false});
  const returnHose=mat(0x91c4d6,{transparent:true,opacity:.26,metalness:.1,roughness:.25,depthWrite:false});
  const coolant=mat(COLORS.cyan,{emissive:COLORS.cyan,emissiveIntensity:1.7,roughness:.2,metalness:.15});
  const backupCoolant=mat(0x7effd0,{emissive:0x7effd0,emissiveIntensity:1.5,roughness:.25});
  const accent=mat(COLORS.cyan,{emissive:0x37c5df,emissiveIntensity:.8});
  const brass=mat(0xbda47c,{roughness:.3,metalness:.8});
  const insulator=mat(0xe7edef,{roughness:.37,metalness:.08});
  const labelMetal=mat(0x4d606c,{roughness:.4,metalness:.7});
  function geo(g){geometries.add(g);return g;}
  function tag(mesh,index,component,label) {mesh.userData={index,component,label};pickables.push(mesh);return mesh;}
  function mesh(g,m,parent,x=0,y=0,z=0) {
    const item=new THREE.Mesh(geo(g),m);item.position.set(x,y,z);
    const p=g.parameters||{};
    // Small screws, traces and fluid beads need no individual shadow-map draw.
    item.castShadow=!m.transparent&&((g.type==='BoxGeometry'&&p.width*p.height*p.depth>.025)||(g.type==='CylinderGeometry'&&p.radiusTop*p.radiusTop*p.height>.008));
    item.receiveShadow=true;parent.add(item);return item;
  }
  function box(parent,w,h,d,m,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),m,parent,x,y,z);}
  function cylinder(parent,radius,length,m,x=0,y=0,z=0,axis='y',segments=24) {
    const o=mesh(new THREE.CylinderGeometry(radius,radius,length,segments),m,parent,x,y,z);
    if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;
  }
  function torus(parent,r,t,m,x,y,z,axis='z') {
    const o=mesh(new THREE.TorusGeometry(r,t,8,32),m,parent,x,y,z);
    if(axis==='y')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.y=Math.PI/2;return o;
  }
  function screw(parent,x,y,z,axis='y') {
    cylinder(parent,.038,.025,silver,x,y,z,axis,12);
    const slot=box(parent,.047,.008,.009,dark,x,y+.014,z);
    if(axis==='z'){slot.position.set(x,y,z+.016);slot.rotation.x=Math.PI/2;}
  }
  function textTexture(text,{width=512,height=128,color='#bceef7',background='rgba(12,22,34,.88)',size=43}={}) {
    const c=document.createElement('canvas');c.width=width;c.height=height;
    const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.beginPath();ctx.roundRect(0,0,width,height,16);ctx.fill();
    ctx.fillStyle=color;ctx.font=`600 ${size}px "DM Sans", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height/2,width-28);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);return {texture:t,canvas:c,ctx};
  }
  function plateLabel(parent,text,w,h,x,y,z,color='#bceef7') {
    const info=textTexture(text,{color});
    const m=new THREE.MeshBasicMaterial({map:info.texture,transparent:true,depthWrite:false});materials.add(m);
    return mesh(new THREE.PlaneGeometry(w,h),m,parent,x,y,z);
  }
  function floatingLabel(parent,text,w,x,y,z) {
    const info=textTexture(text,{width:512,height:128,size:39});
    const m=new THREE.SpriteMaterial({map:info.texture,transparent:true,depthTest:false,depthWrite:false});materials.add(m);
    const s=new THREE.Sprite(m);s.scale.set(w,w/4,1);s.position.set(x,y,z);s.renderOrder=10;parent.add(s);
    return {sprite:s,...info};
  }
  function curve(points) {return new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');}
  function path(parent,points,{radius=.065,material=hose,index=null,kind='main',count=12,moving=null}={}) {
    if(kind==='backup'||kind==='backup-spine'){material=material.clone();materials.add(material);}
    const c=curve(points),tube=mesh(new THREE.TubeGeometry(c,64,radius,8,false),material,parent);
    if(index!==null)tag(tube,index,'pipe',kind==='backup'?'Independent backup route':'Main coolant pipe');
    let beadMaterial=kind==='backup'?backupCoolant:kind==='electric'?gold:coolant;
    if(kind==='electric'){beadMaterial=beadMaterial.clone();materials.add(beadMaterial);}
    const beads=[];
    for(let i=0;i<count;i++) {
      const bead=mesh(new THREE.SphereGeometry(kind==='electric'?.038:.031,7,5),beadMaterial,parent);
      bead.castShadow=false;bead.receiveShadow=false;beads.push(bead);
    }
    const record={curve:c,tube,beads,beadMaterial,index,kind,points,moving,radius,active:true};flowPaths.push(record);return record;
  }
  function updatePath(p,points) {
    p.curve=curve(points);const old=p.tube.geometry;
    p.tube.geometry=geo(new THREE.TubeGeometry(p.curve,64,p.radius,8,false));old.dispose();geometries.delete(old);
  }

  // A broad chassis, isolation feet and precision rails give the machine weight.
  const floor=mesh(new THREE.PlaneGeometry(120,120),mat(0x101c2b,{roughness:.95,metalness:.08}),scene,0,-.12,0);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.castShadow=false;
  const grid=new THREE.GridHelper(30,30,0x25364b,0x19283b);grid.position.y=-.10;grid.material.transparent=true;grid.material.opacity=.42;scene.add(grid);
  box(root,11.1,.22,6.25,shell,0,.16,0);
  box(root,10.9,.045,6.05,labelMetal,0,.295,0);
  for(const x of [-4.8,4.8])for(const z of [-2.55,2.55]) {
    cylinder(root,.2,.21,dark,x,.015,z);cylinder(root,.145,.035,silver,x,.12,z);
    screw(root,x,.335,z);
  }
  for(const x of [-5.25,5.25])box(root,.07,.08,5.6,silver,x,.36,0);
  const frontTag=plateLabel(root,'HEAT RESCUE  /  THERMAL EXPERIMENT 01',3.5,.26,0,.2,3.14,'#c5d0d7');
  frontTag.rotation.x=-.10;
  for(const x of [-5.4,5.4])for(const z of [-2.9,2.9])screw(root,x,.315,z);

  // Supply and return manifolds. Fittings remain visible beneath clear hoses.
  for(const [z,material] of [[-2.40,hose],[-2.82,returnHose]]) {
    cylinder(root,.105,9.1,silver,0,.73,z,'x');
    cylinder(root,.074,9.2,material,0,.73,z,'x');
    for(const x of [-4.6,4.6])cylinder(root,.14,.1,brass,x,.73,z,'x');
  }
  plateLabel(root,'SUPPLY  →',1.05,.23,-4.18,1,-2.38);
  plateLabel(root,'RETURN',.95,.23,4.28,1,-2.8,'#91aec4');
  path(root,[[-4.9,.73,-2.4],[-4,.73,-2.4],[0,.73,-2.4],[4.6,.73,-2.4]],{radius:.043,material:hose,index:null,kind:'supply',count:22});

  // A separate, visible backup pump and bypass spine; no implied hydraulic coupling.
  const pump=new THREE.Group();root.add(pump);pump.position.set(-4.8,.5,1.55);
  tag(cylinder(pump,.27,.65,silver,0,.35,0,'z'),null,'pump','Independent backup pump');
  tag(cylinder(pump,.32,.12,shell,0,.35,.35,'z'),null,'pump','Independent backup pump');
  cylinder(pump,.22,.07,accent,0,.35,.42,'z');
  for(let i=0;i<10;i++) {
    const a=i/10*Math.PI*2;box(pump,.04,.15,.6,shell,Math.cos(a)*.26,.35+Math.sin(a)*.26,0).rotation.z=a-Math.PI/2;
  }
  box(pump,.65,.1,.75,shell,0,.04,0);for(const x of [-.25,.25])screw(pump,x,.1,.24);
  const pumpLight=mat(0x234a45,{emissive:0x45dfb0,emissiveIntensity:0});
  cylinder(pump,.06,.025,pumpLight,0,.35,.47,'z');
  plateLabel(pump,'BACKUP',.84,.22,0,.86,.35,'#8fd6bd');
  path(root,[[-4.8,.85,1.55],[-4.8,.7,.8],[-4.75,.65,-.5],[-4.35,.65,-1.7],[4.2,.65,-1.7]],{radius:.045,material:returnHose,index:null,kind:'backup-spine',count:18});

  // Golden output terminates at an explicit electrical load module.
  const load=new THREE.Group();load.position.set(4.92,.48,1.75);root.add(load);
  tag(box(load,.66,.65,.75,shell,0,.32,0),null,'load','Electrical load');
  tag(box(load,.58,.5,.045,dark,0,.36,.4),null,'load','Electrical load');
  for(let i=0;i<5;i++)box(load,.035,.45,.72,silver,-.24+i*.12,.39,0);
  const loadLabel=plateLabel(load,'LOAD',.54,.18,0,.8,.25,'#f3d597');
  cylinder(load,.075,.1,brass,0,.33,-.43,'z');
  const totalLabel=floatingLabel(root,'0.00 W  /  SIMULATED',2.15,4.25,1.7,2.20);

  for(let index=0;index<3;index++) {
    const x=(index-1)*2.95,letter='ABC'[index];
    const group=new THREE.Group();group.position.x=x;root.add(group);
    const tray=new THREE.Group();group.add(tray);tray.position.y=.48;
    const pcb=new THREE.Group();group.add(pcb);pcb.position.y=.76;
    const processors=new THREE.Group();group.add(processors);processors.position.y=.88;
    const hot=new THREE.Group();group.add(hot);hot.position.y=1.12;
    const teg=new THREE.Group();group.add(teg);teg.position.y=1.30;
    const cold=new THREE.Group();group.add(cold);cold.position.y=1.57;
    const indexColor=mat(0x2e6978,{emissive:0x2ee0ff,emissiveIntensity:.15});
    const hotMat=mat(COLORS.copper,{emissive:0xa94c22,emissiveIntensity:.1,metalness:.8,roughness:.32});
    const coldMat=mat(0x55c7dc,{transparent:true,opacity:.42,roughness:.2,metalness:.18,depthWrite:false});
    const tileSide=mat(0x233c47,{metalness:.58,roughness:.38});
    const valveMat=mat(0x5eaec0,{metalness:.65,roughness:.28,emissive:0x005e71,emissiveIntensity:.15});

    // Folded sheet-metal tray, rails, drive bays, handles and ventilation.
    tag(box(tray,2.48,.11,4.2,shell,0,0,0),index,'server',`Server ${letter} chassis`);
    for(const side of [-1,1]) {
      tag(box(tray,.085,.42,4.2,silver,side*1.2,.18,0),index,'server',`Server ${letter} chassis`);
      box(tray,.04,.04,3.9,labelMetal,side*1.25,.4,0);
      box(tray,.18,.36,.12,silver,side*1.31,.13,2.08);
      screw(tray,side*1.31,.16,2.16,'z');
      for(let vent=0;vent<14;vent++)box(tray,.09,.12,.055,dark,side*1.246,.2,-1.6+vent*.24);
    }
    box(tray,2.48,.46,.12,shell,0,.2,2.06);
    for(let slot=0;slot<3;slot++) {
      box(tray,.6,.32,.055,dark,-.78+slot*.72,.23,2.14);
      for(let k=0;k<6;k++)box(tray,.043,.21,.015,labelMetal,-1.02+slot*.72+k*.08,.23,2.176);
      cylinder(tray,.015,.015,indexColor,-.55+slot*.72,.36,2.19,'z',8);
    }
    const handle=torus(tray,.145,.022,silver,.95,.22,2.20);handle.scale.y=.7;
    plateLabel(tray,`${letter}  /  SERVER 0${index+1}`,1.25,.19,-.42,.57,2.075,'#cfdae4');
    const led=box(tray,.8,.018,.025,indexColor,0,.43,2.14);
    tag(led,index,'server',`Select server ${letter}`);

    // Original motherboard with etched copper traces, processors, RAM and capacitors.
    tag(box(pcb,2.18,.055,3.72,boardMat,0,0,0),index,'board',`Server ${letter} circuit board`);
    for(const xx of [-.99,.99])for(const zz of [-1.65,1.65])screw(pcb,xx,.04,zz);
    for(let lane=0;lane<10;lane++) {
      const z=-1.5+lane*.30;
      box(pcb,.95,.003,.009,copper,-.45,.031,z);
      box(pcb,.007,.003,.15+lane*.06,copper,.04,.031,z+.08);
    }
    for(const side of [-1,1])for(let r=0;r<4;r++) {
      box(pcb,.07,.14,1.24,shell,side*(.70+r*.08),.09,.2);
      box(pcb,.025,.04,1.16,gold,side*(.70+r*.08),.04,.2);
      for(let ch=0;ch<5;ch++)box(pcb,.09,.10,.12,chipMat,side*(.70+r*.08),.17,-.28+ch*.23);
    }
    for(let c=0;c<9;c++) {
      cylinder(pcb,.045,.12,silver,-.98+c*.235,.08,-1.50, 'y',12);
      cylinder(pcb,.04,.009,dark,-.98+c*.235,.145,-1.50,'y',12);
    }
    for(const z of [-.7,.55]) {
      tag(box(processors,1.1,.07,.8,silver,0,0,z),index,'processor',`Server ${letter} heat source`);
      box(processors,.81,.055,.59,chipMat,0,.055,z);
      for(let pin=0;pin<10;pin++)for(const side of [-1,1])box(processors,.027,.028,.10,gold,-.43+pin*.095,.015,z+side*.44);
    }
    // Rear fans have visible frames, hubs and rotating blades. Animation is illustrative.
    for(const fx of [-.67,.67]) {
      const fan=new THREE.Group();fan.position.set(fx,.13,-1.84);pcb.add(fan);
      torus(fan,.27,.045,shell,0,0,0);torus(fan,.22,.012,silver,0,0,.02);
      cylinder(fan,.075,.09,silver,0,0,.02,'z',16);
      const rotor=new THREE.Group();fan.add(rotor);
      for(let i=0;i<7;i++) {
        const blade=box(rotor,.19,.065,.025,labelMetal,Math.cos(i*Math.PI*2/7)*.13,Math.sin(i*Math.PI*2/7)*.13,.01);
        blade.rotation.z=i*Math.PI*2/7+.45;
      }
      fans.push(rotor);
    }

    // Copper spreader, ceramic generators and transparent channel cold plate.
    tag(box(hot,1.24,.12,2.35,hotMat,0,0,-.07),index,'hotplate',`Server ${letter} copper hot plate`);
    for(let fin=0;fin<16;fin++)box(hot,.035,.12,2.30,copper,-.55+fin*.073,-.09,-.07);
    for(const xx of [-.53,.53])for(const zz of [-1.08,.94])screw(hot,xx,.074,zz);
    const tiles=[];
    for(let i=0;i<6;i++) {
      const tile=new THREE.Group();teg.add(tile);
      tag(box(tile,.54,.12,.61,tileSide),index,'teg',`Server ${letter} thermoelectric tile`);
      tag(box(tile,.55,.026,.62,insulator,0,.074,0),index,'teg',`Server ${letter} thermoelectric tile`);
      box(tile,.55,.02,.62,insulator,0,-.071,0);
      for(let k=0;k<5;k++)box(tile,.05,.075,.025,copper,-.20+k*.1,0,.319);
      box(tile,.04,.025,.18,gold,.18,.015,.37);tiles.push(tile);
    }
    tag(box(cold,1.37,.22,2.48,coldMat,0,0,-.07),index,'coldplate',`Server ${letter} liquid cold plate`);
    box(cold,1.42,.035,2.53,silver,0,-.13,-.07);
    for(const xx of [-.6,.6])for(const zz of [-1.2,1.05])screw(cold,xx,.126,zz);
    for(let channel=0;channel<6;channel++) {
      cylinder(cold,.029,2.20,hose,-.48+channel*.19,.025,-.07,'z',10);
      if(channel<5)torus(cold,.095,.026,hose,-.385+channel*.19,.025,channel%2?-.95:.81,'y');
    }
    for(const xx of [-.75,.75]) {
      cylinder(cold,.105,.24,brass,xx,.015,-.9,'x');
      cylinder(cold,.075,.18,silver,xx*1.18,.015,-.9,'x');
    }
    const coolantIn=[[x-.8,1.585,-.9],[x-1.03,1.585,-1.05],[x-1.03,.95,-1.85],[x-.78,.73,-2.4]];
    const coolantOut=[[x+.8,1.585,-.9],[x+1.03,1.585,-1.2],[x+1.03,.98,-2.2],[x+.78,.73,-2.82]];
    const inlet=path(root,coolantIn,{index,kind:'main',count:13,moving:'cold'});
    const outlet=path(root,coolantOut,{index,kind:'return',count:12,material:returnHose,moving:'cold'});
    const bypass=path(root,[[x,.65,-1.7],[x-1.13,.72,-1.45],[x-1.05,1.22,.7],[x-.76,1.57,.86]],{index,kind:'backup',radius:.045,count:10,material:returnHose,moving:'backup'});

    // The valve wheel is deliberately large, identifiable and pickable.
    const valve=new THREE.Group();valve.position.set(x-.92,1.08,-1.9);root.add(valve);
    cylinder(valve,.13,.26,brass,0,-.1,0);
    cylinder(valve,.045,.23,silver,0,.09,0);
    const wheel=new THREE.Group();valve.add(wheel);wheel.position.y=.22;
    tag(torus(wheel,.22,.035,valveMat,0,0,0,'y'),index,'valve',`Toggle pipe ${letter}`);
    for(let spoke=0;spoke<4;spoke++) {
      const o=box(wheel,.37,.032,.035,valveMat);o.rotation.y=spoke*Math.PI/4;tag(o,index,'valve',`Toggle pipe ${letter}`);
    }
    tag(cylinder(wheel,.09,.07,valveMat,0,0,0),index,'valve',`Toggle pipe ${letter}`);
    const valveLabel=floatingLabel(root,`PIPE ${letter}`,1.0,x-.93,1.74,-1.95);valveLabel.sprite.material.opacity=.83;

    // Output wires remain distinct from the coolant circuit.
    const electric=path(root,[[x+.53,1.33,.5],[x+.98,1.14,.9],[x+1.08,.7,1.55],[x+.7,.57,2.42],[4.9,.57,2.42],[4.92,.8,1.32]],{index,kind:'electric',radius:.014,count:7,material:gold,moving:'electric'});
    const status=floatingLabel(group,`${letter}   0.00 W`,1.8,0,2.10,.65);
    const guideGeom=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.7,1.0,-1.1),new THREE.Vector3(-.7,4.0,-1.1),new THREE.Vector3(.7,1.0,1),new THREE.Vector3(.7,4.0,1)]);
    const guideMat=new THREE.LineDashedMaterial({color:0x64cfe4,dashSize:.08,gapSize:.09,transparent:true,opacity:.25});materials.add(guideMat);geometries.add(guideGeom);
    const guides=new THREE.LineSegments(guideGeom,guideMat);guides.computeLineDistances();group.add(guides);guides.visible=false;
    parts.push({index,x,group,tray,pcb,processors,hot,teg,cold,tiles,hotMat,coldMat,valveMat,wheel,indexColor,status,valveLabel,inlet,outlet,bypass,electric,guides,lastText:''});
  }

  // Studio lights preserve readable silver and copper rather than neon outlines.
  scene.add(new THREE.HemisphereLight(0xcee8ff,0x23344b,2));
  const key=new THREE.DirectionalLight(0xffe0bd,4.2);key.position.set(-3,10,6);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-10;key.shadow.camera.right=10;key.shadow.camera.top=10;key.shadow.camera.bottom=-10;key.shadow.normalBias=.045;key.shadow.bias=-.0002;key.shadow.radius=4;scene.add(key);
  const rim=new THREE.DirectionalLight(0x7ecaff,3.5);rim.position.set(4,6,-6);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xa2b7d2,1.25);fill.position.set(-9,3,-1);scene.add(fill);
  const spot=new THREE.PointLight(0x69c9df,15,15,2);spot.position.set(0,4,-3.5);scene.add(spot);

  const desired={azimuth:.56,elevation:.67,radius:14.5,target:new THREE.Vector3(0,.8,0)};
  const actual={...desired,target:desired.target.clone()};
  let hover=null,dragDistance=0,lastDistance=0,lastPipeExplode=-1;
  const pointers=new Map(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function rayPick(event) {
    const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(pickables,false).find(hit=>hit.object.visible&&hit.object.parent?.visible)?.object||null;
  }
  function down(event) {
    canvas.focus({preventScroll:true});pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);dragDistance=0;
    if(pointers.size===2){const p=[...pointers.values()];lastDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
  }
  function move(event) {
    if(pointers.has(event.pointerId)) {
      const prev=pointers.get(event.pointerId),dx=event.clientX-prev.x,dy=event.clientY-prev.y;dragDistance+=Math.abs(dx)+Math.abs(dy);
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===1){desired.azimuth-=dx*.006;desired.elevation=clamp(desired.elevation+dy*.004,.12,1.49);}
      else {const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(lastDistance>0)desired.radius=clamp(desired.radius*lastDistance/Math.max(10,d),5,23);lastDistance=d;}
      canvas.style.cursor='grabbing';
    } else {
      hover=rayPick(event);canvas.style.cursor=hover?'pointer':'grab';
      canvas.title=hover?hover.userData.label:'Drag to orbit · scroll to zoom';
    }
  }
  function up(event) {
    if(pointers.size===1&&dragDistance<7) {
      const hit=rayPick(event);if(hit) {
        const {index,component,label}=hit.userData;
        if(Number.isInteger(index)){selected=index;onSelect?.(index);}
        if(component==='valve'&&Number.isInteger(index))onTogglePipe?.(index);
        else onInspect?.({index,component,label});
      }
    }
    pointers.delete(event.pointerId);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);canvas.style.cursor='grab';
  }
  function cancel(event){pointers.delete(event.pointerId);canvas.style.cursor='grab';}
  function wheel(event){event.preventDefault();desired.radius=clamp(desired.radius*Math.exp(event.deltaY*.001),5,23);}
  function keyboard(event) {
    if(event.key==='ArrowLeft')desired.azimuth-=.12;else if(event.key==='ArrowRight')desired.azimuth+=.12;
    else if(event.key==='ArrowUp')desired.elevation=clamp(desired.elevation+.1,.12,1.49);else if(event.key==='ArrowDown')desired.elevation=clamp(desired.elevation-.1,.12,1.49);
    else if(event.key==='+'||event.key==='=')desired.radius=clamp(desired.radius-.7,5,23);else if(event.key==='-')desired.radius=clamp(desired.radius+.7,5,23);else return;
    event.preventDefault();
  }
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',keyboard);
  function resize() {
    const rect=host.getBoundingClientRect();hasSize=rect.width>0&&rect.height>0;
    if(!hasSize)return;
    const w=rect.width,h=rect.height;
    renderer.setSize(w,h,false);camera.aspect=w/h;
    camera.fov=Math.min(80,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(40)/2)*Math.max(1,1.3/camera.aspect))));
    camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const visibility=new IntersectionObserver(entries=>{onScreen=entries[0]?.isIntersecting!==false;},{rootMargin:'60px'});visibility.observe(host);

  function updateLabel(label,text,color='#bceef7') {
    if(label.lastText===text)return;label.lastText=text;
    const {ctx,canvas:c,texture}=label;ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='rgba(12,22,34,.90)';ctx.beginPath();ctx.roundRect(0,0,c.width,c.height,16);ctx.fill();
    ctx.font='600 39px "DM Sans", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,c.width/2,c.height/2,c.width-24);texture.needsUpdate=true;
  }
  function setSnapshot(snapshot,selectedIndex=selected) {
    canvas.setAttribute('aria-label','Interactive simulated cooling assembly. Drag to rotate, scroll to zoom. Select a server or click a valve to change its pipe.');
    latest=snapshot;designOnly=false;totalLabel.sprite.visible=true;selected=clamp(Number.isInteger(selectedIndex)?selectedIndex:1,0,2);
    for(const p of parts) {
      const b=snapshot?.branches?.[p.index];if(!b)continue;
      p.valveLabel.sprite.visible=true;
      const count=clamp(Math.floor(b.count||0),0,6);
      for(let i=0;i<p.tiles.length;i++) {
        const tile=p.tiles[i];tile.visible=i<count;
        // Two columns preserve each ceramic module's identity at every layout.
        tile.position.set(count===1?0:((i%2)-.5)*.61,0,(Math.floor(i/2)-(Math.ceil(count/2)-1)/2)*.72-.07);
      }
      const heat=clamp((b.hotC-38)/55,0,1);
      p.hotMat.emissive.setHex(thermal?0xe64d1a:0xae4922);p.hotMat.emissiveIntensity=(thermal?1.5:.42)*heat;
      p.hotMat.color.setHSL(.07-.04*heat,.58,.44+heat*.12);
      p.coldMat.color.setHSL(clamp(.54-(b.coldC-25)*.006,.07,.54),.64,thermal?.56:.47);p.coldMat.opacity=thermal?.65:.42;
      p.valveMat.color.setHex(b.blocked?COLORS.red:0x5eaec0);p.valveMat.emissive.setHex(b.blocked?0xa23517:0x005e71);p.valveMat.emissiveIntensity=b.blocked?.55:.15;
      p.wheel.rotation.y=b.blocked?Math.PI/4:0;
      p.indexColor.emissiveIntensity=p.index===selected?1.7:.14;
      updateLabel(p.status,`${'ABC'[p.index]}  ${Number(b.hotC).toFixed(1)}°   ${Number(b.powerW).toFixed(2)} W`,b.blocked&&!b.backupActive?'#ffb192':'#bceef7');
      p.status.sprite.material.opacity=p.index===selected?1:.78;
      updateLabel(p.valveLabel,b.blocked?`RESTORE ${'ABC'[p.index]}`:`PIPE ${'ABC'[p.index]}`,b.blocked?'#ffb192':'#9ec9d6');
    }
    updateLabel(totalLabel,`${Number(snapshot?.totalPowerW||0).toFixed(2)} W  /  OUTPUT`,'#f1d797');
    pumpLight.emissiveIntensity=snapshot?.backupActive?2:.03;
  }
  function setDesign(design={}) {
    canvas.setAttribute('aria-label','Proposed tile layout. Drag/arrow keys to rotate, scroll/+/- to zoom. Geometry only; no live temperatures or flow.');
    designOnly=true;totalLabel.sprite.visible=false;thermal=false;
    const counts=Array.isArray(design.counts)?design.counts:[2,2,2];
    for(const p of parts) {
      const count=clamp(Math.floor(counts[p.index]||0),0,6);
      for(let i=0;i<p.tiles.length;i++) {
        p.tiles[i].visible=i<count;
        p.tiles[i].position.set(count===1?0:((i%2)-.5)*.61,0,(Math.floor(i/2)-(Math.ceil(count/2)-1)/2)*.72-.07);
      }
      p.hotMat.color.setHex(COLORS.copper);p.hotMat.emissiveIntensity=.025;
      p.coldMat.color.setHex(0x55c7dc);p.coldMat.opacity=.32;
      p.valveMat.color.setHex(0x5eaec0);p.valveMat.emissiveIntensity=.08;p.wheel.rotation.y=0;
      updateLabel(p.status,`${'ABC'[p.index]}  /  ${count} ${count===1?'TILE':'TILES'}`,'#bceef7');
      p.valveLabel.sprite.visible=false;p.status.sprite.material.opacity=.9;
    }
    pumpLight.emissiveIntensity=0;
  }
  function setView(view) {
    const presets={orbit:[.56,.67,14.5,0,.8,0],top:[0,1.48,13.8,0,.7,0],front:[.05,.23,13.3,0,1,0],component:[.5,.7,7.1,parts[selected].x,1.3,0]};
    const p=presets[view]||presets.orbit;
    [desired.azimuth,desired.elevation,desired.radius]=p;desired.target.set(p[3],p[4],p[5]);
  }
  function animate(now) {
    if(disposed)return;frameId=requestAnimationFrame(animate);
    const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
    if(document.hidden||!hasSize||!onScreen)return;
    const running=!designOnly&&(latest?latest._running!==false:true);
    if(!document.hidden&&running&&!reduced.matches)clock+=dt;
    const mix=reduced.matches?1:1-Math.exp(-dt*8);
    actual.azimuth=THREE.MathUtils.lerp(actual.azimuth,desired.azimuth,mix);actual.elevation=THREE.MathUtils.lerp(actual.elevation,desired.elevation,mix);actual.radius=THREE.MathUtils.lerp(actual.radius,desired.radius,mix);actual.target.lerp(desired.target,mix);
    camera.position.set(actual.target.x+actual.radius*Math.sin(actual.azimuth)*Math.cos(actual.elevation),actual.target.y+actual.radius*Math.sin(actual.elevation),actual.target.z+actual.radius*Math.cos(actual.azimuth)*Math.cos(actual.elevation));camera.lookAt(actual.target);
    explodeAmount=THREE.MathUtils.lerp(explodeAmount,exploded?1:0,mix);
    for(const p of parts) {
      p.tray.position.z=explodeAmount*.38;p.pcb.position.y=.76+explodeAmount*.15;p.processors.position.y=.88+explodeAmount*.43;
      p.hot.position.y=1.12+explodeAmount*.90;p.teg.position.y=1.30+explodeAmount*1.42;p.cold.position.y=1.57+explodeAmount*2.0;
      p.guides.visible=explodeAmount>.06;p.status.sprite.position.y=2.1+explodeAmount*2.0;
    }
    if(Math.abs(explodeAmount-lastPipeExplode)>.018) {
      lastPipeExplode=explodeAmount;
      for(const p of parts) {
        for(const pipe of [p.inlet,p.outlet])updatePath(pipe,pipe.points.map((v,i)=>[v[0],v[1]+(i<2?explodeAmount*2:0),v[2]]));
        updatePath(p.bypass,p.bypass.points.map((v,i)=>[v[0],v[1]+(i===3?explodeAmount*2:i===2?explodeAmount:0),v[2]]));
        updatePath(p.electric,p.electric.points.map((v,i)=>[v[0],v[1]+(i===0?explodeAmount*1.42:i===1?explodeAmount*.6:0),v[2]]));
      }
    }
    for(const p of flowPaths) {
      const b=p.index===null?null:latest?.branches?.[p.index];
      let active=true,power=1;
      if(p.kind==='main')active=b?!b.blocked:false;
      if(p.kind==='return')active=Boolean(b&&(!b.blocked||b.backupActive));
      if(p.kind==='backup')active=Boolean(b?.backupActive);
      if(p.kind==='backup-spine')active=Boolean(latest?.backupActive);
      if(p.kind==='electric'){active=Boolean(b?.count&&b?.powerW>0);power=clamp((b?.powerW||0)/.6,.05,1.5);p.beadMaterial.emissiveIntensity=.3+power*1.7;}
      if(designOnly)active=false;
      // A stopped pipe has static fluid. Pulses cease entirely so no normal-flow
      // animation is shown through a blocked main path, even with backup active.
      for(let i=0;i<p.beads.length;i++) {
        const bead=p.beads[i];bead.visible=active;
        if(active){let t=(i/p.beads.length+clock*(p.kind==='electric'?.15:.10))%1;if(p.kind==='main')t=1-t;bead.position.copy(p.curve.getPointAt(t));bead.scale.setScalar(p.kind==='electric'?.6+power*.6:1);}
      }
      if(p.kind==='backup'||p.kind==='backup-spine')p.tube.material.opacity=!designOnly&&latest?.backupActive ? .38 : .20;
    }
    for(const fan of fans)fan.rotation.z=clock*3;
    if(!document.hidden)renderer.render(scene,camera);
  }
  frameId=requestAnimationFrame(animate);
  function dispose() {
    if(disposed)return;disposed=true;cancelAnimationFrame(frameId);observer.disconnect();visibility.disconnect();
    canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keyboard);
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();renderer.dispose();canvas.remove();
  }
  return {available:true,setSnapshot,setDesign,setExploded(value){exploded=Boolean(value);if(exploded&&desired.radius>10)desired.target.y=1.35;else if(!exploded)desired.target.y=.8;},setThermal(value){thermal=Boolean(value);if(latest&&!designOnly)setSnapshot(latest,selected);},setView,resize,dispose};
}
