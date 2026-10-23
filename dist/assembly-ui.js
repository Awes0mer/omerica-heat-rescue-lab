import { mountAssembly } from './assembly-scene.js';

const $ = id => document.getElementById(id);
const describe = {
  overview: ['The cooling path','Heat crosses the generator tiles into the cold plate. Water carries most of it away.'],
  load: ['Electrical load','Each generator feeds an ideal matched electrical load. The pulse brightness represents simulated output; conversion electronics are not modeled.'],
  server: ['Server chassis','A powered server supplies heat continuously. Blocking its cooling pipe does not turn that heat off.'],
  processor: ['Processor & hot plate','This is a visual representation of the modeled hot plate. Internal CPU hotspots are not resolved.'],
  hotplate: ['Copper hot plate','Heat passes toward the cooler side through the generator tiles and a parallel metal path.'],
  teg: ['Thermoelectric generator','A temperature difference creates a voltage. Only a small portion of the heat becomes electricity.'],
  coldplate: ['Water-cooled plate','Water cools this side of the generator. Block the branch and the trapped water begins to warm.'],
  pipe: ['Cooling branch','Close this valve to remove main flow in one branch. The other branches retain their assumed flow.'],
  pump: ['Backup pump','The independent backup path restores some flow, with its electrical cost included in the calculation.'],
};
function dispatch(type,index){window.dispatchEvent(new CustomEvent('heat-scene-action',{detail:{type,index}}));}
let manualScene, aiScene, selected=1, latest=null;
let exploded=false, thermal=false, globalInspection=false;
const host=$('assembly-canvas');
function inspectPart({index=selected,component,label}) {
  if(component==='pump'||component==='load')index=null;
  globalInspection=index===null;
  $('assembly-part-index').textContent=globalInspection?'Shared component':'Branch '+'ABC'[index];
  const item=describe[component]??[label??'Cooling assembly','Inspect the components, then close a valve to test the simulated cooling path.'];
  $('assembly-part-name').textContent=item[0];$('assembly-part-description').textContent=item[1];
  if(describe[component])$('assembly-inspect').value=component;
}
function showFallback() {
  host.closest('.scene-wrap').classList.add('assembly-failed');
  $('assembly-loading').hidden=false;
  $('assembly-loading').textContent='3D is unavailable here. The interactive schematic below uses the same simulation.';
}

try {
  manualScene=mountAssembly(host,{
    onSelect(index){selected=index;dispatch('select',index);},
    onTogglePipe(index){dispatch('pipe',index);},
    onInspect:inspectPart
  });
  if(manualScene.available)$('assembly-loading').hidden=true;
  else showFallback();
} catch(error) {
  showFallback();
  console.warn('Assembly view unavailable:',error);
}
try {aiScene=mountAssembly($('ai-assembly-canvas'),{});aiScene.setDesign?.({counts:[2,2,2]});if(!aiScene.available)$('ai-assembly-canvas').hidden=true;}
catch(error){$('ai-assembly-canvas').hidden=true;console.warn('AI assembly view unavailable:',error);}

window.addEventListener('heat-snapshot',({detail:s})=>{
  latest=s;selected=s.selected??selected;
  $('assembly-branch').value=String(selected);
  if(!globalInspection)$('assembly-part-index').textContent='Branch '+'ABC'[selected];
  manualScene?.setSnapshot(s,selected);
  const fault=s.branches.find(b=>b.blocked);
  $('assembly-scene-status').textContent=fault?`Pipe ${'ABC'[fault.id]} closed${fault.backupActive?' · backup flowing':''}`:'Coolant flowing';
  document.querySelector('.assembly-state-pill').classList.toggle('fault',!!fault);
  for(const b of document.querySelectorAll('[data-mobile-pipe]')){
    const closed=!!s.branches[Number(b.dataset.mobilePipe)].blocked;
    b.classList.toggle('active',closed);b.setAttribute('aria-pressed',String(closed));
  }
});
window.addEventListener('heat-ai-design',({detail})=>aiScene?.setDesign?.(detail.design));
window.addEventListener('heat-mode',()=>{manualScene?.resize();aiScene?.resize();});
$('assembly-explode').addEventListener('click',()=>{
  exploded=!exploded;manualScene?.setExploded(exploded);
  $('assembly-explode').setAttribute('aria-pressed',String(exploded));
  $('assembly-explode').innerHTML=exploded?'<span>⊞</span> Reassemble':'<span>⊞</span> Explode assembly';
  $('assembly-part-name').textContent=exploded?'The heat path, opened':'The cooling path';
  $('assembly-part-description').textContent=exploded?'Separated for inspection: processor, copper plate, generator tiles, then the water-cooled plate. This view changes the drawing only.':'Heat crosses the generator tiles into the cold plate. Water carries most of it away.';
});
$('assembly-thermal').addEventListener('click',()=>{
  thermal=!thermal;manualScene?.setThermal(thermal);$('assembly-thermal').setAttribute('aria-pressed',String(thermal));
  if(thermal){$('assembly-part-name').textContent='Temperature, made visible';$('assembly-part-description').textContent='Color follows each branch’s simulated plate temperature. It is a teaching overlay, not a thermal camera image.';}
});
for(const button of document.querySelectorAll('[data-camera]'))button.addEventListener('click',()=>{
  manualScene?.setView(button.dataset.camera);
  for(const other of document.querySelectorAll('[data-camera]')){const active=other===button;other.classList.toggle('selected',active);other.setAttribute('aria-pressed',String(active));}
});
$('assembly-inspect').addEventListener('change',event=>inspectPart({component:event.target.value}));
$('assembly-branch').addEventListener('change',event=>{selected=Number(event.target.value);dispatch('select',selected);inspectPart({component:$('assembly-inspect').value});});
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
window.addEventListener('pagehide',event=>{if(!event.persisted){manualScene?.dispose();aiScene?.dispose();}});
