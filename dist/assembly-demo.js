// The guide changes presentation and asks the existing teaching solver for a
// reproducible snapshot. It does not calculate a second set of physics.
export const DEMO_INTERVAL_MS = 12000;

export const DEMO_STEPS = Object.freeze([
  {
    id:'server', title:'The server supplies heat', component:'server', camera:'orbit', separation:0, thermal:false, scenario:'baseline', seconds:0,
    explanation:'The chassis holds a powered server. Each teaching branch supplies an assumed 200 W of heat continuously; the three branches total 600 W. Recovered electricity does not power these servers.',
    lookFor:'The highlighted middle server is branch B. The guide begins with two generator tiles on each branch and all cooling pipes open.',
    limit:'This is a calculated all-open equilibrium at time zero. The chassis is illustrative geometry, not a mechanical design.'
  },
  {
    id:'board', title:'Inside the circuit board', component:'board', camera:'top', separation:0.6, thermal:false, scenario:'baseline', seconds:0,
    explanation:'The circuit board gives the processor and cooling stack a physical context. Separating the layers reveals how those parts fit together.',
    lookFor:'Look down on the board beneath the cooling stack. Layer separation moves the drawing only; it does not change thermal contact in the model.',
    limit:'Individual board components, electrical signals, and board temperatures are not separately simulated.'
  },
  {
    id:'processor', title:'The processor is the heat source', component:'processor', camera:'top', separation:0.85, thermal:true, scenario:'baseline', seconds:0,
    explanation:'A running processor releases heat that has to leave the server. This model represents that source as a fixed heat input to one hot plate per branch.',
    lookFor:'The processor sits beneath the copper plate. The temperature colors represent modeled plate temperatures.',
    limit:'The simulation does not resolve CPU hotspots, workload changes, or a processor safety rating.'
  },
  {
    id:'hotplate', title:'The hot plate spreads the heat', component:'hotplate', camera:'front', separation:0.85, thermal:true, scenario:'baseline', seconds:0,
    explanation:'The copper hot plate passes heat toward the generator tiles and the cooler plate. A parallel metal path also carries heat around the tiles.',
    lookFor:'Follow the stack upward from the processor to the copper plate, generator tiles, and water-cooled plate.',
    limit:'The model uses one temperature for the entire hot plate and assumed conductances for these paths.'
  },
  {
    id:'teg', title:'A temperature difference makes electricity', component:'teg', camera:'front', separation:1, thermal:true, scenario:'baseline', seconds:0,
    explanation:'Thermoelectric generator tiles create a voltage when their two faces have different temperatures. Only part of the heat becomes electricity; most still needs a cooling path.',
    lookFor:'The six small tiles sit between the hot and cold plates. Each has its own ideal matched electrical load in this model.',
    limit:'Module properties are synthetic constants, not measurements from a selected commercial part. Wider layer spacing is only an inspection aid.'
  },
  {
    id:'coldplate', title:'The cold plate passes heat into water', component:'coldplate', camera:'front', separation:0.65, thermal:true, scenario:'baseline', seconds:0,
    explanation:'Water removes heat from the cold plate, helping maintain a difference between the generator faces. The plate and the trapped water each store heat and change temperature over time.',
    lookFor:'The water-cooled plate is on the other side of the tiles. Its temperature is calculated separately from the water temperature.',
    limit:'The imposed 25°C water supply is a boundary condition. The energy needed to maintain that supply is outside this model.'
  },
  {
    id:'water', title:'The water loop carries heat away', component:'pipe', camera:'orbit', separation:0.15, thermal:false, scenario:'baseline', seconds:0,
    explanation:'An open branch receives 0.010 kg/s of water, approximately 0.60 L/min. Warmer return water carries energy out of the modeled assembly.',
    lookFor:'Trace the supply pipe, branch valve, cold plate, and return pipe. The other branches retain their assumed regulated flow if one branch is blocked.',
    limit:'This is not a full hydraulic network: pressure losses, turbulence, and redistribution between branches are not solved.'
  },
  {
    id:'load', title:'Count electricity and its extra costs', component:'load', camera:'orbit', separation:0, thermal:false, scenario:'baseline', seconds:0,
    explanation:'The electrical load receives the combined simulated tile output. Net recovery subtracts the assumed 0.90 W added recovery-pump cost and any active backup-pump cost.',
    lookFor:'Compare generated power with recovery after extra pumping in the component readings. A negative result is allowed.',
    limit:'This narrow balance excludes facility chillers, conversion electronics, and server electricity. It is not total data-center savings.'
  },
  {
    id:'blockage', title:'A blocked pipe keeps its stored heat', component:'pipe', camera:'front', separation:0, thermal:true, scenario:'blocked', seconds:120,
    explanation:'This independent example starts at all-open equilibrium, closes pipe B, and calculates 120 simulated seconds with no backup. The trapped water and both plates retain heat while main flow is zero.',
    lookFor:'Branch B is warmer than its starting state. Output follows the temperature difference, so a blockage does not guarantee an immediate fall in recovered power.',
    limit:'The view is paused at a computed result. It is not a prediction of how quickly a real rack would overheat.'
  },
  {
    id:'backup', title:'A backup path helps, with a cost', component:'pump', camera:'orbit', separation:0.1, thermal:true, scenario:'backup', seconds:120,
    explanation:'This is a separate 120-second comparison from the same all-open equilibrium: pipe B is blocked and backup is enabled from the start. The backup supplies 0.005 kg/s, half the normal branch flow.',
    lookFor:'The backup route supplies the blocked branch while the main valve stays closed. The teaching model charges 0.50 W of extra pumping while that backup is active.',
    limit:'This does not continue from the previous hot snapshot. Cooling can improve even when net electricity recovery gets worse; equipment protection is not validated.'
  },
  {
    id:'placement', title:'Six tiles, different arrangements', component:'teg', camera:'top', separation:0.8, thermal:false, scenario:'baseline', seconds:0,
    explanation:'The same six tiles can be distributed across the three branches in 28 allocations. Placement changes both electricity generation and heat transfer.',
    lookFor:'The guide returns to the balanced 2 / 2 / 2 starting layout. After ending the guide, use the layout workshop to move a tile or test all 28 allocations.',
    limit:'Changing placement starts a new thermal run. A winning allocation in this simplified equal-load experiment is not a proven hardware design.'
  },
  {
    id:'ai', title:'AI chooses which experiment to try', component:'overview', camera:'orbit', separation:0.25, thermal:false, scenario:'baseline', seconds:0,
    explanation:'The AI lab learns from simulated trials and proposes tile placements, backup temperature triggers, and backup flow settings. It compares its search with other methods using equal experiment budgets, then checks held-out conditions.',
    lookFor:'End the guide and open “Let AI experiment” to watch predictions and outcomes. That lab has unequal server loads and its own fault and pumping rules.',
    limit:'The assembly shown here remains the equal-load teaching model. Copying an AI tile layout transfers counts only, not its controller, loads, or benchmark score.'
  },
  {
    id:'benefits', title:'What this could help us learn', component:'overview', camera:'orbit', separation:0, thermal:false, scenario:'baseline', seconds:0,
    explanation:'The immediate benefit is understanding tradeoffs: students can follow the heat, and researchers can identify ideas worth testing before building hardware. Failed designs and their pumping costs remain visible.',
    lookFor:'If measured recovery eventually exceeds all added cooling, pumping, and conversion costs, a validated system could reclaim some energy. Any emissions benefit would depend on the electricity displaced and the full system footprint.',
    limit:'This demo has not demonstrated energy savings, emissions reductions, water savings, or safer equipment. Those outcomes require measured prototypes and a wider system assessment.'
  }
].map(step => Object.freeze(step)));

export function createDemoState() {
  return { active:false, index:0, playing:false };
}

/** Manual navigation pauses autoplay; the last step never loops or auto-exits. */
export function transitionDemo(state, event) {
  const last = DEMO_STEPS.length - 1;
  if (event === 'start') return { active:true, index:0, playing:false };
  if (event === 'end') return createDemoState();
  if (!state.active) return { ...state, playing:false };
  if (event === 'pause') return { ...state, playing:false };
  if (event === 'play') return { ...state, playing:state.index < last };
  if (event === 'previous') return { ...state, index:Math.max(0, state.index - 1), playing:false };
  if (event === 'next') return { ...state, index:Math.min(last, state.index + 1), playing:false };
  if (event === 'tick' && state.playing) {
    const index = Math.min(last, state.index + 1);
    return { ...state, index, playing:index < last };
  }
  return { ...state };
}
