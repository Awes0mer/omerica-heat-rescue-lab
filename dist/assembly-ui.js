import { mountAssembly } from './assembly-scene.js';
import { telemetry } from './telemetry-bootstrap.mjs';
import { PARAMS } from './model.js';
import { DEMO_INTERVAL_MS, DEMO_STEPS, createDemoState, transitionDemo } from './assembly-demo.js';

const $ = id => document.getElementById(id);
const describe = {
  overview: ['The cooling path','Heat crosses the generator tiles into the cold plate. Water carries most of it away.'],
  load: ['Electrical load','Each generator feeds an ideal matched electrical load. The pulse brightness represents simulated output; conversion electronics are not modeled.'],
  board: ['Circuit board','The board is illustrative geometry. Its component temperatures and electrical signals are not separately modeled.'],
  server: ['Server chassis','A powered server supplies heat continuously. Blocking its cooling pipe does not turn that heat off.'],
  processor: ['Processor & hot plate','This is a visual representation of the modeled hot plate. Internal CPU hotspots are not resolved.'],
  hotplate: ['Copper hot plate','Heat passes toward the cooler side through the generator tiles and a parallel metal path.'],
  teg: ['Thermoelectric generator','A temperature difference creates a voltage. Only a small portion of the heat becomes electricity.'],
  coldplate: ['Water-cooled plate','Water cools this side of the generator. Block the branch and the trapped water begins to warm.'],
  pipe: ['Cooling branch','Close this valve to remove main flow in one branch. The other branches retain their assumed flow.'],
  pump: ['Backup pump','The independent backup path restores some flow, with its electrical cost included in the calculation.'],
};
function dispatch(type,index){window.dispatchEvent(new CustomEvent('heat-scene-action',{detail:{type,index}}));}
function action(type,fields={}){window.dispatchEvent(new CustomEvent('heat-scene-action',{detail:{type,...fields}}));}
let manualScene, aiScene, selected=1, latest=null;
let exploded=0, thermal=false, globalInspection=false, component='overview', aiPlacement=null;
let demo=createDemoState(), demoTimer=null, demoPauseNote='', labelsVisible=true, labelsBeforeDemo=true;
const lockedControls=new Map();
const host=$('assembly-canvas');
function inspectPart({index=selected,component:nextComponent,label}) {
  component=describe[nextComponent]?nextComponent:'overview';
  if(component==='pump'||component==='load')index=null;
  globalInspection=index===null;
  $('assembly-part-index').textContent=globalInspection?'Shared component':'Branch '+'ABC'[index];
  const item=describe[component]??[label??'Cooling assembly','Inspect the components, then close a valve to test the simulated cooling path.'];
  $('assembly-part-name').textContent=item[0];$('assembly-part-description').textContent=item[1];
  if(describe[component])$('assembly-inspect').value=component;
  updateComponentReadings();
}
function showFallback() {
  telemetry.capture('renderer_fallback', { reason: 'webgl_unavailable' });
  host.closest('.scene-wrap').classList.add('assembly-failed');
  $('assembly-loading').hidden=false;
  $('assembly-loading').textContent='3D is unavailable here. The interactive schematic below uses the same simulation.';
}

try {
  manualScene=mountAssembly(host,{
    onSelect(index){pauseDemo();selected=index;dispatch('select',index);},
    onTogglePipe(index){if(!demo.active)dispatch('pipe',index);},
    onInspect(part){pauseDemo();inspectPart(part);}
  });
  if(manualScene.available)$('assembly-loading').hidden=true;
  else showFallback();
} catch(error) {
  showFallback();
  telemetry.captureError(error, 'renderer_init');
  console.warn('Assembly view unavailable:',error);
}
try {aiScene=mountAssembly($('ai-assembly-canvas'),{});aiScene.setDesign?.({counts:[2,2,2]});if(!aiScene.available)$('ai-assembly-canvas').hidden=true;}
catch(error){$('ai-assembly-canvas').hidden=true;telemetry.captureError(error,'renderer_init');console.warn('AI assembly view unavailable:',error);}

