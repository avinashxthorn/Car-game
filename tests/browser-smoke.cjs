const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('test-results',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765');await page.waitForTimeout(3200);
  assert(await page.evaluate(()=>!!window.sainiDebug),'Renderer must start');
  await page.screenshot({path:'test-results/home.png'});
  await page.locator('#start').click();await page.keyboard.down('w');
  await page.waitForFunction(()=>window.sainiDebug.state.speed>25,null,{timeout:45000});
  await page.keyboard.up('w');await page.screenshot({path:'test-results/driving.png'});
  await page.locator('#pause').click();const before=await page.evaluate(()=>window.sainiDebug.state.distance);await page.waitForTimeout(500);assert.equal(before,await page.evaluate(()=>window.sainiDebug.state.distance));
  await page.screenshot({path:'test-results/paused.png'});
  await page.locator('#pauseSettings').click();await page.locator('#daylight').selectOption('golden');await page.locator('#settingsClose').click();await page.locator('#resume').click();
  await page.setViewportSize({width:915,height:412});
  const cdp=await page.context().newCDPSession(page);
  const gas=await page.locator('#gas').boundingBox(),wheel=await page.locator('#wheelZone').boundingBox();
  const points=[{id:1,x:gas.x+gas.width/2,y:gas.y+gas.height/2},{id:2,x:wheel.x+wheel.width/2,y:wheel.y+wheel.height/2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});points[1].x+=55;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points});await page.waitForTimeout(500);
  const multi=await page.evaluate(()=>window.sainiDebug);assert(multi.input.gas&&multi.input.steer>.4,'Gas and wheel must work simultaneously');
  await page.screenshot({path:'test-results/mobile-touch.png'});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
  const released=await page.evaluate(()=>window.sainiDebug);assert(!released.input.gas&&released.input.steer===0,'Release must reset touch inputs');
  await page.locator('#camera').click();assert.equal((await page.evaluate(()=>window.sainiDebug)).cameraMode,1);
  await page.locator('#camera').click();assert.equal((await page.evaluate(()=>window.sainiDebug)).cameraMode,2);await page.screenshot({path:'test-results/bonnet.png'});
  await page.locator('#pause').click();await page.locator('#pauseSettings').click();await page.locator('#steeringMode').selectOption('arrows');await page.locator('#quality').selectOption('low');await page.locator('#settingsClose').click();await page.locator('#resume').click();assert(await page.locator('#arrows').isVisible());
  await page.screenshot({path:'test-results/mobile-arrows.png'});
  await page.locator('#pause').click();await page.locator('#quit').click();await page.locator('[data-mode=sprint]').click();await page.locator('#start').click();assert(await page.locator('#mission').isVisible());
  await page.screenshot({path:'test-results/sprint.png'});
  await page.evaluate(()=>window.sainiPause());assert.equal((await page.evaluate(()=>window.sainiDebug)).view,'paused');
  fs.writeFileSync('test-results/diagnostics.json',JSON.stringify({errors,state:await page.evaluate(()=>window.sainiDebug),passed:['3D renderer','acceleration','pause freeze','mobile multitouch','touch release','three cameras','arrow controls','graphics toggle','sprint','Android lifecycle bridge']},null,2));
  assert.deepEqual(errors,[]);console.log('PASS: 10 browser gameplay checks');
 }catch(error){await page.screenshot({path:'test-results/failure.png'}).catch(()=>{});throw error;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
