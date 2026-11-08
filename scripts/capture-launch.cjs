// Capture the existing cockpit with its saved, redacted local-job projection.
// This is build-time recording only. The launch page never requests replay data.
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const replay = require('../web/fixtures/replay.local-job.json');
(async () => {
  const dir = path.resolve('launch/dist/assets');
  await fs.mkdir(dir, {recursive:true});
  const browser = await chromium.launch({channel:'chrome', headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000}, deviceScaleFactor:1});
  const page = await context.newPage();
  await page.route('**/api/replay', route => route.fulfill({json:{replay}}));
  await page.goto(process.env.LIFERAFT_CAPTURE_URL || 'http://127.0.0.1:3001', {waitUntil:'networkidle',timeout:45000});
  await page.getByRole('button',{name:'Explore recovery proof',exact:true}).waitFor();
  await page.screenshot({path:path.join(dir,'cockpit.png')});
  for (const [name,file] of [['Explore workers and handoff','topology'],['Explore recovery proof','proof'],['Explore the handoff brief and investigation','brief']]) {
    await page.getByRole('button',{name,exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(600);
    await page.getByRole('dialog').screenshot({path:path.join(dir,file+'.png')});
    await page.keyboard.press('Escape');
  }
  // Ten seconds of actual cockpit interaction, sampled at 10 fps for encoding.
  const frames = path.resolve('.liferaft/launch-frames');
  await fs.mkdir(frames,{recursive:true});
  const indices = replay.events.map((e,i)=>({e,i})).filter(({e})=>['SENSOR_EVENT_RECEIVED','RESCUE_REQUESTED','CHECKPOINT_COMMITTED','LEASE_TRANSFERRED','FIRST_RESUMED_STEP_COMPLETED','JOB_COMPLETED'].includes(e.kind)).map(({i})=>i);
  for(let n=0;n<100;n++) {
    const cursor = indices[Math.min(indices.length-1,Math.floor(n*indices.length/100))];
    if(n===0 || Math.floor(n*indices.length/100)!==Math.floor((n-1)*indices.length/100)) {
      await page.getByRole('slider').fill(String(cursor));
      await page.waitForTimeout(100);
    }
    await page.screenshot({path:path.join(frames,`frame-${String(n).padStart(3,'0')}.png`)});
  }
  await browser.close();
  console.log(JSON.stringify({screenshots:4,frames:100,fixture:replay.job,events:replay.events.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