window.addEventListener('heat-snapshot',({detail:s})=>{
  latest=s;selected=s.selected??selected;
  $('assembly-branch').value=String(selected);
  if(!globalInspection)$('assembly-part-index').textContent='Branch '+'ABC'[selected];
  manualScene?.setSnapshot(s,selected);
  updateComponentReadings();
  updateLayoutControls();
  const fault=s.branches.find(b=>b.blocked);
  $('assembly-scene-status').textContent=fault?`Pipe ${'ABC'[fault.id]} closed${fault.backupActive?' · backup flowing':''}`:'Coolant flowing';
  document.querySelector('.assembly-state-pill').classList.toggle('fault',!!fault);
  for(const b of document.querySelectorAll('[data-mobile-pipe]')){
    const closed=!!s.branches[Number(b.dataset.mobilePipe)].blocked;
    b.classList.toggle('active',closed);b.setAttribute('aria-pressed',String(closed));
  }
});
window.addEventListener('heat-ai-design',({detail})=>{
  aiScene?.setDesign?.(detail.design);
  if(detail.label==='AI’S SELECTED DESIGN' && detail.design?.counts?.length===3){
    aiPlacement=[...detail.design.counts];
    $('assembly-ai-layout').disabled=demo.active;
    $('assembly-ai-layout').textContent=`Use AI tiles ${aiPlacement.join(' / ')}`;
  }
});
window.addEventListener('heat-ai-start',()=>{
  aiPlacement=null;$('assembly-ai-layout').disabled=true;
  $('assembly-ai-layout').textContent='Run AI to use its tiles';
});

window.addEventListener('heat-mode',()=>{pauseDemo('Paused after switching views.');manualScene?.resize();aiScene?.resize();});
function separateLayers(amount){
  exploded=Math.max(0,Math.min(1,amount));manualScene?.setExploded(exploded);
  $('assembly-explode').setAttribute('aria-pressed',String(exploded>0));
  $('assembly-explode').innerHTML=exploded>0?'<span>⊞</span> Reassemble':'<span>⊞</span> Explode assembly';
  $('assembly-separation').value=String(Math.round(exploded*100));
  $('assembly-separation-value').value=`${Math.round(exploded*100)}%`;
}
$('assembly-explode').addEventListener('click',()=>{pauseDemo();separateLayers(exploded>0?0:1);});
$('assembly-separation').addEventListener('input',event=>{pauseDemo();separateLayers(Number(event.target.value)/100);});
function setThermal(value){
  thermal=Boolean(value);manualScene?.setThermal(thermal);$('assembly-thermal').setAttribute('aria-pressed',String(thermal));
  $('assembly-thermal').setAttribute('aria-label',thermal?'Turn off simulated temperature colors':'Show simulated temperature colors');
}
$('assembly-thermal').addEventListener('click',()=>{pauseDemo();setThermal(!thermal);});
function setLabels(value){
  labelsVisible=Boolean(value);manualScene?.setLabelsVisible?.(labelsVisible);
  $('assembly-labels').setAttribute('aria-pressed',String(labelsVisible));
  $('assembly-labels').setAttribute('aria-label',labelsVisible?'Hide floating assembly labels':'Show floating assembly labels');
}
$('assembly-labels').addEventListener('click',()=>{pauseDemo();setLabels(!labelsVisible);});
function setCamera(view){
  manualScene?.setView(view);
  for(const button of document.querySelectorAll('[data-camera]')){const active=button.dataset.camera===view;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}
}
for(const button of document.querySelectorAll('[data-camera]'))button.addEventListener('click',()=>{pauseDemo();setCamera(button.dataset.camera);});
$('assembly-inspect').addEventListener('change',event=>{pauseDemo();inspectPart({component:event.target.value});manualScene?.focusPart?.({component:event.target.value,index:selected});});
$('assembly-branch').addEventListener('change',event=>{pauseDemo();selected=Number(event.target.value);dispatch('select',selected);inspectPart({component:$('assembly-inspect').value});manualScene?.focusPart?.({component,index:selected});});
const lab=host.closest('.lab');
$('assembly-expand').addEventListener('click',async()=>{
  try {if(document.fullscreenElement)await document.exitFullscreen();else await lab.requestFullscreen();}
  catch(error){$('assembly-expand').textContent='Use browser full screen';console.warn('Full screen unavailable:',error);}
});
document.addEventListener('fullscreenchange',()=>{
  const expanded=document.fullscreenElement===lab;
  $('assembly-expand').textContent=expanded?'Exit full screen':'Expand';
  $('assembly-expand').setAttribute('aria-pressed',String(expanded));
  manualScene?.resize();
});
window.addEventListener('pagehide',event=>{pauseDemo('Paused when leaving this page.');if(!event.persisted){manualScene?.dispose();aiScene?.dispose();}});

