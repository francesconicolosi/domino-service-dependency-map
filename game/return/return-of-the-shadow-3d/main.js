// ============================================================================
//  THE RETURN OF THE SHADOW — 3D
//  A third-person walk through the Witch's Keep, rendered with Three.js.
//  Everything (hero, skeletons, keep, textures) is generated procedurally in
//  code — no external assets, in the spirit of the original 2D game.
// ============================================================================

import * as THREE from 'three';

// ---------------------------------------------------------------- constants
const HERO_R = 0.34;          // collision radius
const HERO_H = 1.7;           // collision height
const WALK_SPEED = 4.2;
const RUN_SPEED = 8.0;
const ACCEL = 34;
const GRAV = 26;
const JUMP_V = 9.2;

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0713);
scene.fog = new THREE.FogExp2(0x0c0916, 0.018);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
camera.position.set(0, 4, 64);

// ---------------------------------------------------------------- lights
const hemi = new THREE.HemisphereLight(0x7568a4, 0x33271a, 1.25);
scene.add(hemi);

const moon = new THREE.DirectionalLight(0xaebbf0, 1.05);
moon.position.set(-30, 55, 40);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 200;
const sc = 70;
moon.shadow.camera.left = -sc; moon.shadow.camera.right = sc;
moon.shadow.camera.top = sc; moon.shadow.camera.bottom = -sc;
moon.shadow.bias = -0.0004;
scene.add(moon);
scene.add(moon.target);

// a soft, cool key-light that follows the hero so the protagonist always reads
// clearly in third person, even away from the torches
const heroLight = new THREE.PointLight(0xbfd0ff, 9, 16, 2);
heroLight.position.set(0, 5, 60);
scene.add(heroLight);

