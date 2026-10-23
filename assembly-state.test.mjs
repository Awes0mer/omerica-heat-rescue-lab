import test from 'node:test';
import assert from 'node:assert/strict';
import { isTileAllocation, allocationForAction, createAssemblyExport } from './dist/assembly-state.js';
import { PARAMS, createSimulation, setBlocked, setBackupCooling, step, snapshot } from './dist/model.js';

test('tile moves conserve the six-tile budget for every allocation and branch pair', () => {
  for (let a=0;a<=6;a++) for (let b=0;b<=6-a;b++) {
    const counts=Object.freeze([a,b,6-a-b]);
    for (let from=0;from<3;from++) for (let to=0;to<3;to++) {
      const result=allocationForAction(counts,{type:'move-tile',from,to});
      if (from===to || counts[from]===0) assert.equal(result.ok,false);
      else {
        assert.equal(result.ok,true);
        assert.equal(result.changed,true);
        assert.ok(isTileAllocation(result.counts));
        assert.equal(result.counts[from],counts[from]-1);
        assert.equal(result.counts[to],counts[to]+1);
        assert.equal(result.counts[3-from-to],counts[3-from-to]);
      }
    }
  }
});

test('malformed current allocations and actions cannot alter the assembly', () => {
  const malformed=[null,undefined,{},'2,2,2',[],[2,2],[2,2,2,0],[2,2,3],[-1,3,4],[1.5,2.5,2],[NaN,3,3],[Infinity,0,0],['2',2,2],Array(3)];
  for (const counts of malformed) {
    assert.equal(isTileAllocation(counts),false);
    assert.equal(allocationForAction(counts,{type:'balance-tiles'}).ok,false);
    assert.equal(allocationForAction([2,2,2],{type:'apply-ai-layout',counts}).ok,false);
  }
  for (const action of [null,undefined,[],42,'move-tile',{}, {type:'other'}, ...[-1,3,1.5,'1',NaN,undefined].flatMap(index=>[{type:'move-tile',from:index,to:2},{type:'move-tile',from:0,to:index}])]) {
    assert.equal(allocationForAction([2,2,2],action).ok,false);
  }
});

test('balance and AI application report no change without resetting an identical allocation', () => {
  assert.deepEqual(allocationForAction([2,2,2],{type:'balance-tiles'}),{ok:true,changed:false,counts:[2,2,2]});
  assert.deepEqual(allocationForAction([4,2,0],{type:'balance-tiles'}),{ok:true,changed:true,counts:[2,2,2]});
  const ai=Object.freeze([4,2,0]);
  const applied=allocationForAction([2,2,2],{type:'apply-ai-layout',counts:ai});
  assert.equal(applied.changed,true);
  assert.deepEqual(applied.counts,ai);
  assert.notEqual(applied.counts,ai);
  assert.equal(allocationForAction(ai,{type:'apply-ai-layout',counts:ai}).changed,false);
});

test('assembly export captures current computed values and separates AI metadata from teaching parameters', () => {
  const counts=[3,2,1],sim=createSimulation({counts});
  setBlocked(sim,2,true);setBackupCooling(sim,true);step(sim,37.5);
  const current=snapshot(sim),metadata={aiDesign:{counts:[0,3,3],triggerC:72,backupFlowFraction:0.75},camera:'front',exploded:true};
  const exported=createAssemblyExport({snapshot:current,counts,parameters:PARAMS,selected:2,running:false,metadata});
  assert.deepEqual(exported.simulation,current);
  assert.equal(exported.simulation.time,37.5);
  assert.equal(exported.simulation.backupActive,true);
  assert.deepEqual(exported.allocation,{A:3,B:2,C:1,total:6});
  assert.deepEqual(exported.parameters,PARAMS);
  assert.deepEqual(exported.displayedMetadata,metadata);
  assert.deepEqual(exported.controls,{selectedBranch:2,running:false});
  assert.match(exported.label,/SIMULATED/);
  assert.match(exported.limitations.aiTransfer,/tile counts only/);
  assert.match(exported.limitations.netRecovery,/excluding facility cooling/);
  exported.simulation.branches[2].hotC=999;
  exported.simulation.baseline.branches[0].powerW=999;
  exported.displayedMetadata.aiDesign.counts[0]=6;
  assert.notEqual(snapshot(sim).branches[2].hotC,999);
  assert.notEqual(snapshot(sim).baseline.branches[0].powerW,999);
  assert.equal(metadata.aiDesign.counts[0],0);
  assert.throws(()=>createAssemblyExport({snapshot:current,counts:[2,2,2],parameters:PARAMS}),RangeError);
  assert.throws(()=>createAssemblyExport({snapshot:current,counts:[2,2,3],parameters:PARAMS}),RangeError);
});
