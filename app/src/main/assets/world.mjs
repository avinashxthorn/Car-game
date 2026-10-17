import * as T from './vendor/three.module.min.js';
import {route, clamp} from './physics.mjs';
const UP = new T.Vector3(0,1,0);
const material = (color, extra={}) => new T.MeshStandardMaterial({color, roughness:.85,...extra});
const boxGeometry=new T.BoxGeometry(1,1,1);
const sphereGeometry=new T.IcosahedronGeometry(1,1);
function mesh(geometry,mat,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
function box(parent,mat,x,y,z,sx,sy,sz){return mesh(boxGeometry,mat,parent,x,y,z,sx,sy,sz);}
function hash(n){return ((Math.sin(n*127.1+311.7)*43758.5453)%1+1)%1;}
function skin(sections,mat,parent){
 const p=[],idx=[];
 sections.forEach(([z,w,b,t])=>p.push(-w,b,z,w,b,z,w,t,z,-w,t,z));
 for(let i=0;i<sections.length-1;i++) for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;idx.push(a,c,b,b,c,d);}
 idx.push(0,1,2,0,2,3);const e=(sections.length-1)*4;idx.push(e,e+2,e+1,e,e+3,e+2);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx.flatMap((_,i)=>i%3===0?[idx[i],idx[i+2],idx[i+1]]:[]));g.computeVertexNormals();
 const m=mesh(g,mat,parent);m.castShadow=true;return m;
}
export function makeCar(color='#b8e66b',simple=false){
 const group=new T.Group(),body=new T.Group();group.add(body);
 const paint=material(color,{metalness:.3,roughness:.26});
 const dark=material('#152329',{metalness:.35,roughness:.32});
 const glass=material('#284d5c',{metalness:.65,roughness:.16});
 const rubber=material('#182125',{roughness:.95});
 const alloy=material('#a8bec6',{metalness:.85,roughness:.24});
 const red=material('#f13e38',{emissive:'#e32d25',emissiveIntensity:.65});
 const white=material('#edffed',{emissive:'#d8ffec',emissiveIntensity:.6});
 skin([[-2.16,.82,.36,.6],[-1.75,1,.32,.86],[-.6,1.03,.33,.98],[.95,1.01,.32,.94],[1.95,.91,.4,.79],[2.12,.82,.45,.65]],paint,body);
 box(body,dark,0,.36,0,1.95,.18,3.8);
 // Sculpted cabin: sloped front glass, low roof, tapered rear screen.
 skin([[-.77,.82,.91,.94],[-.2,.73,.94,1.48],[.65,.72,.94,1.48],[1.32,.84,.88,.97]],glass,body);
 box(body,paint,.0,1.5,.23,1.45,.055,.87);
 for(const side of [-1,1]){
  const pillar=box(body,paint,side*.75,1.2,.55,.07,.57,.065);pillar.rotation.z=side*.16;
  box(body,paint,side*.87,.91,.32,.05,.09,1.7);
  box(body,dark,side*.99,.51,.1,.06,.13,2.3);
  box(body,paint,side*1.07,1.0,-.4,.25,.14,.31);
  box(body,white,side*.58,.68,-2.115,.43,.1,.04);
  box(body,red,side*.59,.76,2.02,.5,.095,.04);
  if(!simple){box(body,alloy,side*.77,.95,.7,.21,.035,.055);box(body,dark,side*.52,.45,2.1,.29,.12,.1);}
 }
 box(body,dark,0,.46,-2.16,1.04,.16,.06);
 box(body,dark,0,.42,2.12,1.55,.16,.1);
 box(body,paint,0,.97,1.9,1.85,.08,.3);
 box(body,dark,0,.88,1.86,1.4,.12,.1);
 box(body,white,0,.62,2.15,.39,.12,.025);
 if(!simple){
  for(const x of [-.29,.29]){box(body,dark,x,.877,-1.45,.17,.01,.62);}
  for(const x of [-.44,.44]){const exhaust=mesh(new T.CylinderGeometry(.07,.07,.14,10),alloy,body,x,.37,2.13);exhaust.rotation.x=Math.PI/2;}
 }
 const wheels=[];
 for(const x of [-.99,.99])for(const z of [-1.36,1.33]){
  const pivot=new T.Group();pivot.position.set(x,.4,z);group.add(pivot);
  const rolling=new T.Group();pivot.add(rolling);
  const tire=mesh(new T.CylinderGeometry(.4,.4,.29,16),rubber,rolling);tire.rotation.z=Math.PI/2;tire.castShadow=true;
  const rim=mesh(new T.CylinderGeometry(.27,.27,.305,12),alloy,rolling);rim.rotation.z=Math.PI/2;
  const inner=mesh(new T.CylinderGeometry(.22,.22,.31,12),dark,rolling);inner.rotation.z=Math.PI/2;
  if(!simple)for(let i=0;i<5;i++){
   const spoke=box(rolling,alloy,x>0?.158:-.158,0,0,.012,.46,.045);spoke.rotation.x=i*Math.PI/5;
  }
  wheels.push({pivot,rolling,front:z<0});
 }
 // Soft contact shadow complements the sun's dynamic shadow.
 const c=document.createElement('canvas');c.width=64;c.height=128;const ctx=c.getContext('2d');const gr=ctx.createRadialGradient(32,64,6,32,64,60);gr.addColorStop(0,'#0009');gr.addColorStop(1,'#0000');ctx.fillStyle=gr;ctx.fillRect(0,0,64,128);
 const shadow=mesh(new T.PlaneGeometry(3.3,5.9),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}),group,0,.025,0);shadow.rotation.x=-Math.PI/2;
 return {group,body,paint,wheels,red};
}

