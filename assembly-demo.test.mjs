import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_INTERVAL_MS, DEMO_STEPS, createDemoState, transitionDemo } from './dist/assembly-demo.js';

test('the guide directly covers every inspectable assembly component and the broader experiment', () => {
  const components=new Set(DEMO_STEPS.map(step=>step.component));
  for (const name of ['server','board','processor','hotplate','teg','coldplate','pipe','pump','load','overview']) assert.ok(components.has(name),name);
  for (const id of ['blockage','backup','placement','ai','benefits']) assert.ok(DEMO_STEPS.some(step=>step.id===id));
  assert.equal(new Set(DEMO_STEPS.map(step=>step.id)).size,DEMO_STEPS.length);
  assert.ok(Object.isFrozen(DEMO_STEPS));
});

test('guide steps request bounded deterministic teaching states and include limitations', () => {
  for (const step of DEMO_STEPS) {
    assert.ok(['baseline','blocked','backup'].includes(step.scenario));
    assert.ok(['orbit','front','top'].includes(step.camera));
    assert.ok(step.separation>=0&&step.separation<=1);
    assert.equal(typeof step.thermal,'boolean');
    assert.equal(step.seconds,step.scenario==='baseline'?0:120);
    assert.ok(step.explanation.length>30&&step.lookFor.length>30&&step.limit.length>30);
    assert.ok(Object.isFrozen(step));
  }
  assert.match(DEMO_STEPS.find(step=>step.id==='backup').limit,/does not continue/);
  assert.match(DEMO_STEPS.find(step=>step.id==='benefits').limit,/has not demonstrated/);
});

test('autoplay requires an explicit play and stops at the final step without looping', () => {
  assert.equal(DEMO_INTERVAL_MS,12000);
  let state=createDemoState();
  assert.equal(transitionDemo(state,'play').playing,false);
  state=transitionDemo(state,'start');
  assert.deepEqual(state,{active:true,index:0,playing:false});
  assert.equal(transitionDemo(state,'tick').index,0);
  state=transitionDemo(state,'play');
  for(let i=1;i<DEMO_STEPS.length;i++) {
    state=transitionDemo(state,'tick');
    assert.equal(state.index,i);
    assert.equal(state.playing,i<DEMO_STEPS.length-1);
  }
  assert.equal(transitionDemo(state,'tick').index,DEMO_STEPS.length-1);
  assert.equal(transitionDemo(state,'play').playing,false);
  assert.equal(state.active,true);
});

test('manual navigation, hiding and ending cannot accidentally resume autoplay', () => {
  const original=Object.freeze({active:true,index:3,playing:true});
  const paused=transitionDemo(original,'pause');
  assert.equal(paused.playing,false);
  assert.equal(transitionDemo(paused,'tick').index,3);
  assert.equal(transitionDemo(paused,'visible').playing,false);
  assert.deepEqual(transitionDemo(original,'previous'),{active:true,index:2,playing:false});
  assert.deepEqual(transitionDemo(original,'next'),{active:true,index:4,playing:false});
  assert.equal(transitionDemo({active:true,index:0,playing:true},'previous').index,0);
  const ended=transitionDemo(original,'end');
  assert.deepEqual(ended,createDemoState());
  assert.equal(transitionDemo(ended,'tick').playing,false);
  assert.equal(original.playing,true,'state transitions do not mutate callers');
});
