const video = document.querySelector('#rescue-video');
const toggle = document.querySelector('#video-toggle');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
function label() { toggle.textContent = video.paused ? 'Play loop ▶' : 'Pause loop Ⅱ'; toggle.setAttribute('aria-label', video.paused ? 'Play recorded replay' : 'Pause recorded replay'); }
if (reduced.matches) { video.autoplay = false; video.pause(); }
video.addEventListener('play',label); video.addEventListener('pause',label);
toggle.addEventListener('click',async()=>{if(video.paused){try{await video.play();}catch{toggle.textContent='Recording unavailable';}}else{video.pause();}label();});
label();
// An intentionally fictional clock; never displayed as telemetry or uptime.
const clock = document.querySelector('.mission-clock time');
let seconds = 0;
if (!reduced.matches) setInterval(()=>{ seconds=(seconds+1)%60; clock.textContent=`03:07:${String(seconds).padStart(2,'0')}`; },1000);
