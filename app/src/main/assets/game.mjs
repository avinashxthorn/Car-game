import {World} from './world.mjs';
import {newDrive,tick,impact,clamp,route} from './physics.mjs';
const $=id=>document.getElementById(id);
const show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
const defaults={steeringMode:'wheel',sensitivity:1,autoGas:false,sound:true,haptics:true,quality:'high',daylight:'day',color:'#b8e66b',best:0};
let settings={...defaults};try{settings={...defaults,...JSON.parse(localStorage.getItem('saini-settings')||'{}')};}catch{}
let drive=newDrive(),view='home',mode='cruise',cameraMode=0,world,settingsFrom='home',last=0,accumulator=0,time=0,toastUntil=0;
let tiltValue=0,tiltZero=0,tiltAvailable=!!window.SainiNative?.hasTilt();
const input={steer:0,gas:false,brake:false,boost:false},held=new Set(),keys=new Set();let wheelSteer=0,wheelPointer=null,wheelStart=0;
function persist(){settings.best=Math.max(settings.best,drive.distance);try{localStorage.setItem('saini-settings',JSON.stringify(settings));}catch{}}
function notify(text,seconds=2){$('notice').textContent=text;toastUntil=time+seconds;}
function vibrate(ms=35){if(!settings.haptics)return;try{window.SainiNative?.vibrate(ms);}catch{}}
class EngineAudio{
 constructor(){this.ctx=null;}
 start(){
  if(!settings.sound)return;
  try{
   if(!this.ctx){
    this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.gain=this.ctx.createGain();this.gain.gain.value=0;this.gain.connect(this.ctx.destination);
    const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=420;filter.Q.value=.5;filter.connect(this.gain);this.filter=filter;
    this.a=this.ctx.createOscillator();this.a.type='sawtooth';this.a.frequency.value=40;this.a.connect(filter);this.a.start();
    this.b=this.ctx.createOscillator();this.b.type='triangle';this.b.frequency.value=80;const quiet=this.ctx.createGain();quiet.gain.value=.5;this.b.connect(quiet);quiet.connect(filter);this.b.start();
    const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.25;
    const noise=this.ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=600;this.noise=this.ctx.createGain();this.noise.gain.value=0;noise.connect(f);f.connect(this.noise);this.noise.connect(this.ctx.destination);noise.start();
   }
   this.ctx.resume().catch(()=>{});
  }catch{}
 }
 update(){if(!this.ctx)return;const t=this.ctx.currentTime,active=view==='playing'&&settings.sound;const rpm=40+(drive.speed%12)*3.5+drive.speed*.35;this.a.frequency.setTargetAtTime(rpm,t,.08);this.b.frequency.setTargetAtTime(rpm*2.01,t,.08);this.filter.frequency.setTargetAtTime(260+drive.speed*12+(drive.boosting?450:0),t,.1);this.gain.gain.setTargetAtTime(active?(input.gas?.045:.02):0,t,.06);this.noise.gain.setTargetAtTime(active?(Math.abs(drive.lateral)>5.1?.12:drive.speed*.0004):0,t,.06);}
 crash(){if(!this.ctx||!settings.sound)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime;o.type='triangle';o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(25,t+.2);g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(t+.26);o.onended=()=>{o.disconnect();g.disconnect();};}
}
const audio=new EngineAudio();
function clearInput(){held.clear();keys.clear();wheelSteer=0;wheelPointer=null;input.steer=0;input.gas=input.brake=input.boost=false;document.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));}
function settingsUI(){
 for(const id of ['steeringMode','sensitivity','autoGas','sound','haptics','quality','daylight']){const e=$(id);if(e.type==='checkbox')e.checked=!!settings[id];else e.value=settings[id];}
 const steering=settings.steeringMode;show('wheelZone',steering==='wheel');show('arrows',steering==='arrows');show('tiltHint',steering==='tilt');
 $('gas').classList.toggle('auto',settings.autoGas);
 $('hint').textContent=steering==='tilt'?'Hold your phone level. Tilt left or right to steer.':steering==='arrows'?'Hold the accelerator. Use the arrows to steer.':'Hold the accelerator. Drag the wheel to steer.';
 $('best').textContent=`BEST ${(settings.best/1000).toFixed(2)} KM`;
 document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('selected',b.dataset.color===settings.color));
 if(world){world.car.paint.color.set(settings.color);world.setQuality(settings.quality);world.setLight(settings.daylight==='golden');}
}
function startDrive(){
 clearInput();drive=newDrive(mode);view='playing';cameraMode=0;tiltZero=tiltValue;
 world.resetTraffic(drive.s);['home','pauseScreen','settings','results'].forEach(id=>show(id,false));show('hud');show('mission',mode==='sprint');$('modeLabel').textContent=mode==='sprint'?'3 KM SPRINT':'FREE DRIVE';settingsUI();audio.start();notify('THE ROAD IS YOURS',2);vibrate(20);accumulator=0;last=performance.now();
}
function pause(){if(view!=='playing')return;view='paused';clearInput();persist();show('pauseScreen');audio.update();}
function resume(){view='playing';show('pauseScreen',false);clearInput();last=performance.now();accumulator=0;audio.start();}
function goHome(){persist();view='home';clearInput();['hud','pauseScreen','settings','results'].forEach(id=>show(id,false));show('home');world.resetCamera=true;settingsUI();audio.update();}
function finish(){
 persist();view='results';clearInput();show('hud',false);show('results');$('resultLabel').textContent=drive.won?'FINISH LINE CROSSED':'SPRINT COMPLETE';$('resultTitle').textContent=drive.won?'That’s your road.':drive.health<=0?'Time for a fresh start.':'So close. Go again.';
 $('resultDistance').textContent=`${(drive.distance/1000).toFixed(2)} km`;$('resultScore').textContent=Math.floor(drive.score).toLocaleString();$('resultTime').textContent=`${drive.elapsed.toFixed(1)}s`;audio.update();
}
function openSettings(){settingsFrom=view;show('pauseScreen',false);show('settings');clearInput();}
function closeSettings(){show('settings',false);if(settingsFrom==='paused')show('pauseScreen');persist();}
window.sainiPause=()=>{pause();persist();};
window.sainiBack=()=>{if(!$('settings').classList.contains('hidden'))closeSettings();else if(view==='playing')pause();else if(view==='paused')resume();else if(view==='results')goHome();};
window.sainiTilt=v=>{tiltValue=clamp(v,-1.5,1.5);};
window.addEventListener('deviceorientation',e=>{if(window.SainiNative||e.beta===null)return;const a=screen.orientation?.angle??90;tiltValue=clamp((e.beta/28)*(a===270?-1:1),-1.5,1.5);tiltAvailable=true;});
window.addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
window.addEventListener('resize',()=>{world?.resize();if(innerHeight>innerWidth)pause();});
document.addEventListener('contextmenu',e=>e.preventDefault());
function hold(id){const el=$(id);el.addEventListener('pointerdown',e=>{if(view!=='playing')return;e.preventDefault();el.setPointerCapture(e.pointerId);held.add(id);el.classList.add('pressed');audio.start();});const end=()=>{held.delete(id);el.classList.remove('pressed');};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);}
['gas','brake','boost','left','right'].forEach(hold);
$('wheelZone').addEventListener('pointerdown',e=>{if(view!=='playing')return;e.preventDefault();if(wheelPointer!==null)return;wheelPointer=e.pointerId;wheelStart=e.clientX-wheelSteer*90;$('wheelZone').setPointerCapture(e.pointerId);});
$('wheelZone').addEventListener('pointermove',e=>{if(e.pointerId===wheelPointer)wheelSteer=clamp((e.clientX-wheelStart)/90,-1,1);});
function releaseWheel(e){if(e.pointerId===wheelPointer){wheelPointer=null;wheelSteer=0;}}
$('wheelZone').addEventListener('pointerup',releaseWheel);$('wheelZone').addEventListener('pointercancel',releaseWheel);$('wheelZone').addEventListener('lostpointercapture',releaseWheel);
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.repeat)return;keys.add(e.key.toLowerCase());if(e.key==='Escape')window.sainiBack();if(e.key.toLowerCase()==='c'&&view==='playing')changeCamera();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function changeCamera(){cameraMode=(cameraMode+1)%3;world.resetCamera=true;notify(['CHASE CAMERA','HIGH CHASE CAMERA','BONNET CAMERA'][cameraMode],1.4);}
$('camera').onclick=changeCamera;$('pause').onclick=pause;$('resume').onclick=resume;$('start').onclick=startDrive;$('again').onclick=startDrive;$('restart').onclick=startDrive;$('quit').onclick=goHome;$('resultHome').onclick=goHome;
$('settingsOpen').onclick=openSettings;$('pauseSettings').onclick=openSettings;$('settingsClose').onclick=closeSettings;$('calibrate').onclick=()=>{tiltZero=tiltValue;notify('STEERING CENTRED');};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('selected',el===b));});
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{settings.color=b.dataset.color;settingsUI();persist();});
for(const id of ['steeringMode','sensitivity','autoGas','sound','haptics','quality','daylight'])$(id).addEventListener('change',async e=>{
 settings[id]=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?Number(e.target.value):e.target.value;
 if(id==='steeringMode'&&settings.steeringMode==='tilt'){
  if(!window.SainiNative&&typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission){try{const permission=await DeviceOrientationEvent.requestPermission();tiltAvailable=permission==='granted';}catch{}}
  if(!tiltAvailable){settings.steeringMode='wheel';document.querySelector('.settings-help').textContent='Tilt is unavailable on this device. Use the touch wheel or arrow buttons.';}
  tiltZero=tiltValue;
 }
 settingsUI();persist();if(settings.sound&&view==='playing')audio.start();
});
function readInput(){
 const digital=(held.has('right')||keys.has('d')||keys.has('arrowright')?1:0)-(held.has('left')||keys.has('a')||keys.has('arrowleft')?1:0);
 input.steer=clamp((digital||(settings.steeringMode==='tilt'?tiltValue-tiltZero:wheelSteer))*settings.sensitivity,-1,1);
 input.brake=held.has('brake')||keys.has('s')||keys.has('arrowdown');
 input.gas=settings.autoGas||held.has('gas')||keys.has('w')||keys.has('arrowup');
 input.boost=held.has('boost')||keys.has(' ');drive.braking=input.brake;
}
let lastHud=0;
function hud(now){
 if(now-lastHud<50)return;lastHud=now;
 const speed=Math.round(drive.speed*3.6);$('speed').textContent=speed;$('distance').innerHTML=`${(drive.distance/1000).toFixed(2)}<small> KM</small>`;
 $('gear').textContent=speed<2?'N':Math.min(6,1+Math.floor(speed/36));$('score').textContent=Math.floor(drive.score).toLocaleString();$('rpm').style.width=`${Math.min(100,drive.speed/54*100)}%`;$('nitroFill').style.width=`${drive.nitro}%`;
 $('wheel').style.transform=`rotate(${drive.steer*95}deg)`;$('speedLines').style.opacity=drive.boosting?'1':'0';$('flash').style.opacity=drive.impact>.9?(drive.impact-.9)*.5:'0';$('hint').style.opacity=drive.elapsed<9?'1':'0';
 if(time>toastUntil){$('notice').textContent=Math.abs(drive.lateral)>5.1?'OFF ROAD · EASE BACK ON':'';}
 if(mode==='sprint'){const t=Math.ceil(drive.remaining);$('time').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;$('time').style.color=t<20?'#ffc087':'#fff';$('progress').style.width=`${Math.min(100,drive.distance/30)}%`;}
 const c=$('minimap').getContext('2d');c.clearRect(0,0,140,140);const r=route(drive.s);c.beginPath();
 for(let i=-30;i<360;i+=5){const p=route(drive.s+i),x=70+(p.x-r.x-r.dx*i)*.38,y=113-i*.27;if(i===-30)c.moveTo(x,y);else c.lineTo(x,y);}
 c.strokeStyle='#e2efdd44';c.lineWidth=13;c.lineCap='round';c.stroke();c.strokeStyle='#c7ec9e';c.lineWidth=2;c.stroke();c.fillStyle='#fff';c.beginPath();c.moveTo(70+drive.lateral*.4,105);c.lineTo(65+drive.lateral*.4,117);c.lineTo(75+drive.lateral*.4,117);c.fill();
}
function frame(now){
 const dt=Math.min(.05,(now-(last||now))/1000);last=now;time+=dt;
 if(view==='playing'){
  readInput();accumulator+=dt;while(accumulator>=1/60){tick(drive,input,1/60);accumulator-=1/60;}
 }
 world.update(drive,view==='playing'?dt:0,time,{menu:view==='home',cameraMode,onCollision:()=>{if(view==='playing'&&impact(drive)){notify(mode==='sprint'?`COLLISION · ${drive.health}% CAR HEALTH`:'WATCH THE TRAFFIC',1.5);vibrate(80);audio.crash();}},onPass:()=>{if(view==='playing'&&drive.impact<=0){drive.score+=150;drive.combo++;notify(`CLEAN PASS +150`,1.2);vibrate(12);}}});
 if(view==='playing'){hud(now);if(drive.finished)finish();}
 audio.update();world.render();requestAnimationFrame(frame);
}
try{
 world=new World($('game'),settings.quality);settingsUI();world.update(drive,0,0,{menu:true});world.render();
 requestAnimationFrame(frame);
 setTimeout(()=>{$('splash').style.opacity='0';show('home');setTimeout(()=>show('splash',false),650);},1900);
 // Read-only diagnostics for automated browser smoke tests.
 Object.defineProperty(window,'sainiDebug',{get:()=>({view,state:{...drive},input:{...input},cameraMode,quality:settings.quality,calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,geometryCount:world.renderer.info.memory.geometries})});
}catch(e){console.error(e);show('splash',false);show('error');$('errorText').textContent='The 3D renderer could not start. Update Android System WebView, then reopen Saini Drive.';}
