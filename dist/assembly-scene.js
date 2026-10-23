/**
 * Original procedural assembly illustration. MIT License; see ../LICENSE.
 * Three.js is bundled separately under MIT (see third-party/THREE-LICENSE.txt).
 * Geometry is explanatory, not dimensioned CAD or a validated hardware design.
 * Temperature colours use the shared thermal-model snapshot; animation does not
 * calculate heat transfer, generation, flow, or modify the simulation.
 */
import * as THREE from './vendor/three/three.module.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TEMP_STOPS = [
  [25, '#3c9aaa'], [45, '#a9c4a9'], [60, '#e3bb70'],
  [80, '#dd774b'], [100, '#c94232'],
].map(([t, c]) => [t, new THREE.Color(c)]);
function temperatureColour(temp) {
  const t = Number.isFinite(temp) ? temp : 25;
  if (t <= 25) return TEMP_STOPS[0][1].clone();
  for (let n = 1; n < TEMP_STOPS.length; n++) {
    const [high, c2] = TEMP_STOPS[n], [low, c1] = TEMP_STOPS[n - 1];
    if (t <= high) return c1.clone().lerp(c2, (t - low) / (high - low));
  }
  return TEMP_STOPS.at(-1)[1].clone();
}

export function createAssemblyScene(container, { onSelect = () => {} } = {}) {
  if (!container) throw new TypeError('An assembly container is required.');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eeede7');
  scene.fog = new THREE.Fog('#eeede7', 30, 75);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Three-dimensional heat-recovery assembly. Drag to rotate, scroll to zoom, or select a component.');
  container.appendChild(renderer.domElement);

  const geometries = new Set(), materials = new Set(), textures = new Set();
  const keepG = g => (geometries.add(g), g);
  const keepM = m => (materials.add(m), m);
  const mat = (colour, extra = {}) => keepM(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.43, metalness: 0.4, ...extra }));
  const graphite = mat('#27343a', { roughness: 0.55, metalness: 0.5 });
  const black = mat('#172a2b', { roughness: 0.72, metalness: 0.12 });
  const steel = mat('#bdc7c6', { roughness: 0.26, metalness: 0.8 });
  const darkSteel = mat('#627575', { roughness: 0.35, metalness: 0.65 });
  const ceramic = mat('#f8f5e9', { roughness: 0.62, metalness: 0 });
  const electrode = mat('#d7b790', { roughness: 0.4, metalness: 0.6 });
  const gold = mat('#b99548', { roughness: 0.37, metalness: 0.62 });
  const blue = mat('#367e9d', { roughness: 0.3, metalness: 0.4 });
  const coolant = mat('#49c4d2', { emissive: '#237f91', emissiveIntensity: 0.16, roughness: 0.26, metalness: 0.05 });
  const amberFlow = mat('#ffe2a1', { emissive: '#e1ab36', emissiveIntensity: 0.35, metalness: 0.1 });
  const board = mat('#233e3b', { roughness: 0.76, metalness: 0.04 });
  const red = mat('#c86145', { roughness: 0.4, metalness: 0.28 });
  const sleeve = mat('#66b9c9', { transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.2, metalness: 0.08 });
  const unitBox = keepG(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = keepG(new THREE.CylinderGeometry(1, 1, 1, 14));
  const boltGeometry = keepG(new THREE.CylinderGeometry(0.053, 0.053, 0.035, 6));
  const beadGeometry = keepG(new THREE.SphereGeometry(0.055, 8, 6));
  const partMap = new Map(), pickables = [], flows = [], branchVisuals = [];
  let explode = 0, heatColors = false, disposed = false, frame = 0, visible = true;
  let selectedId = null, latestSnapshot = null, latestOptions = {};

  function box(parent, dims, position, material, shadow = true) {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.scale.set(...dims); mesh.position.set(...position);
    mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, a, b, radius, material, shadow = true) {
    const mesh = new THREE.Mesh(unitCylinder, material), direction = b.clone().sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), direction.clone().normalize());
    mesh.scale.set(radius, direction.length(), radius);
    mesh.castShadow = shadow; parent.add(mesh); return mesh;
  }
  function part(parent, branch, type, label) {
    const group = new THREE.Group(), id = `${type}-${branch}`;
    group.userData.part = { id, branch, type, label };
    parent.add(group); partMap.set(id, group); pickables.push(group); return group;
  }
  function bolts(parent, points) {
    const mesh = new THREE.InstancedMesh(boltGeometry, steel, points.length), matrix = new THREE.Matrix4();
    points.forEach((p, i) => { matrix.makeTranslation(...p); mesh.setMatrixAt(i, matrix); });
    mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function textSprite(text, colour = '#263a39', fontSize = 70, bg = null) {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = colour; ctx.fillText(text, 192, 65);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const material = keepM(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    const sprite = new THREE.Sprite(material); sprite.scale.set(1.7, 0.57, 1); return sprite;
  }
  function valve(parent, position, material, axis = 'y') {
    const group = new THREE.Group(); group.position.copy(position); parent.add(group);
    cylinder(group, V(0, -0.11, 0), V(0, 0.12, 0), 0.105, steel);
    cylinder(group, V(0, 0.12, 0), V(0, 0.32, 0), 0.027, steel);
    const wheel = new THREE.Mesh(keepG(new THREE.TorusGeometry(0.17, 0.026, 6, 20)), material);
    wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.34; group.add(wheel);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      cylinder(group, V(0, 0.34, 0), V(Math.cos(angle) * 0.15, 0.34, Math.sin(angle) * 0.15), 0.015, material, false);
    }
    if (axis === 'z') group.rotation.x = Math.PI / 2;
    return group;
  }
  function tube(parent, points, radius, material) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const mesh = new THREE.Mesh(keepG(new THREE.TubeGeometry(curve, 30, radius, 8, false)), material);
    mesh.castShadow = true; parent.add(mesh); return { mesh, curve };
  }
  function removeTube(value) {
    if (!value) return;
    value.mesh.parent?.remove(value.mesh); geometries.delete(value.mesh.geometry); value.mesh.geometry.dispose();
  }
  function addFlow(parent, curve, material, branch, backup, reverse) {
    const markers = [0, 1, 2].map(() => { const m = new THREE.Mesh(beadGeometry, material); parent.add(m); return m; });
    const value = { curve, markers, branch, backup, reverse }; flows.push(value); return value;
  }

  // Broad soft illumination leaves ceramic, copper, tubing, and steel distinguishable.
  scene.add(new THREE.HemisphereLight('#ffffff', '#738881', 2.25));
  const key = new THREE.DirectionalLight('#fff6e5', 3.6); key.position.set(-5, 14, 8);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -11; key.shadow.camera.right = 11; key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 35; key.shadow.normalBias = 0.025; key.shadow.bias = -0.00012;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#cce9f0', 1.2); fill.position.set(8, 5, -7); scene.add(fill);
  const floor = new THREE.Mesh(keepG(new THREE.PlaneGeometry(150, 150)), mat('#eeede7', { roughness: 1, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.37; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(46, 46, '#d6dad2', '#e0e1da'); grid.position.y = -0.365;
  grid.material.transparent = true; grid.material.opacity = 0.45; materials.add(grid.material); geometries.add(grid.geometry); scene.add(grid);

  const assembly = new THREE.Group(); scene.add(assembly);
  // Original open-frame mounting chassis. All sizes are illustrative scene units.
  box(assembly, [12.5, 0.12, 6.25], [0, -0.08, -0.18], graphite);
  box(assembly, [12.64, 0.15, 0.1], [0, 0.02, 2.98], steel);
  box(assembly, [12.64, 0.15, 0.1], [0, 0.02, -3.34], steel);
  box(assembly, [0.1, 0.15, 6.3], [-6.3, 0.02, -0.18], steel);
  box(assembly, [0.1, 0.15, 6.3], [6.3, 0.02, -0.18], steel);
  for (const x of [-5.7, 5.7]) for (const z of [-2.8, 2.5]) box(assembly, [0.55, 0.23, 0.55], [x, -0.25, z], black);
  // Shared headers are schematic boundaries, not an additional thermal model.
  cylinder(assembly, V(-5.65, 0.49, -2.4), V(5.65, 0.49, -2.4), 0.145, blue);
  cylinder(assembly, V(-5.65, 0.49, -2.95), V(5.65, 0.49, -2.95), 0.145, darkSteel);
  cylinder(assembly, V(-5.65, 0.4, 2.2), V(5.65, 0.4, 2.2), 0.11, gold);
  cylinder(assembly, V(-5.65, 0.4, 2.65), V(5.65, 0.4, 2.65), 0.11, gold);
  for (const z of [-2.4, -2.95, 2.2, 2.65]) for (const x of [-5.7, 5.7]) {
    cylinder(assembly, V(x - 0.07, z < 0 ? 0.49 : 0.4, z), V(x + 0.07, z < 0 ? 0.49 : 0.4, z), z < 0 ? 0.2 : 0.16, steel);
  }
  const routeLabel = textSprite('MAIN WATER', '#4e777c', 36); routeLabel.position.set(-4.1, 0.56, -3.33); routeLabel.scale.set(1.8, 0.6, 1); assembly.add(routeLabel);
  const backupLabel = textSprite('BACKUP WATER', '#e9d7a5', 32); backupLabel.position.set(4.35, 0.2, 2.92); backupLabel.scale.set(1.8, 0.6, 1); assembly.add(backupLabel);

  for (let b = 0; b < 3; b++) {
    const group = new THREE.Group(); group.position.x = (b - 1) * 3.65; assembly.add(group);
    const copperMat = mat('#b96f42', { roughness: 0.3, metalness: 0.72 });
    const coldMat = mat('#7ca8ad', { roughness: 0.32, metalness: 0.65 });
    const hot = part(group, b, 'hot', `Branch ${'ABC'[b]} · hot plate`);
    box(hot, [2.83, 0.09, 2.13], [0, 0.18, 0], board);
    box(hot, [2.38, 0.25, 1.73], [0, 0.36, 0], black);
    box(hot, [2.1, 0.035, 1.45], [0, 0.5, 0], steel);
    // Connector pins and board traces establish the server-side assembly.
    for (const x of [-1.28, 1.28]) for (let p = 0; p < 7; p++) box(hot, [0.12, 0.05, 0.1], [x, 0.24, -0.75 + p * 0.25], electrode, false);
    const spreader = new THREE.Group(); hot.add(spreader);
    box(spreader, [2.62, 0.12, 1.95], [0, 0, 0], copperMat);
    box(spreader, [2.48, 0.04, 1.81], [0, 0.08, 0], copperMat);
    const studPoints = [-1.13, 1.13].flatMap(x => [-0.78, 0.78].map(z => [x, 0.11, z])); bolts(spreader, studPoints);
    const teg = part(group, b, 'teg', `Branch ${'ABC'[b]} · thermoelectric tiles`);
    const tiles = [];
    for (let n = 0; n < 6; n++) {
      const tile = new THREE.Group(); tile.position.set((n % 3 - 1) * 0.76, 0, (Math.floor(n / 3) - 0.5) * 0.73); teg.add(tile);
      box(tile, [0.67, 0.045, 0.61], [0, -0.053, 0], ceramic);
      box(tile, [0.61, 0.065, 0.55], [0, 0, 0], graphite);
      box(tile, [0.67, 0.045, 0.61], [0, 0.053, 0], ceramic);
      // Visible alternating junctions are a conceptual cutaway, not a materials claim.
      for (let j = 0; j < 4; j++) box(tile, [0.062, 0.045, 0.016], [-0.23 + j * 0.155, 0, 0.285], j % 2 ? electrode : steel, false);
      box(tile, [0.045, 0.025, 0.16], [-0.12, 0, 0.365], red, false);
      box(tile, [0.045, 0.025, 0.16], [0.12, 0, 0.365], black, false);
      tiles.push(tile);
    }
    const cold = part(group, b, 'cold', `Branch ${'ABC'[b]} · water-cooled plate`);
    box(cold, [2.7, 0.18, 2], [0, 0, 0], coldMat);
    box(cold, [2.56, 0.1, 1.86], [0, 0.12, 0], coldMat);
    box(cold, [2.35, 0.012, 1.65], [0, 0.176, 0], darkSteel);
    // Machined lid channels, intentionally schematized rather than simulated CFD.
    for (let n = 0; n < 7; n++) box(cold, [1.98, 0.009, 0.016], [0, 0.186, -0.6 + n * 0.2], steel, false);
    bolts(cold, [-1.19, 1.19].flatMap(x => [-0.8, 0, 0.8].map(z => [x, 0.19, z])));
    for (const x of [-0.92, 0.92]) cylinder(cold, V(x, 0, -0.94), V(x, 0, -1.14), 0.11, steel);
    for (const x of [-0.92, 0.92]) cylinder(cold, V(x, 0, 0.94), V(x, 0, 1.14), 0.09, gold);
    const main = part(group, b, 'pipe', `Branch ${'ABC'[b]} · main cooling pipe`);
    const backup = part(group, b, 'backup', `Branch ${'ABC'[b]} · independent backup route`);
    const mainValve = valve(main, V(-0.92, 0.6, -1.73), blue);
    const backupValve = valve(backup, V(-0.92, 0.43, 1.75), gold);
    const blockedIndicator = box(main, [0.33, 0.04, 0.32], [-0.92, 0.97, -1.73], red); blockedIndicator.visible = false;
    const label = textSprite(`BRANCH ${'ABC'[b]}`, '#e5e9df', 39); label.position.set(0, 0.22, 1.62); group.add(label);
    const guides = [];
    for (const x of [-1.18, 1.18]) for (const z of [-0.79, 0.79]) {
      const lineMaterial = keepM(new THREE.LineDashedMaterial({ color: '#768d89', transparent: true, opacity: 0.5, dashSize: 0.065, gapSize: 0.06 }));
      const geometry = keepG(new THREE.BufferGeometry().setFromPoints([V(x, 0.6, z), V(x, 3.4, z)]));
      const guide = new THREE.Line(geometry, lineMaterial); guide.computeLineDistances(); group.add(guide); guides.push(guide);
    }
    const visual = { group, hot, spreader, teg, tiles, cold, main, backup, mainValve, backupValve, blockedIndicator, copperMat, coldMat, guides, tubes: [], flowEntries: [], count: 2 };
    branchVisuals.push(visual);
  }

  function positionAssembly() {
    branchVisuals.forEach((v, b) => {
      v.spreader.position.y = 0.64 + explode * 0.2;
      v.teg.position.y = 0.87 + explode * 0.95;
      v.cold.position.y = 1.10 + explode * 1.8;
      v.guides.forEach(g => { g.visible = explode > 0.03; g.scale.y = (v.cold.position.y + 0.2) / 3.4; });
      v.tubes.forEach(removeTube); v.tubes = [];
      v.flowEntries.forEach(f => { f.markers.forEach(m => m.parent?.remove(m)); const idx = flows.indexOf(f); if (idx >= 0) flows.splice(idx, 1); });
      v.flowEntries = [];
      const y = v.cold.position.y;
      for (const [x, endpointZ, isReturn] of [[-0.92, -2.4, false], [0.92, -2.95, true]]) {
        const points = [V(x, y, -1.12), V(x, y, -1.36), V(x, 0.58, -1.7), V(x, 0.49, endpointZ)];
        const outer = tube(v.main, points, 0.092, sleeve), inner = tube(v.main, points, 0.043, coolant);
        v.tubes.push(outer, inner); v.flowEntries.push(addFlow(v.main, outer.curve, coolant, b, false, !isReturn));
      }
      for (const [x, endpointZ, isReturn] of [[-0.92, 2.2, false], [0.92, 2.65, true]]) {
        const points = [V(x, y, 1.12), V(x, y, 1.32), V(x, 0.46, 1.72), V(x, 0.4, endpointZ)];
        const outer = tube(v.backup, points, 0.057, gold); v.tubes.push(outer);
        v.flowEntries.push(addFlow(v.backup, outer.curve, amberFlow, b, true, !isReturn));
      }
    });
    refreshSelection();
  }

  const selection = new THREE.Box3Helper(new THREE.Box3(), '#db9241');
  selection.material.depthTest = true; selection.material.transparent = true; selection.material.opacity = 0.9;
  materials.add(selection.material); geometries.add(selection.geometry); selection.visible = false; scene.add(selection);
  function refreshSelection() {
    const group = partMap.get(selectedId); selection.visible = Boolean(group);
    if (group) { assembly.updateMatrixWorld(true); selection.box.setFromObject(group); selection.box.expandByScalar(0.065); }
  }
  positionAssembly();

  const orbit = { theta: 0.24, phi: 0.93, radius: 16.4, target: V(0, 0.6, -0.15) };
  function updateCamera() {
    camera.position.copy(orbit.target).add(V(Math.sin(orbit.phi) * Math.sin(orbit.theta), Math.cos(orbit.phi), Math.sin(orbit.phi) * Math.cos(orbit.theta)).multiplyScalar(orbit.radius));
    camera.lookAt(orbit.target);
  }
  function resetCamera() {
    orbit.theta = 0.24; orbit.phi = 0.93;
    orbit.radius = camera.aspect < 1.55 ? 23.9 / Math.max(camera.aspect, 0.55) : 16.4;
    orbit.target.set(0, 0.6 + explode * 0.3, -0.15); updateCamera();
  }
  let previousAspect = 0;
  function resize() {
    const width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (!previousAspect || Math.abs(camera.aspect - previousAspect) > 0.35) resetCamera();
    previousAspect = camera.aspect;
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
  const canvas = renderer.domElement, pointers = new Map(), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = null, lastDistance = 0;
  function pointerDown(event) {
    if (event.button != null && event.button > 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 1) down = { x: event.clientX, y: event.clientY, moved: false };
    else { down && (down.moved = true); const values = [...pointers.values()]; lastDistance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y); }
    canvas.style.cursor = 'grabbing';
  }
  function pointerMove(event) {
    const last = pointers.get(event.pointerId); if (!last) return;
    const dx = event.clientX - last.x, dy = event.clientY - last.y;
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) down.moved = true;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) {
      const values = [...pointers.values()], distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      if (lastDistance > 0 && distance > 0) orbit.radius = clamp(orbit.radius * lastDistance / distance, 10, 55);
      lastDistance = distance;
    } else { orbit.theta -= dx * 0.006; orbit.phi = clamp(orbit.phi - dy * 0.005, 0.23, 1.43); }
    updateCamera();
  }
  function pointerUp(event) {
    const clicked = pointers.has(event.pointerId) && pointers.size === 1 && down && !down.moved;
    pointers.delete(event.pointerId); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!pointers.size) canvas.style.cursor = 'grab';
    if (clicked && event.type !== 'pointercancel') {
      const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, true).filter(hit => {
        let object = hit.object; while (object) { if (!object.visible) return false; object = object.parent; } return true;
      });
      if (hits.length) {
        let object = hits[0].object; while (object && !object.userData.part) object = object.parent;
        if (object?.userData.part) { selectPart(object.userData.part.id); onSelect({ ...object.userData.part }); }
      }
    }
    if (!pointers.size) down = null;
  }
  function wheel(event) { event.preventDefault(); orbit.radius = clamp(orbit.radius * Math.exp(event.deltaY * 0.001), 10, 55); updateCamera(); }
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  function keyDown(event) {
    let handled = true;
    if (event.key === 'ArrowLeft') orbit.theta += 0.10;
    else if (event.key === 'ArrowRight') orbit.theta -= 0.10;
    else if (event.key === 'ArrowUp') orbit.phi = clamp(orbit.phi - 0.07, 0.23, 1.43);
    else if (event.key === 'ArrowDown') orbit.phi = clamp(orbit.phi + 0.07, 0.23, 1.43);
    else if (event.key === '+' || event.key === '=') orbit.radius = clamp(orbit.radius * 0.9, 10, 55);
    else if (event.key === '-' || event.key === '_') orbit.radius = clamp(orbit.radius / 0.9, 10, 55);
    else if (event.key === 'Home') resetCamera();
    else handled = false;
    if (handled) { event.preventDefault(); updateCamera(); }
  }
  canvas.addEventListener('keydown', keyDown);

  function update(snapshot, layout, options = {}) {
    latestSnapshot = snapshot; latestOptions = options || {};
    const counts = Array.isArray(layout) ? layout : layout?.counts;
    branchVisuals.forEach((v, b) => {
      const branch = snapshot?.branches?.[b]; if (!branch) return;
      const count = clamp(Math.round(counts?.[b] ?? branch.count ?? 2), 0, 6); v.count = count;
      // Occupy paired centre tiles first; layout never changes the shared model here.
      const tileOrder = [1, 4, 0, 3, 2, 5]; v.tiles.forEach((t, n) => { t.visible = tileOrder.indexOf(n) < count; });
      v.copperMat.color.copy(heatColors ? temperatureColour(branch.hotC) : new THREE.Color('#b96f42'));
      v.coldMat.color.copy(heatColors ? temperatureColour(branch.coldC) : new THREE.Color('#7ca8ad'));
      v.blockedIndicator.visible = Boolean(branch.blocked);
      v.mainValve.rotation.y = branch.blocked ? Math.PI / 2 : 0;
      v.backupValve.rotation.y = branch.backupActive ? Math.PI / 2 : 0;
    });
    refreshSelection();
  }
  function selectPart(id) { selectedId = partMap.has(id) ? id : null; refreshSelection(); }
  function setExplode(value) {
    const next = clamp(Number(value) || 0, 0, 1); if (Math.abs(next - explode) < 0.001) return;
    explode = next; positionAssembly();
  }
  function setHeatColors(value) { heatColors = Boolean(value); if (latestSnapshot) update(latestSnapshot, null, latestOptions); }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function animate(now) {
    frame = 0; if (disposed || !visible) return;
    flows.forEach(flow => {
      const b = latestSnapshot?.branches?.[flow.branch];
      const running = b && (flow.backup ? b.backupActive : !b.blocked && (b.flowKgS ?? b.flow ?? 0) > 0);
      flow.markers.forEach((marker, i) => {
        marker.visible = Boolean(running && latestOptions.showFlow !== false);
        if (!marker.visible) return;
        const speed = reducedMotion.matches || latestOptions.paused ? 0 : now * 0.00014;
        let t = (speed + i / 3) % 1; if (flow.reverse) t = 1 - t;
        marker.position.copy(flow.curve.getPointAt(t));
      });
    });
    if (selection.visible) selection.material.opacity = reducedMotion.matches ? 0.9 : 0.75 + 0.2 * Math.sin(now * 0.003);
    renderer.render(scene, camera); frame = requestAnimationFrame(animate);
  }
  function start() { if (!disposed && visible && !frame) frame = requestAnimationFrame(animate); }
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting) && !document.hidden;
    if (visible) start(); else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: '120px' }); intersectionObserver.observe(container);
  function visibilityChange() { visible = !document.hidden && container.getBoundingClientRect().bottom > 0 && container.getBoundingClientRect().top < innerHeight + 120; if (visible) start(); else if (frame) { cancelAnimationFrame(frame); frame = 0; } }
  document.addEventListener('visibilitychange', visibilityChange);
  start();

  function dispose() {
    if (disposed) return; disposed = true; if (frame) cancelAnimationFrame(frame);
    resizeObserver.disconnect(); intersectionObserver.disconnect(); document.removeEventListener('visibilitychange', visibilityChange);
    canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('keydown', keyDown);
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    renderer.dispose(); canvas.remove();
  }
  return { update, setExplode, setHeatColors, resetCamera, selectPart, dispose };
}