function updateComponentReadings(){
  if(!latest)return;
  const b=latest.branches[selected],fmt=(v,n=2)=>Number(v).toFixed(n);
  let values;
  switch(component){
    case 'pipe':values=['Main flow',`${fmt(b.blocked?0:PARAMS.flowKgS,3)} kg/s`,'Backup flow',`${fmt(b.backupActive?PARAMS.backupFlowKgS:0,3)} kg/s`];break;
    case 'pump':values=['Backup draw',`${fmt(latest.backupPumpW)} W`,'Supplying branches',String(latest.branches.filter(branch=>branch.backupActive).length)];break;
    case 'load':values=['Generated',`${fmt(latest.totalPowerW)} W`,'After extra pumping',`${fmt(latest.netRecoveryW)} W`];break;
    case 'coldplate':values=['Cold plate',`${fmt(b.coldC,1)}°C`,'Water',`${fmt(b.waterC,1)}°C`];break;
    case 'teg':values=['Tiles here',String(b.count),'Branch generation',`${fmt(b.powerW,3)} W`];break;
    case 'server':case 'board':case 'processor':case 'hotplate':values=['Modeled hot plate',`${fmt(b.hotC,1)}°C`,'Assumed heat input',`${PARAMS.serverHeatW} W`];break;
    default:values=['Hot plate',`${fmt(b.hotC,1)}°C`,'Cold plate',`${fmt(b.coldC,1)}°C`];
  }
  ['component-label-one','component-value-one','component-label-two','component-value-two'].forEach((id,i)=>$(id).textContent=values[i]);
}
function updateLayoutControls(){
  if(!latest)return;
  const counts=latest.counts??latest.branches.map(b=>b.count);
  $('assembly-allocation').textContent=counts.map((n,i)=>`${'ABC'[i]} ${n}`).join(' / ');
  const from=Number($('assembly-from').value),to=Number($('assembly-to').value);
  $('assembly-move').disabled=demo.active||from===to||counts[from]===0;
  $('assembly-balance').disabled=demo.active||counts.every(n=>n===2);
  $('assembly-ai-layout').disabled=demo.active||!aiPlacement;
  if(demo.active)setManualLock(true);
}
$('assembly-from').addEventListener('change',updateLayoutControls);
$('assembly-to').addEventListener('change',updateLayoutControls);
$('assembly-move').addEventListener('click',()=>action('move-tile',{from:Number($('assembly-from').value),to:Number($('assembly-to').value)}));
$('assembly-balance').addEventListener('click',()=>action('balance-tiles'));
$('assembly-ai-layout').addEventListener('click',()=>{if(aiPlacement)action('apply-ai-layout',{counts:aiPlacement});});
$('assembly-export').addEventListener('click',()=>action('export-assembly',{metadata:{layerSeparation:exploded,thermalColors:thermal,labelsVisible,inspectedComponent:component,guidedDemo:demo.active?{step:demo.index+1,id:DEMO_STEPS[demo.index].id,scenario:DEMO_STEPS[demo.index].scenario}:null}}));
window.addEventListener('heat-scene-action-result',({detail})=>{
  if(detail.reset){
    $('assembly-workshop-status').textContent=`Tiles ${detail.counts.join(' / ')}. New run at equilibrium; all pipes open.${detail.type==='apply-ai-layout'?' AI tile placement copied; benchmark loads and backup policy were not copied.':''}`;
  }else if(detail.message){
    $('assembly-workshop-status').textContent=detail.message;
  }else if(detail.type==='export-assembly'&&detail.ok){
    $('assembly-workshop-status').textContent='Exported the simulated state, six-tile allocation, assumptions and display settings.';
  }
});