// ---------------------------------------------------------------- procedural textures
function shade(hex, f) {
  const r = Math.min(255, ((hex >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((hex >> 8) & 255) * f) | 0;
  const b = Math.min(255, (hex & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}
function brickTexture(base, mortar, bw, bh, tile) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = shade(mortar, 1); g.fillRect(0, 0, S, S);
  for (let row = 0; row * bh < S + bh; row++) {
    const off = (row % 2) ? bw / 2 : 0;
    for (let x = -1; x * bw < S + bw; x++) {
      const bx = x * bw + off + 2, by = row * bh + 2, w = bw - 4, h = bh - 4;
      g.fillStyle = shade(base, 0.8 + Math.random() * 0.35);
      g.fillRect(bx, by, w, h);
      for (let s = 0; s < 10; s++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.14})`;
        g.fillRect(bx + Math.random() * w, by + Math.random() * h, 2, 2);
      }
      g.fillStyle = `rgba(255,255,255,0.05)`;
      g.fillRect(bx, by, w, 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(tile, tile);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  return t;
}
const floorTex = brickTexture(0x3b3742, 0x1a1720, 64, 64, 14);
const wallTex = brickTexture(0x322e3a, 0x151220, 48, 24, 6);

// ---------------------------------------------------------------- world + colliders
const colliders = [];   // array of THREE.Box3
const torches = [];     // { light, flame, base }

function addBox(x, y, z, w, h, d, mat, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (opts.collide !== false) {
    colliders.push(new THREE.Box3(
      new THREE.Vector3(x - w / 2, y, z - d / 2),
      new THREE.Vector3(x + w / 2, y + h, z + d / 2)));
  }
  return mesh;
}

const matFloor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.96, metalness: 0.0 });
const matWall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, metalness: 0.0 });
const matStone = new THREE.MeshStandardMaterial({ color: 0x2c2836, roughness: 0.9, flatShading: true });
const matStoneLite = new THREE.MeshStandardMaterial({ color: 0x39344a, roughness: 0.85, flatShading: true });
const matWood = new THREE.MeshStandardMaterial({ color: 0x3a2413, roughness: 0.8 });
const matIron = new THREE.MeshStandardMaterial({ color: 0x2a2730, roughness: 0.5, metalness: 0.6, flatShading: true });

const HALF_X = 22, Z_START = 66, Z_DOOR = -66, LEN = Z_START - Z_DOOR;

// floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_X * 2, LEN + 8), matFloor);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, (Z_START + Z_DOOR) / 2);
floor.receiveShadow = true;
scene.add(floor);

// perimeter walls
addBox(-HALF_X - 1, 0, (Z_START + Z_DOOR) / 2, 2, 9, LEN + 8, matWall);
addBox(HALF_X + 1, 0, (Z_START + Z_DOOR) / 2, 2, 9, LEN + 8, matWall);
addBox(0, 0, Z_START + 4, HALF_X * 2 + 4, 9, 2, matWall);   // back wall behind the start

// crenellations along the tops of the side walls (decor, no collision)
for (let z = Z_DOOR; z <= Z_START; z += 4) {
  for (const sx of [-HALF_X - 1, HALF_X + 1]) {
    addBox(sx, 9, z, 2, 1.4, 2, matWall, { collide: false });
  }
}

// pillars in two rows
for (let z = Z_START - 10; z > Z_DOOR + 8; z -= 12) {
  for (const px of [-14, 14]) {
    addBox(px, 0, z, 2.4, 7.5, 2.4, matStone);
    addBox(px, 7.5, z, 3.2, 0.6, 3.2, matStoneLite, { collide: false });   // capital
    addBox(px, 0, z, 3.2, 0.5, 3.2, matStoneLite, { collide: false });     // base
  }
}

// raised platforms / steps to clamber onto
addBox(-6, 0, 20, 7, 1.0, 7, matStone);
addBox(6, 0, 4, 6, 1.6, 6, matStone);
addBox(-4, 0, -14, 8, 0.7, 5, matStone);
addBox(9, 0, -26, 5, 2.2, 5, matStone);
addBox(-10, 0, -34, 5, 1.2, 6, matStone);
// a low broken wall to weave around
addBox(2, 0, 34, 9, 1.3, 1.4, matStone);

// ------ flickering torches on the walls ------
function makeTorch(x, y, z) {
  const g = new THREE.Group();
  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.9, 6), matIron);
  bracket.position.y = 0;
  bracket.castShadow = true;
  g.add(bracket);
  const flame = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24, 0),
    new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a12, emissiveIntensity: 2.4, roughness: 1 }));
  flame.position.y = 0.6;
  flame.scale.y = 1.6;
  g.add(flame);
  const light = new THREE.PointLight(0xff8836, 26, 26, 2.0);
  light.position.set(0, 0.7, 0);
  g.add(light);
  g.position.set(x, y, z);
  scene.add(g);
  torches.push({ light, flame, base: 26, x, z });
}
for (let z = Z_START - 6; z > Z_DOOR + 4; z -= 13) {
  makeTorch(-HALF_X + 0.4, 4.4, z);
  makeTorch(HALF_X - 0.4, 4.4, z);
}

// ------ the grand arched exit door at the far end ------
function buildDoor() {
  const g = new THREE.Group();
  g.position.set(0, 0, Z_DOOR + 1.2);
  // stone surround
  const surround = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 1.4), matStoneLite);
  surround.position.y = 4.5; surround.castShadow = true; surround.receiveShadow = true;
  g.add(surround);
  // arched recess (dark)
  const recess = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x07060c, roughness: 1 }));
  recess.position.set(0, 4, 0.5);
  g.add(recess);
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.6, 24, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x07060c, roughness: 1 }));
  arch.rotation.z = -Math.PI / 2; arch.rotation.y = Math.PI / 2;
  arch.position.set(0, 8, 0.5);
  g.add(arch);
  // two wooden leaves
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.9, 7.6, 0.35), matWood);
    leaf.position.set(s * 1.5, 3.9, 0.7); leaf.castShadow = true;
    g.add(leaf);
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.28, 0.42), matIron);
      band.position.set(s * 1.5, 1.6 + i * 2.4, 0.7);
      g.add(band);
    }
  }
  scene.add(g);
  // collider so you can't walk through it
  colliders.push(new THREE.Box3(new THREE.Vector3(-4.5, 0, Z_DOOR + 0.4),
    new THREE.Vector3(4.5, 9, Z_DOOR + 2.0)));
  // warm glow from the doorway
  const dl = new THREE.PointLight(0xff9a44, 10, 22, 2);
  dl.position.set(0, 3.5, Z_DOOR + 2.6);
  scene.add(dl);
  torches.push({ light: dl, flame: null, base: 10, x: 0, z: Z_DOOR + 2.6 });
}
buildDoor();

// scattered rubble for texture (no collision)
for (let i = 0; i < 40; i++) {
  const r = 0.3 + Math.random() * 0.5;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), matStone);
  m.position.set((Math.random() * 2 - 1) * (HALF_X - 2), r * 0.4, Z_DOOR + Math.random() * LEN);
  m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
}

// ---------------------------------------------------------------- the HERO
function buildHero() {
  const root = new THREE.Group();
  const cloak = new THREE.MeshStandardMaterial({ color: 0x2b2740, roughness: 0.85, flatShading: true });
  const cloakDk = new THREE.MeshStandardMaterial({ color: 0x1f1c30, roughness: 0.9, flatShading: true });
  const skin = new THREE.MeshStandardMaterial({ color: 0xcdb79f, roughness: 0.7, flatShading: true });
  const scarfMat = new THREE.MeshStandardMaterial({ color: 0x9c2b2b, roughness: 0.7, flatShading: true });
  const leather = new THREE.MeshStandardMaterial({ color: 0x33241a, roughness: 0.8, flatShading: true });

  function cap(r, len, mat) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    m.castShadow = true; return m;
  }

  // torso (pivot at ~0.95 so root.y = feet on ground)
  const torso = cap(0.28, 0.5, cloak);
  torso.position.y = 1.15;
  torso.scale.set(1.15, 1, 0.8);
  root.add(torso);

  // hips block
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.36), cloakDk);
  hips.position.y = 0.92; hips.castShadow = true; root.add(hips);

  // head + hood
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 1), skin);
  head.position.y = 1.62; head.castShadow = true; root.add(head);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.5, 8), cloak);
  hood.position.set(0, 1.66, -0.03); hood.castShadow = true; root.add(hood);
  const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), cloak);
  hoodBack.position.set(0, 1.6, -0.02); hoodBack.rotation.x = -0.2; hoodBack.castShadow = true; root.add(hoodBack);

  // shoulders / arms (groups pivot at shoulder)
  function limb(px, py, pz, r, len, mat) {
    const grp = new THREE.Group();
    grp.position.set(px, py, pz);
    const seg = cap(r, len, mat);
    seg.position.y = -len / 2 - r;
    grp.add(seg);
    root.add(grp);
    return grp;
  }
  const armL = limb(-0.42, 1.34, 0, 0.10, 0.34, cloak);
  const armR = limb(0.42, 1.34, 0, 0.10, 0.34, cloak);
  // hands
  for (const a of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), leather);
    hand.position.y = -0.56; hand.castShadow = true; a.add(hand);
  }
  const legL = limb(-0.16, 0.9, 0, 0.12, 0.4, cloakDk);
  const legR = limb(0.16, 0.9, 0, 0.12, 0.4, cloakDk);
  for (const l of [legL, legR]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), leather);
    boot.position.set(0, -0.66, 0.05); boot.castShadow = true; l.add(boot);
  }

  // red scarf around the neck + trailing tails
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12), scarfMat);
  collar.position.y = 1.44; collar.rotation.x = Math.PI / 2; collar.castShadow = true; root.add(collar);
  const scarf = [];
  let py = 1.4;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), scarfMat);
    seg.castShadow = true; root.add(seg);
    scarf.push(seg); py -= 0.16;
  }

  // cape (segments hanging from the shoulders, sway procedurally)
  const cape = [];
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.6 - i * 0.03, 0.26, 0.05), cloak);
    seg.castShadow = true; root.add(seg); cape.push(seg);
  }

  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  scene.add(root);
  return { root, torso, hips, head, hood, hoodBack, armL, armR, legL, legR, scarf, cape };
}
const hero = buildHero();

// hero state
const heroPos = new THREE.Vector3(0, 0, 58);
const heroVel = new THREE.Vector3();
let heroYaw = Math.PI;        // facing -Z (toward the door)
let onGround = true;
let walkPhase = 0;
let speed01 = 0;              // 0..1 blend for animation

// ---------------------------------------------------------------- skeletons
function buildSkeleton() {
  const root = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.7, flatShading: true });
  const boneDk = new THREE.MeshStandardMaterial({ color: 0xa89f88, roughness: 0.8, flatShading: true });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 6), bone);
  spine.position.y = 1.05; spine.castShadow = true; root.add(spine);
  const ribs = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), boneDk);
  ribs.position.y = 1.15; ribs.scale.set(1, 0.9, 0.7); ribs.castShadow = true; root.add(ribs);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), bone);
  skull.position.y = 1.52; skull.castShadow = true; root.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.16), bone);
  jaw.position.set(0, 1.42, 0.02); root.add(jaw);
  function limb(px, py, r, len, mat) {
    const grp = new THREE.Group(); grp.position.set(px, py, 0);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), mat);
    seg.position.y = -len / 2 - r; seg.castShadow = true; grp.add(seg); root.add(grp); return grp;
  }
  const armL = limb(-0.24, 1.32, 0.05, 0.34, boneDk);
  const armR = limb(0.24, 1.32, 0.05, 0.34, boneDk);
  const legL = limb(-0.12, 0.9, 0.06, 0.42, bone);
  const legR = limb(0.12, 0.9, 0.06, 0.42, bone);
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  scene.add(root);
  return { root, armL, armR, legL, legR, skull };
}
const skeletons = [];
function addSkeleton(x, z, z0, z1) {
  const s = buildSkeleton();
  skeletons.push({ ...s, x, z, z0, z1, dir: 1, phase: Math.random() * 6, yaw: 0 });
}
addSkeleton(-6, 20, 8, 30);
addSkeleton(6, -4, -18, 12);
addSkeleton(-4, -34, -44, -20);
addSkeleton(9, -50, -60, -40);

// ---------------------------------------------------------------- input
const keys = {};
let dragging = false, lastPX = 0, lastPY = 0, dragTime = 0;
let camYaw = 0, camPitch = 0.28;
let touchMoveX = 0, touchMoveZ = 0, touchRun = false;
let jumpQueued = false;

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === ' ' || e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// mouse / touch look (drag anywhere on the canvas)
function pointerDown(x, y) { dragging = true; lastPX = x; lastPY = y; dragTime = 0; }
function pointerMove(x, y) {
  if (!dragging) return;
  camYaw -= (x - lastPX) * 0.005;
  camPitch = Math.max(-0.15, Math.min(1.1, camPitch + (y - lastPY) * 0.004));
  lastPX = x; lastPY = y; dragTime = 0;
}
function pointerUp() { dragging = false; }
canvas.addEventListener('mousedown', e => pointerDown(e.clientX, e.clientY));
addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY));
addEventListener('mouseup', pointerUp);

// ---------------------------------------------------------------- touch controls
const stickEl = document.getElementById('stick');
const nubEl = document.getElementById('nub');
const jumpEl = document.getElementById('jump');
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
if (isTouch) { stickEl.classList.add('on'); jumpEl.classList.add('on'); }

let stickId = null, lookId = null;
function touchXY(t) { return [t.clientX, t.clientY]; }
canvas.addEventListener('touchstart', e => {
  for (const t of e.changedTouches) {
    const [x, y] = touchXY(t);
    const r = stickEl.getBoundingClientRect();
    if (x >= r.left - 20 && x <= r.right + 20 && y >= r.top - 20 && y <= r.bottom + 20 && stickId === null) {
      stickId = t.identifier; updateStick(x, y);
    } else if (lookId === null) { lookId = t.identifier; pointerDown(x, y); }
  }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    const [x, y] = touchXY(t);
    if (t.identifier === stickId) updateStick(x, y);
    else if (t.identifier === lookId) pointerMove(x, y);
  }
}, { passive: true });
canvas.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) { stickId = null; touchMoveX = touchMoveZ = 0; nubEl.style.transform = ''; }
    else if (t.identifier === lookId) { lookId = null; pointerUp(); }
  }
}, { passive: true });
function updateStick(x, y) {
  const r = stickEl.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = x - cx, dy = y - cy;
  const mag = Math.hypot(dx, dy), max = r.width / 2;
  if (mag > max) { dx = dx / mag * max; dy = dy / mag * max; }
  nubEl.style.transform = `translate(${dx}px,${dy}px)`;
  touchMoveX = dx / max; touchMoveZ = dy / max;
}
jumpEl.addEventListener('touchstart', e => { e.preventDefault(); jumpQueued = true; }, { passive: false });

// ---------------------------------------------------------------- start veil
let started = false;
const veil = document.getElementById('veil');
document.getElementById('play').addEventListener('click', () => {
  started = true;
  veil.style.opacity = '0';
  setTimeout(() => veil.style.display = 'none', 800);
});
// let the location title fade after a while
setTimeout(() => { const l = document.getElementById('loc'); if (l) l.style.opacity = '0'; }, 6000);

// ---------------------------------------------------------------- collision
const tmpBox = new THREE.Box3();
function resolve(prevY) {
  onGround = false;
  if (heroPos.y <= 0) { heroPos.y = 0; if (heroVel.y < 0) heroVel.y = 0; onGround = true; }
  for (const b of colliders) {
    const withinXZ = heroPos.x > b.min.x - HERO_R && heroPos.x < b.max.x + HERO_R &&
                     heroPos.z > b.min.z - HERO_R && heroPos.z < b.max.z + HERO_R;
    if (!withinXZ) continue;
    const top = b.max.y, bot = b.min.y;
    // land on top
    if (heroVel.y <= 0 && prevY >= top - 0.04 && heroPos.y <= top + 0.001 && heroPos.y >= bot - 0.5) {
      heroPos.y = top; heroVel.y = 0; onGround = true; continue;
    }
    // side push-out if our body span intersects the box span
    if (heroPos.y + HERO_H > bot + 0.06 && heroPos.y < top - 0.06) {
      const dxL = heroPos.x - (b.min.x - HERO_R);
      const dxR = (b.max.x + HERO_R) - heroPos.x;
      const dzB = heroPos.z - (b.min.z - HERO_R);
      const dzF = (b.max.z + HERO_R) - heroPos.z;
      const m = Math.min(dxL, dxR, dzB, dzF);
      if (m === dxL) heroPos.x = b.min.x - HERO_R;
      else if (m === dxR) heroPos.x = b.max.x + HERO_R;
      else if (m === dzB) heroPos.z = b.min.z - HERO_R;
      else heroPos.z = b.max.z + HERO_R;
    }
  }
  // keep inside the outer courtyard
  heroPos.x = Math.max(-HALF_X + HERO_R, Math.min(HALF_X - HERO_R, heroPos.x));
}

// ---------------------------------------------------------------- update
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), moveDir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const camTarget = new THREE.Vector3(), camGoal = new THREE.Vector3();

function update(dt) {
  dragTime += dt;

  // ---- desired movement in camera space ----
  fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)).normalize();
  right.crossVectors(fwd, UP).normalize();
  let ix = 0, iz = 0;
  if (keys['w'] || keys['arrowup']) iz += 1;
  if (keys['s'] || keys['arrowdown']) iz -= 1;
  if (keys['d'] || keys['arrowright']) ix += 1;
  if (keys['a'] || keys['arrowleft']) ix -= 1;
  if (isTouch) { ix += touchMoveX; iz += -touchMoveZ; }
  moveDir.set(0, 0, 0).addScaledVector(fwd, iz).addScaledVector(right, ix);
  const inLen = Math.min(1, moveDir.length());
  if (moveDir.lengthSq() > 0.0001) moveDir.normalize();

  const running = keys['shift'] || touchRun;
  const targetSpeed = (running ? RUN_SPEED : WALK_SPEED) * inLen;

  // accelerate horizontal velocity toward target
  const desiredVX = moveDir.x * targetSpeed, desiredVZ = moveDir.z * targetSpeed;
  heroVel.x = THREE.MathUtils.damp(heroVel.x, desiredVX, 12, dt);
  heroVel.z = THREE.MathUtils.damp(heroVel.z, desiredVZ, 12, dt);

  // face movement direction
  if (inLen > 0.05) heroYaw = Math.atan2(moveDir.x, moveDir.z);

  // jump + gravity
  if (jumpQueued && onGround) { heroVel.y = JUMP_V; onGround = false; }
  jumpQueued = false;
  heroVel.y -= GRAV * dt;

  const prevY = heroPos.y;
  heroPos.x += heroVel.x * dt;
  heroPos.z += heroVel.z * dt;
  heroPos.y += heroVel.y * dt;
  resolve(prevY);

  // ---- animation ----
  const hspeed = Math.hypot(heroVel.x, heroVel.z);
  speed01 = THREE.MathUtils.damp(speed01, Math.min(1, hspeed / WALK_SPEED), 8, dt);
  const stride = running ? 1.35 : 1.0;
  walkPhase += dt * (4 + hspeed * 1.4);
  const sw = Math.sin(walkPhase), sw2 = Math.sin(walkPhase * 2);
  const amp = 0.5 * speed01 * stride;

  hero.legL.rotation.x = sw * amp;
  hero.legR.rotation.x = -sw * amp;
  hero.armL.rotation.x = -sw * amp * 0.8;
  hero.armR.rotation.x = sw * amp * 0.8;
  hero.armL.rotation.z = 0.12;
  hero.armR.rotation.z = -0.12;
  // idle breathing + run lean
  const lean = Math.min(0.32, hspeed * 0.03);
  hero.torso.rotation.x = lean + (1 - speed01) * Math.sin(walkPhase * 0.5) * 0.03;
  hero.root.position.y = heroPos.y + Math.abs(sw2) * 0.05 * speed01;
  hero.head.rotation.x = -lean * 0.6;
  if (!onGround) { // tuck in the air
    hero.legL.rotation.x = -0.5; hero.legR.rotation.x = -0.9;
    hero.armL.rotation.x = -1.4; hero.armR.rotation.x = -1.2;
  }

  hero.root.position.x = heroPos.x;
  hero.root.position.z = heroPos.z;
  hero.root.rotation.y = heroYaw;

  // cape + scarf sway (in hero-local space, trailing behind)
  animateCloth(dt, hspeed);

  // ---- camera ----
  // gentle auto-trail: if moving and not dragging recently, ease camera BEHIND
  // the hero. Camera-forward is -(sin,cos)(camYaw), so "behind" is heroYaw + PI.
  if (inLen > 0.2 && dragTime > 1.2 && hspeed > 1.5) {
    const desired = heroYaw + Math.PI;
    let d = ((desired - camYaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    camYaw += d * Math.min(1, dt * 1.5);
  }
  camTarget.set(heroPos.x, heroPos.y + 1.35, heroPos.z);
  const dist = 7.5;
  camGoal.set(
    camTarget.x + Math.sin(camYaw) * Math.cos(camPitch) * dist,
    camTarget.y + Math.sin(camPitch) * dist + 0.4,
    camTarget.z + Math.cos(camYaw) * Math.cos(camPitch) * dist
  );
  // keep the camera above the floor and inside the walls a little
  camGoal.y = Math.max(0.8, camGoal.y);
  camGoal.x = Math.max(-HALF_X - 3, Math.min(HALF_X + 3, camGoal.x));
  camera.position.lerp(camGoal, Math.min(1, dt * 6));
  camera.lookAt(camTarget);
  moon.target.position.copy(heroPos);
  // key-light sits above the hero, biased toward the camera so the front reads
  heroLight.position.set(
    heroPos.x + (camera.position.x - heroPos.x) * 0.35,
    heroPos.y + 3.4,
    heroPos.z + (camera.position.z - heroPos.z) * 0.35);

  // ---- skeletons ----
  for (const s of skeletons) {
    const dx = heroPos.x - s.x, dz = heroPos.z - s.z;
    const near = Math.hypot(dx, dz) < 7;
    s.phase += dt * 6;
    if (near) {
      s.yaw = THREE.MathUtils.damp(s.yaw, Math.atan2(dx, dz), 6, dt);   // turn to face you
      const bob = Math.sin(s.phase) * 0.35;
      s.armL.rotation.x = -1.2 + bob; s.armR.rotation.x = -1.2 - bob;   // reach out
      s.legL.rotation.x = 0; s.legR.rotation.x = 0;
    } else {
      s.z += s.dir * dt * 1.4;
      if (s.z > s.z1) { s.z = s.z1; s.dir = -1; }
      if (s.z < s.z0) { s.z = s.z0; s.dir = 1; }
      s.yaw = THREE.MathUtils.damp(s.yaw, s.dir > 0 ? 0 : Math.PI, 6, dt);
      const sw3 = Math.sin(s.phase);
      s.legL.rotation.x = sw3 * 0.5; s.legR.rotation.x = -sw3 * 0.5;
      s.armL.rotation.x = -sw3 * 0.4; s.armR.rotation.x = sw3 * 0.4;
    }
    s.root.position.set(s.x, 0, s.z);
    s.root.rotation.y = s.yaw;
  }

  // ---- torch flicker ----
  const t = performance.now() * 0.001;
  for (const tc of torches) {
    const f = 0.72 + 0.28 * (Math.sin(t * 11 + tc.x) * 0.5 + 0.5) * (0.6 + 0.4 * Math.sin(t * 27 + tc.z));
    tc.light.intensity = tc.base * f;
    if (tc.flame) { tc.flame.scale.set(0.8 + f * 0.4, 1.3 + f * 0.6, 0.8 + f * 0.4); }
  }
}

function animateCloth(dt, hspeed) {
  // Cape: a hanging drape down the back (local -Z). We walk a little "chain" from
  // the shoulders downward, each segment leaning further back the faster you go,
  // so at rest it falls straight and when running it flares out behind.
  const lift = Math.min(1, hspeed * 0.12);
  const L = 0.22;                      // segment step (< box height 0.26 → overlap, no gaps)
  let y = 1.42, z = -0.15;
  for (let i = 0; i < hero.cape.length; i++) {
    const seg = hero.cape[i];
    const wave = Math.sin(walkPhase * 1.6 + i * 0.7) * (0.05 + lift * 0.12);
    const a = 0.18 + lift * (0.7 + i * 0.12) + wave;         // angle from vertical, grows downward
    const dy = -Math.cos(a), dz = -Math.sin(a);
    seg.position.set(Math.sin(walkPhase * 2 + i) * 0.02 * (0.3 + lift), y + dy * L * 0.5, z + dz * L * 0.5);
    seg.rotation.x = a;
    seg.rotation.z = Math.sin(walkPhase * 1.4 + i) * 0.05 * (0.4 + lift);
    y += dy * L; z += dz * L;
  }
  // Scarf: short tails hanging at the front-left of the neck, flicking with motion
  const flick = Math.sin(walkPhase * 2.2) * (0.08 + hspeed * 0.02);
  let sy = 1.4, sz = 0.14;
  for (let i = 0; i < hero.scarf.length; i++) {
    const seg = hero.scarf[i];
    const a = 0.25 + i * 0.12 + flick * (0.4 + i * 0.2);
    const dy = -Math.cos(a), dz = Math.sin(a) * 0.5;
    seg.position.set(-0.05 + flick * i * 0.05, sy + dy * 0.14 * 0.5, sz + dz * 0.14 * 0.5);
    seg.rotation.x = -a * 0.5;
    seg.rotation.z = 0.2 + flick * i * 0.6;
    sy += dy * 0.14; sz += dz * 0.14;
  }
}

// ---------------------------------------------------------------- resize + loop
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => { resize(); setTimeout(resize, 300); });
resize();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (started) update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

// expose a little for debugging / headless driving (RAF pauses in background tabs)
window.__game = { hero, heroPos, heroVel, skeletons, scene, camera, keys,
  update, render: () => renderer.render(scene, camera),
  press: k => { keys[k] = true; }, release: k => { keys[k] = false; },
  jump: () => { jumpQueued = true; }, start: () => { started = true; } };