export class World {
 constructor(canvas,quality='high'){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setClearColor('#c7e5df');this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.scene.fog=new T.Fog('#c7e5df',190,720);
  this.camera=new T.PerspectiveCamera(56,1,.15,1600);
  this.sun=new T.DirectionalLight('#fff3cb',3.0);this.sun.position.set(-90,130,-70);this.sun.castShadow=true;
  this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-35,right:35,top:45,bottom:-35,near:1,far:320});this.sun.shadow.bias=-.0005;this.sun.shadow.normalBias=.03;
  this.scene.add(this.sun,this.sun.target);this.hemi=new T.HemisphereLight('#c3edff','#60753d',2.2);this.scene.add(this.hemi);
  this.sky=new T.Mesh(new T.SphereGeometry(1400,20,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#60b8dd')},bottom:{value:new T.Color('#e8f1d9')}},vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 v;void main(){float h=normalize(v).y;gl_FragColor=vec4(mix(bottom,top,pow(max(h,0.),.65)),1.);}'}));this.scene.add(this.sky);
  this.car=makeCar();this.scene.add(this.car.group);
  this.mats={grass:material('#77a74e'),road:material('#394447',{roughness:.97}),edge:material('#e1e5d3'),dirt:material('#bbba89'),trunk:material('#78563c'),pine:material('#2a6847'),leaves:material('#488f50'),rock:material('#9aab88'),rail:material('#bdcbb5',{metalness:.3}),yellow:material('#e5cc74')};
  this.addRoadTexture();
  this.chunks=[];this.chunkKey=-999;
  this.treeGeo=new T.ConeGeometry(1,1,7);this.trunkGeo=new T.CylinderGeometry(.15,.22,1,5);
  this.dummy=new T.Object3D();
  this.clouds=this.makeClouds();
  this.traffic=[];
  ['#eee7d3','#d4674c','#6598b0','#dac068','#99b89e','#ccd4e0'].forEach((color,i)=>{const car=makeCar(color,true);this.scene.add(car.group);this.traffic.push({car,s:160+i*127,lateral:i%3===0?2.6:-2.6,speed:i%3===0?-16:17+i,passed:false});});
  this.particles=[];
  const dustMat=material('#c8bb8d',{transparent:true,opacity:.4,depthWrite:false});
  for(let i=0;i<20;i++){const p=mesh(sphereGeometry,dustMat.clone(),this.scene);p.visible=false;this.particles.push({mesh:p,life:0});}
  this.birds=[];const birdmat=material('#344b4b');
  for(let i=0;i<6;i++){const b=new T.Group();for(let k of [-1,1]){const wing=box(b,birdmat,k*.5,0,0,1,.04,.2);wing.rotation.z=k*.28;}this.scene.add(b);this.birds.push(b);}
  this.cameraPos=new T.Vector3();this.lookAt=new T.Vector3();this.resetCamera=true;this.setQuality(quality);this.resize();
 }
 addRoadTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#899397';x.fillRect(0,0,128,128);for(let i=0;i<3400;i++){let a=80+Math.floor(hash(i)*100);x.fillStyle=`rgba(${a},${a},${a},.32)`;x.fillRect(hash(i+50)*128,hash(i+190)*128,1.2,1.2);}const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(2,24);tex.colorSpace=T.SRGBColorSpace;this.mats.road.map=tex;
 }
 setQuality(q){this.quality=q;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,q==='high'?1.5:1));this.renderer.shadowMap.enabled=q==='high';this.resize();}
 setLight(golden){this.sun.color.set(golden?'#ffb66d':'#fff3cb');this.sun.intensity=golden?3.7:3;this.hemi.intensity=golden?1.5:2.2;this.scene.fog.color.set(golden?'#e8cfac':'#c7e5df');this.sky.material.uniforms.top.value.set(golden?'#92bdc8':'#60b8dd');this.sky.material.uniforms.bottom.value.set(golden?'#ffe4b1':'#e8f1d9');}
 resize(){this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
 groundY(s,offset){return route(s).y-.1+Math.max(0,Math.abs(offset)-10)*(.16+.10*Math.sin(s*.014+offset*.01))+Math.max(0,Math.abs(offset)-60)*.13*Math.sin(s*.018+offset*.02);}
 strip(start,length,offsets,mat,ground=false){
  const p=[],uv=[],index=[];const steps=24;
  for(let i=0;i<=steps;i++){const s=start+length*i/steps,r=route(s),n=1/Math.sqrt(1+r.dx*r.dx);for(let j=0;j<offsets.length;j++){const o=offsets[j];p.push(r.x+o*n,ground?this.groundY(s,o):r.y+.025,-s+o*r.dx*n);uv.push(j/(offsets.length-1),i/steps);}}
  for(let i=0;i<steps;i++)for(let j=0;j<offsets.length-1;j++){const a=i*offsets.length+j,b=a+offsets.length;index.push(a,a+1,b,a+1,b+1,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();const m=new T.Mesh(g,mat);m.receiveShadow=true;return m;
 }
 makeChunk(start){
  const group=new T.Group();this.scene.add(group);
  group.add(this.strip(start,120,[-320,-200,-100,-45,-15,-7,0,7,15,45,100,200,320],this.mats.grass,true));
  group.add(this.strip(start,120,[-6.5,6.5],this.mats.dirt));
  const road=this.strip(start,120,[-5.5,5.5],this.mats.road);road.position.y=.015;group.add(road);
  for(const o of [-5.15,5.15]){const line=this.strip(start,120,[o-.07,o+.07],this.mats.edge);line.position.y=.03;group.add(line);}
  for(let i=0;i<10;i++){const line=this.strip(start+i*12,5,[-.075,.075],this.mats.edge);line.position.y=.035;group.add(line);}
  const trunks=new T.InstancedMesh(this.trunkGeo,this.mats.trunk,48),foliage=new T.InstancedMesh(this.treeGeo,this.mats.pine,48),rounds=new T.InstancedMesh(sphereGeometry,this.mats.leaves,48),rocks=new T.InstancedMesh(sphereGeometry,this.mats.rock,12),posts=new T.InstancedMesh(boxGeometry,this.mats.edge,12);
  const dummy=this.dummy;
  for(let i=0;i<48;i++){
   const seed=start*2+i*37,side=i%2?1:-1,s=start+hash(seed)*120,offset=side*(13+hash(seed+1)*133),r=route(s),n=1/Math.sqrt(1+r.dx*r.dx),x=r.x+offset*n,z=-s+offset*r.dx*n,y=this.groundY(s,offset),h=4+hash(seed+2)*8;
   dummy.position.set(x,y+h*.25,z);dummy.rotation.set(0,0,0);dummy.scale.set(1.5,h*.5,1.5);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
   dummy.position.y=y+h*.67;dummy.scale.set(h*.35,h,h*.35);dummy.rotation.y=hash(seed+3)*6;dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);
   dummy.position.set(x+side*4,y+h*.45,z+3);dummy.scale.set(h*.32,h*.4,h*.32);dummy.updateMatrix();rounds.setMatrixAt(i,dummy.matrix);
   const c=new T.Color().setHSL(.29+hash(seed+4)*.06,.32+hash(seed+5)*.15,.27+hash(seed+6)*.09);foliage.setColorAt(i,c);
  }
  for(let i=0;i<12;i++){
   const s=start+i*10,side=i%2?1:-1,r=route(s),n=1/Math.sqrt(1+r.dx*r.dx),off=side*7.4;
   dummy.position.set(r.x+off*n,r.y+.5,-s+off*r.dx*n);dummy.rotation.set(0,r.yaw,0);dummy.scale.set(.16,1.1,.16);dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix);
   const o=side*(17+hash(s+5)*30);dummy.position.set(r.x+o*n,this.groundY(s,o)+.5,-s+o*r.dx*n);dummy.scale.set(1+hash(s)*2,.8+hash(s+1),1+hash(s+2));dummy.rotation.set(.2,s,0);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }
  foliage.castShadow=true;trunks.castShadow=true;rounds.castShadow=true;
  group.add(trunks,foliage,rounds,rocks,posts);
  return {start,group};
 }
 stream(s){
  const key=Math.floor(s/120);if(key===this.chunkKey)return;this.chunkKey=key;
  const min=(key-2)*120,max=(key+7)*120;
  for(let i=this.chunks.length-1;i>=0;i--){const chunk=this.chunks[i];if(chunk.start<min||chunk.start>max){this.scene.remove(chunk.group);chunk.group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)o.geometry.dispose();if(o.isInstancedMesh)o.dispose();});this.chunks.splice(i,1);}}
  for(let start=min;start<=max;start+=120)if(!this.chunks.some(c=>c.start===start))this.chunks.push(this.makeChunk(start));
 }
 makeClouds(){
  const g=new T.Group();this.scene.add(g);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');
  for(let i=0;i<12;i++){const x=30+hash(i)*196,y=50+hash(i+13)*30,r=15+hash(i+31)*35,gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'#fff9');gr.addColorStop(.4,'#fff8');gr.addColorStop(1,'#fff0');c.fillStyle=gr;c.fillRect(x-r,y-r,r*2,r*2);}
  const mat=new T.SpriteMaterial({map:new T.CanvasTexture(canvas),transparent:true,opacity:.7,fog:false,depthWrite:false});
  for(let i=0;i<14;i++){const cloud=new T.Sprite(mat);cloud.position.set((hash(i+60)-.5)*1600,110+hash(i+70)*140,-800+hash(i+90)*1200);cloud.scale.set(190+hash(i)*100,70,1);g.add(cloud);}return g;
 }
 resetTraffic(s){this.traffic.forEach((v,i)=>{v.s=s+150+i*127;v.passed=false;});this.resetCamera=true;}
 placeCar(car,s,lateral,steer=0,speed=0,dt=0){
  const r=route(s),n=1/Math.sqrt(1+r.dx*r.dx);car.group.position.set(r.x+lateral*n,r.y+.06,-s+lateral*r.dx*n);
  car.group.rotation.set(-Math.atan(r.dy),r.yaw-steer*.13,0);
  car.body.rotation.z=steer*Math.min(speed/55,1)*.045;
  car.body.position.y=Math.sin(s*1.7)*Math.min(speed/45,1)*.015;
  for(const w of car.wheels){if(w.front)w.pivot.rotation.y=-steer*.4;w.rolling.rotation.x-=speed*dt/.4;}
 }
 update(state,dt,time,{menu=false,cameraMode=0,onCollision=()=>{},onPass=()=>{}}={}){
  const s=menu?350:state.s,r=route(s);this.stream(s);
  this.placeCar(this.car,s,menu?0:state.lateral,menu?-.28:state.steer,state.speed,dt);
  this.car.red.emissiveIntensity=state.braking?2:.6;
  this.car.group.visible=menu||cameraMode!==2;
  this.car.body.rotation.x+=(clamp((state.braking?.035:state.boosting?-.025:0)-this.car.body.rotation.x,-.02,.02));
  for(const v of this.traffic){
   if(!menu&&!state.finished)v.s+=v.speed*dt;
   if(v.s<s-35||v.s>s+900){v.s=s+680+hash(time+v.speed)*110;v.passed=false;}
   this.placeCar(v.car,v.s,v.lateral,0,menu?0:v.speed,dt);
   if(v.speed<0)v.car.group.rotation.y+=Math.PI;
   v.car.group.visible=!menu;
   if(!menu&&Math.abs(v.s-state.s)<4.1&&Math.abs(v.lateral-state.lateral)<1.75)onCollision();
   if(!menu&&!v.passed&&v.s<state.s-4){v.passed=true;if(Math.abs(v.lateral-state.lateral)<3.8)onPass();}
  }
  const player=this.car.group.position,n=1/Math.sqrt(1+r.dx*r.dx),forward=new T.Vector3(r.dx*n,0,-n),right=new T.Vector3(n,0,r.dx*n);
  const targetPos=new T.Vector3(),targetLook=new T.Vector3();
  if(menu){const orbit=Math.sin(time*.12)*.35;targetPos.copy(player).addScaledVector(right,9+orbit).addScaledVector(forward,-9).add(new T.Vector3(0,4.3,0));targetLook.copy(player).addScaledVector(right,-3).add(new T.Vector3(0,.8,0));this.camera.fov=47;}
  else{
   const far=cameraMode===1;const hood=cameraMode===2;
   targetPos.copy(player).addScaledVector(forward,hood?1.15:far?-13:-8.8).add(new T.Vector3(0,hood?1.3:far?5.7:3.6,0));
   targetPos.addScaledVector(right,-state.steer*.35);
   const ahead=route(s+23);targetLook.set(ahead.x+state.lateral*n,ahead.y+(hood?1.1:1.1),-s-23+state.lateral*r.dx*n);
   this.camera.fov+=( (state.boosting?70:hood?64:58)-this.camera.fov)*(1-Math.exp(-dt*3));
  }
  if(this.resetCamera){this.cameraPos.copy(targetPos);this.lookAt.copy(targetLook);this.resetCamera=false;}
  const smooth=menu?.045:1-Math.exp(-dt*7);this.cameraPos.lerp(targetPos,smooth);this.lookAt.lerp(targetLook,smooth);
  this.camera.position.copy(this.cameraPos);this.camera.lookAt(this.lookAt);this.camera.updateProjectionMatrix();
  this.sun.position.copy(player).add(new T.Vector3(-65,105,-40));this.sun.target.position.copy(player);
  this.sky.position.copy(player);this.clouds.position.set(r.x,0,-s);
  this.birds.forEach((b,i)=>{b.position.set(r.x+35+Math.sin(time*.25+i)*25,r.y+36+Math.sin(time+i)*2,-s-120-i*10);b.children.forEach((w,k)=>w.rotation.z=(k?1:-1)*(.2+Math.sin(time*5+i)*.28));});
  if(!menu&&Math.abs(state.lateral)>5.1&&state.speed>8){const particle=this.particles.find(p=>p.life<=0);if(particle){particle.life=.8;particle.mesh.visible=true;particle.mesh.position.copy(player).addScaledVector(forward,-2);particle.mesh.position.y+=.2;}}
  for(const p of this.particles)if(p.life>0){p.life-=dt;p.mesh.position.y+=dt*.8;p.mesh.scale.setScalar((.8-p.life)*1.3+.2);p.mesh.material.opacity=p.life*.45;p.mesh.visible=p.life>0;}
 }
 render(){this.renderer.render(this.scene,this.camera);}
}
