const {spawn} = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const {once} = require('node:events');
const sharp = require('sharp');
(async()=>{
  const encoder=path.join(process.env.LOCALAPPDATA,'ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');
  const child=spawn(encoder,['-hide_banner','-y','-f','image2pipe','-vcodec','mjpeg','-framerate','10','-i','pipe:0','-t','10','-c:v','libvpx','-b:v','1200k','-pix_fmt','yuv420p','-an','launch/dist/assets/rescue.webm'],{stdio:['pipe','ignore','inherit']});
  for(let i=0;i<100;i++) if(!child.stdin.write(await sharp(`.liferaft/launch-frames/frame-${String(i).padStart(3,'0')}.png`).jpeg({quality:90}).toBuffer())) await once(child.stdin,'drain');
  child.stdin.end();
  const [code]=await once(child,'exit');process.exitCode=code;
})().catch(e=>{console.error(e);process.exitCode=1});
