const {chromium} = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const results=[];
  for(const width of [1440,768,390,320]){
    const context=await browser.newContext({viewport:{width,height:1000}});
    const page=await context.newPage();
    const errors=[]; const requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>requests.push(r.url()));
    await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
    await page.locator('#rescue-video').evaluate(v=>v.play());
    const media=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,ready:v.readyState}));
    assert(Math.abs(media.duration-10)<.2,JSON.stringify(media));
    assert(media.width>0);
    assert.equal(await page.locator('h1').textContent(),'Trainingsurvived.');
    assert.equal(await page.locator('.section').count(),6);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow');
    assert(!requests.some(u=>u.includes('/api/')||u.includes('3001')),'public page requests private API');
    assert.equal(await page.locator('iframe').count(),0);
    await page.getByRole('button',{name:'Pause recorded replay'}).click();
    assert(await page.locator('video').evaluate(v=>v.paused));
    const axe=await new AxeBuilder({page}).analyze();
    assert.equal(axe.violations.filter(v=>['critical','serious'].includes(v.impact)).length,0,JSON.stringify(axe.violations));
    for (const img of await page.locator('figure img').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(el=>el.decode());
    }
    await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});
    await page.screenshot({path:`.liferaft/launch-${width}.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    results.push({width,media,axeViolations:axe.violations.length,errors});
    await context.close();
  }
  const page=await browser.newPage({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
  assert(await page.locator('video').evaluate(v=>v.paused),'reduced motion autoplays');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Skip to content');
  await fs.writeFile('.liferaft/launch-qa.json',JSON.stringify({results,reducedMotion:true,keyboardSkip:true},null,2));
  console.log(JSON.stringify({viewports:results.length,videoSeconds:10,reducedMotion:true,keyboardSkip:true,privateRequests:0}));
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