const initialDemoCopy=Object.fromEntries(['title','explanation','look','limit'].map(key=>[key,$('assembly-demo-'+key).textContent]));
function setManualLock(active){
  const selector='#pause,#reset,#speed,#main-action,#backup,[data-mobile-pipe],[data-counts],#assembly-from,#assembly-to,#assembly-move,#assembly-balance,#assembly-ai-layout,#optimize,.apply-best';
  if(active){
    for(const control of document.querySelectorAll(selector)){
      if(!lockedControls.has(control))lockedControls.set(control,control.disabled);
      control.disabled=true;
    }
  }else{
    for(const [control,disabled] of lockedControls)control.disabled=disabled;
    lockedControls.clear();
    // A layout worker may have finished while the guide was open.
    $('optimize').disabled=$('optimize').textContent.startsWith('Testing');
  }
  lab.classList.toggle('demo-active',active);
}
function renderDemoControls(){
  const last=DEMO_STEPS.length-1;
  $('assembly-demo-start').disabled=demo.active;
  $('assembly-demo-previous').disabled=!demo.active||demo.index===0;
  $('assembly-demo-next').disabled=!demo.active||demo.index===last;
  $('assembly-demo-play').disabled=!demo.active||demo.playing||demo.index===last;
  $('assembly-demo-pause').disabled=!demo.active||!demo.playing;
  $('assembly-demo-end').disabled=!demo.active;
  if(demo.active){
    const step=DEMO_STEPS[demo.index];
    const status=demo.index===last?'Final step — choose Previous or End demo':demo.playing?'Autoplay: 12 seconds per step':demoPauseNote||'Paused — use Next or Play';
    $('assembly-demo-progress').textContent=`${demo.index+1} / ${DEMO_STEPS.length} · ${step.title} · ${status}`;
  }else{
    $('assembly-demo-progress').textContent=`${DEMO_STEPS.length} steps · Start resets the teaching run · Optional autoplay: 12 seconds per step`;
  }
}
function showDemoStep(){
  const step=DEMO_STEPS[demo.index];
  selected=1;
  action('demo-step',{scenario:step.scenario,seconds:step.seconds});
  separateLayers(step.separation);
  setThermal(step.thermal);
  setCamera(step.camera);
  manualScene?.focusPart?.({component:step.component,index:1});
  inspectPart({component:step.component,index:1});
  $('assembly-demo-title').textContent=`${demo.index+1} / ${DEMO_STEPS.length} · ${step.title}`;
  $('assembly-demo-explanation').textContent=step.explanation;
  $('assembly-demo-look').textContent=step.lookFor;
  $('assembly-demo-limit').textContent=step.limit;
  $('assembly-workshop-status').textContent='Guided example: the six-tile layout and thermal state are fixed for this step. End demo to change the experiment.';
  renderDemoControls();
}
function scheduleDemo(){
  clearTimeout(demoTimer);demoTimer=null;
  if(!demo.active||!demo.playing||document.hidden||$('manual-view').hidden)return;
  demoTimer=setTimeout(()=>{
    if(document.hidden||$('manual-view').hidden){pauseDemo('Paused while this view was hidden.');return;}
    demo=transitionDemo(demo,'tick');
    showDemoStep();
    scheduleDemo();
  },DEMO_INTERVAL_MS);
}
function pauseDemo(note='Paused after a view adjustment.'){
  if(!demo.active)return;
  const wasPlaying=demo.playing;
  demo=transitionDemo(demo,'pause');
  if(wasPlaying)demoPauseNote=note;
  clearTimeout(demoTimer);demoTimer=null;
  renderDemoControls();
}
$('assembly-demo-start').addEventListener('click',()=>{
  labelsBeforeDemo=labelsVisible;
  demo=transitionDemo(demo,'start');demoPauseNote='';
  setManualLock(true);setLabels(false);
  if(window.matchMedia('(min-width:761px)').matches)$('assembly-demo-details').open=true;
  showDemoStep();
});
for(const name of ['previous','next'])$('assembly-demo-'+name).addEventListener('click',()=>{
  clearTimeout(demoTimer);demoTimer=null;
  demo=transitionDemo(demo,name);demoPauseNote='';showDemoStep();
});
$('assembly-demo-play').addEventListener('click',()=>{
  demo=transitionDemo(demo,'play');demoPauseNote='';renderDemoControls();scheduleDemo();
});
$('assembly-demo-pause').addEventListener('click',()=>pauseDemo('Paused.'));
$('assembly-demo-end').addEventListener('click',()=>{
  clearTimeout(demoTimer);demoTimer=null;
  demo=transitionDemo(demo,'end');demoPauseNote='';
  setManualLock(false);
  separateLayers(0);setThermal(false);setLabels(labelsBeforeDemo);setCamera('orbit');
  manualScene?.focusPart?.({component:'overview',index:1});
  action('demo-end');
  inspectPart({component:'overview',index:1});
  for(const [key,value] of Object.entries(initialDemoCopy))$('assembly-demo-'+key).textContent=value;
  $('assembly-workshop-status').textContent='Fresh teaching run: six tiles, all pipes open. You can change the layout or block a pipe.';
  renderDemoControls();updateLayoutControls();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseDemo('Paused while this tab was hidden.');});
for(const event of ['pointerdown','wheel','keydown'])host.addEventListener(event,()=>pauseDemo(),{passive:true});
renderDemoControls();
action('request-snapshot');
