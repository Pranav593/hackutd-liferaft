// Run with the bundled runtime; LIFERAFT_NODE_MODULES points to its packages.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const build=path.join(root,'.liferaft/slides-build');
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(process.env.LIFERAFT_NODE_MODULES,'@oai/artifact-tool/dist/artifact_tool.mjs')));
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={bg:'#060B16',ink:'#EAF0FB',muted:'#AEBBD3',teal:'#5FF0D6',amber:'#FFB84D'};
function text(s,t,x,y,w,h,size=40,color=C.ink,font='Arial',italic=false){
 const sh=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 sh.text=t;sh.text.style={fontSize:size,typeface:font,color,italic,insets:0,verticalAlignment:'middle',wrap:'none'};return sh;
}
function slide(notes){const s=p.slides.add();s.background.fill=C.bg;s.speakerNotes.text=notes;return s;}
async function image(s,file,x,y,w,h,alt){const b=await fs.readFile(file);s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',alt,fit:'contain',position:{left:x,top:y,width:w,height:h}});}
const noteSource='Source: team launch-kit brief; LIFERAFT_MASTER_SPEC.md; INTEGRATION_CONTRACTS.md; docs/COCKPIT_PLAN.md. Maya is fictional; no customer relationship is claimed.';
let s=slide('00:00–00:15 (15 s). “Maya’s phone lights up. Eleven days of training are on that machine.” Pause. This is a scenario, not a customer claim. '+noteSource);
s.background.fill='#000000';
text(s,'3:07 a.m.',92,190,1100,170,142,C.amber,'Arial');
text(s,'Rack 7. Thermal alarm.',102,390,1050,72,44);
text(s,'A SCENARIO',104,610,600,30,18,C.muted);
s=slide('00:15–00:27 (12 s). “Stalled. Lost. Unclear. The handoff is a Slack thread and a prayer.” '+noteSource);
text(s,'Stalled.',92,125,1100,120,100,C.ink);text(s,'Lost.',92,290,1100,120,100,C.amber);text(s,'Unclear.',92,455,1100,120,100,C.muted);
s=slide('00:27–00:44 (17 s). “Meet LIFERAFT: compute continuity for AI infrastructure. A lifeboat for compute. It saves, hands off, and proves it.” We support checkpoint-aware training, not arbitrary running-process migration. '+noteSource);
await image(s,path.join(build,'patch.png'),85,95,150,150,'Original LIFERAFT mission patch');
text(s,'LIFERAFT',275,105,900,100,84);text(s,'Compute continuity for AI infrastructure.',280,216,910,60,32,C.muted);
// Explicitly requested editable two-machine continuity diagram.
text(s,'PRIMARY',138,420,290,55,28,C.muted);text(s,'STANDBY',870,420,290,55,28,C.teal);
text(s,'▱',152,340,260,90,90,C.ink);text(s,'▱',888,340,260,90,90,C.teal);
s.shapes.add({geometry:'line',position:{left:365,top:404,width:500,height:0},line:{fill:C.teal,width:2}});
text(s,'ONE CONTINUOUS JOB',450,455,430,40,18,C.teal);
s=slide('00:44–01:02 (18 s). “Detect. Save. Hand off. Prove. A verified checkpoint, an ownership transfer with fencing, and a measured first step on the new machine.” The coordinator alone owns the transitions. The pull cord injects a drill; it does not cause real overheating. '+noteSource);
text(s,'Four beats',84,80,1100,90,60);
const beats=[['01','Detect','INJECTED SIGNAL'],['02','Save','VERIFIED CHECKPOINT'],['03','Hand off','FENCED OWNERSHIP'],['04','Prove','MEASURED NEXT STEP']];
for(let i=0;i<4;i++){let x=84+i*302;text(s,beats[i][0],x,270,220,40,22,i?C.teal:C.amber);text(s,beats[i][1],x,338,270,75,48,i?C.ink:C.amber);text(s,beats[i][2],x,446,270,34,17,C.muted);if(i<3)text(s,'→',x+232,340,65,70,38,C.teal);}
s=slide('01:02–01:10 (8 s), then pause the deck for the demo. “The button is the pull cord. You are the operator. This is mission control. Rather than tell you, let’s pull it.” Cut to the actual on-site demo. Only call it Live while running the actual drill. If using the saved recording, change Live to Recorded replay before presenting. No power interruption or overheating. Photo: team-owned frame .liferaft/video-review/video-2-49.png, ESP32 hardware. '+noteSource);
await image(s,path.join(root,'launch/dist/assets/esp32.png'),200,30,500,660,'Actual team ESP32 board photographed on the desk');
text(s,'Live.',790,295,390,120,90,C.teal);
s=slide('01:10–01:28 after the demo (18 s). “Fenced ownership. A tamper-evident Flight Recorder. Read-only Nemotron. The AI explains. It never decides.” Hash linking detects edits; legacy exports without a trusted head remain unanchored. Do not call the recorder tamper-proof. '+noteSource);
text(s,'Why operators trust it',84,76,1120,90,60);
for(const [i,glyph,title,detail] of [[0,'⊣','Fenced ownership','One accepted owner per epoch.'],[1,'≋','Flight Recorder','Tamper-evident, hash-linked events.'],[2,'◇','Read-only Nemotron','Advisory tools. No recovery authority.']]){let x=84+i*398;text(s,glyph,x,257,290,100,82,C.teal);text(s,title,x,395,370,60,30);text(s,detail,x,475,370,70,21,C.muted);}
s=slide('01:28–01:42 (14 s). “For the NOC engineer: is it handled? For the ML engineer: did the same training state resume? For the fleet manager: can I trust the record?” Personas describe intended users, not existing customers. '+noteSource);
text(s,'Who it’s for',84,76,1100,90,60);
const roles=[['NOC engineer','Is it handled?'],['ML engineer','Did the training state resume?'],['Fleet manager','Can I trust the record?']];
roles.forEach((r,i)=>{let y=244+i*130;text(s,r[0],84,y,470,70,42);text(s,r[1],605,y,600,70,32,C.teal);});
s=slide('01:42–01:55 (13 s). “Next, not now. Fleet Lifeboat Score, multi-rack standby pools, edge nodes, and on-call channels.” These are roadmap intentions; do not represent them as currently shipped fleet capabilities. '+noteSource);
text(s,'NEXT',84,72,1000,50,26,C.amber);text(s,'Roadmap',84,150,1100,95,64);
['Fleet Lifeboat Score','Multi-rack standby pools','Edge nodes','On-call channels'].forEach((t,i)=>text(s,t,88,292+i*76,1100,60,38,i===0?C.teal:C.ink));
s=slide('01:55–02:00 (5 s). Say: “Training survived.” Then stop talking. The QR encodes http://127.0.0.1:4173 because the user requested local-only delivery. It opens only on the same computer, not a phone. Replace this QR with the verified public launch-page URL after publication is approved. Do not weaken the local cockpit Host restriction. '+noteSource);
text(s,'Training',84,220,900,120,104);text(s,'survived.',84,338,900,145,116,C.teal,'Georgia',true);
await image(s,path.join(build,'qr.png'),980,310,210,210,'QR for the local launch preview on this computer');
text(s,'LOCAL PREVIEW',966,544,260,28,18,C.muted);text(s,'127.0.0.1:4173',964,579,290,28,18,C.muted);
await fs.mkdir(build,{recursive:true});
await (await PresentationFile.exportPptx(p)).save(path.join(build,'candidate.pptx'));
for(let i=0;i<p.slides.items.length;i++){
 try{const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(build,`slide-${i+1}.png`),new Uint8Array(await b.arrayBuffer()));}catch(e){console.error('RENDER',i+1,e.message);throw e;}
}
console.log('Draft and 9 slide renders exported');
const skill=process.env.LIFERAFT_PRESENTATIONS_SKILL;
process.env.RUNTIME_NODE_MODULES=process.env.LIFERAFT_NODE_MODULES;
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
const result=await finalizePresentation({workspaceDir:root,candidatePath:path.join(build,'candidate.pptx'),finalPath:path.join(root,'launch/presentation/liferaft-launch.pptx'),pythonExecutable:process.env.LIFERAFT_RUNTIME_PYTHON,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],explicitTotalSlideCount:9,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['Arial','Georgia']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
console.log(JSON.stringify(result));
// Some runtime validators leave process.exitCode set after successful recovery.
// Only normalize it after the complete finalization receipt has been returned.
if(result.firstPartyImport?.passed && result.packageIntegrity?.status==='pass' && result.presentationLayout?.findingCount===0) process.exitCode=0;
