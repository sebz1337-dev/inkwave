// INKWAVE — Interactive Character Sculptor & Editor
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Character, SKIN_TONES, OUTFITS } from '../src/game/character.js';
import { countTriangles, clearGeoCache } from '../src/game/character-geo.js';
import {
  FACE_PARAMS, DEFAULT_FACE_PARAMS, applyFaceConfig, resetFaceConfig, HEAD_C,
} from '../src/game/character-face.js';
import { TEAM_PALETTES } from '../src/config.js';
import { G } from '../src/core/ctx.js';

// ------------------------------------------------------------------------------------------------
// Three.js Scene Setup
// ------------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#10121a');

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 50);
camera.position.set(0, 1.22, 1.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(HEAD_C.x, HEAD_C.y, HEAD_C.z);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.2;
controls.maxDistance = 6.0;

// Studio lighting — same environment rig as character-lab / the game: a sky dome PMREM'd into
// scene.environment fills the unlit side of the head. Without it the round chin's shadow side
// falls to near-black and the skin's SSS terminator band reads as a burnt patch at the head base.
function makeSky() {
  const g = new THREE.SphereGeometry(80, 48, 24);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#5fa8ff') }, hor: { value: new THREE.Color('#dff1ff') }, bot: { value: new THREE.Color('#e9e2d6') }, sun: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sun; varying vec3 vD;
      void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0), 0.6)) : mix(hor, bot, clamp(-y*3.0,0.0,1.0));
        float s = max(dot(vD, sun), 0.0); c += vec3(1.0,0.95,0.85) * (pow(s, 900.0) * 30.0 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(g, m);
}
{ // environment only — the dark studio backdrop stays
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(makeSky());
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
}

const hemi = new THREE.HemisphereLight('#d6e8ff', '#bfae90', 0.75);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight('#fff4e2', 2.2);
keyLight.position.set(1.8, 2.8, 2.2);
keyLight.target.position.copy(HEAD_C);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(4096, 4096);
keyLight.shadow.bias = -0.0002;
keyLight.shadow.normalBias = 0.02;   // kills the acne mottling on the curved chin
keyLight.shadow.radius = 3;
{
  const sc = keyLight.shadow.camera; sc.left = -2.5; sc.right = 2.5; sc.top = 2.5; sc.bottom = -2.5; sc.near = 0.5; sc.far = 12;
}
scene.add(keyLight, keyLight.target);

const fillLight = new THREE.DirectionalLight('#93c5fd', 0.5);
fillLight.position.set(-2.0, 1.5, 1.5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight('#ffedd5', 0.8);
rimLight.position.set(0, 2.0, -2.5);
scene.add(rimLight);

// Backdrop floor grid
const grid = new THREE.GridHelper(10, 40, '#334155', '#1e293b');
grid.position.y = 0;
scene.add(grid);

// Character State
G.scene = scene;
G.physics = { raycast: (o, d, max, out) => { out.hit = false; return out; } };
G.actors = [];

const state = {
  palette: 0,
  skin: 0,
  hair: 0,
  outfit: 0,
  weapon: 'shooter',
  shading: 'textured', // 'textured' | 'clay' | 'wire'
  dance: 'menu_idle',
  overlay: {
    visible: false,
    src: '',
    opacity: 0.5,
    scale: 1.0,
    x: 0,
    y: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
  },
};

let hero = null;
const clayMaterial = new THREE.MeshStandardMaterial({
  color: '#e2e8f0', roughness: 0.5, metalness: 0.05,
});

function teamColor() {
  const p = TEAM_PALETTES[state.palette % TEAM_PALETTES.length];
  return p.a;
}

function makeHero() {
  if (hero) hero.dispose();
  clearGeoCache();

  hero = new Character({
    color: teamColor(),
    weapon: state.weapon,
    style: { hair: state.hair, skin: state.skin, outfit: state.outfit },
    name: 'SculptLab',
    isLocal: true,
  });

  scene.add(hero.root);
  hero.setDance(state.dance);
  applyShadingMode();
  updateHud();
}

function applyShadingMode() {
  if (!hero) return;
  hero.root.traverse((o) => {
    if (o.isMesh) {
      if (state.shading === 'wire') {
        o.material.wireframe = true;
      } else {
        o.material.wireframe = false;
        if (state.shading === 'clay' && !o.name.includes('eye')) {
          o.userData._origMat = o.userData._origMat || o.material;
          o.material = clayMaterial;
        } else if (o.userData._origMat) {
          o.material = o.userData._origMat;
        }
      }
    }
  });
}

// Debounced Character Rebuild for 60fps responsiveness
let rebuildPending = false;
function requestRebuild() {
  if (rebuildPending) return;
  rebuildPending = true;
  requestAnimationFrame(() => {
    rebuildPending = false;
    applyFaceConfig(FACE_PARAMS);
    makeHero();
  });
}

// ------------------------------------------------------------------------------------------------
// Camera & View Presets
// ------------------------------------------------------------------------------------------------
const CAMS = {
  'front-flat': { pos: [0, 1.214, 4.2], target: [0, 1.214, 0], fov: 12 },
  'front-persp': { pos: [0, 1.214, 1.3], target: [0, 1.214, 0], fov: 32 },
  '34': { pos: [0.38, 1.24, 1.0], target: [0, 1.214, 0], fov: 30 },
  'side': { pos: [1.1, 1.214, 0.0], target: [0, 1.214, 0], fov: 30 },
  'eyes': { pos: [0, 1.22, 0.58], target: [0, 1.22, 0.08], fov: 24 },
  'mouth': { pos: [0, 1.15, 0.48], target: [0, 1.15, 0.08], fov: 24 },
  'full': { pos: [0, 0.85, 2.8], target: [0, 0.75, 0], fov: 38 },
};

function setCameraPreset(key) {
  const c = CAMS[key];
  if (!c) return;
  camera.fov = c.fov;
  camera.position.set(...c.pos);
  controls.target.set(...c.target);
  camera.updateProjectionMatrix();
  controls.update();

  document.querySelectorAll('#topbar .btn-group button').forEach((b) => {
    if (b.id.startsWith('cam-')) b.classList.remove('on');
  });
  const btn = document.getElementById('cam-' + key);
  if (btn) btn.classList.add('on');
}

// ------------------------------------------------------------------------------------------------
// Slider Schemas (Grouped logically for sculpting)
// ------------------------------------------------------------------------------------------------
const SLIDER_GROUPS = [
  {
    id: 'sec-head',
    sliders: [
      { key: 'hrX', label: 'Head Width', min: 0.14, max: 0.22, step: 0.001 },
      { key: 'hrY', label: 'Head Height', min: 0.14, max: 0.22, step: 0.001 },
      { key: 'hrZ', label: 'Head Depth', min: 0.13, max: 0.21, step: 0.001 },
      { key: 'crownFlat', label: 'Crown Flatten', min: 0.0, max: 0.15, step: 0.002 },
      { key: 'foreheadLean', label: 'Forehead Lean', min: 0.0, max: 0.15, step: 0.002 },
      { key: 'skullBack', label: 'Back Skull', min: 0.0, max: 0.15, step: 0.002 },
    ],
  },
  {
    id: 'sec-jaw',
    sliders: [
      { key: 'jawTaperK', label: 'Jaw Curve Power', min: 0.8, max: 2.0, step: 0.02 },
      { key: 'jawTaperX1', label: 'Lower Jaw Taper', min: 0.05, max: 0.45, step: 0.005 },
      { key: 'jawTaperX2', label: 'Mid-Jaw Taper', min: 0.0, max: 0.25, step: 0.005 },
      { key: 'jawTaperX3', label: 'Chin Taper', min: 0.05, max: 0.35, step: 0.005 },
      { key: 'chinTuckZ', label: 'Chin Tuck Z', min: 0.0, max: 0.16, step: 0.002 },
      { key: 'chinRound', label: 'Chin Button Proj', min: 0.0, max: 0.008, step: 0.0002 },
      { key: 'jawPlaneD', label: 'Under-Jaw Depth', min: 0.10, max: 0.22, step: 0.002 },
      { key: 'jawPlaneK', label: 'Under-Jaw Blend', min: 0.008, max: 0.05, step: 0.001 },
    ],
  },
  {
    id: 'sec-cheeks',
    sliders: [
      { key: 'midFaceForward', label: 'Mid-Face Proj', min: 0.0, max: 0.008, step: 0.0002 },
      { key: 'cheekVolume', label: 'Cheek Volume', min: 0.0, max: 0.016, step: 0.0002 },
      { key: 'cheekApples', label: 'Cheek Apples', min: 0.0, max: 0.012, step: 0.0002 },
      { key: 'cheekbone', label: 'Cheekbone Ridge', min: 0.0, max: 0.008, step: 0.0002 },
      { key: 'mochiCheeks', label: 'Mochi Cheek Flare', min: 0.0, max: 0.016, step: 0.0002 },
      { key: 'cheekLineSpread', label: 'Cheek Line Spread', min: 0.0, max: 0.08, step: 0.002 },
    ],
  },
  {
    id: 'sec-eyes',
    sliders: [
      { key: 'eyeAz', label: 'Eye Spacing (Az)', min: 0.28, max: 0.44, step: 0.002 },
      { key: 'eyeEl', label: 'Eye Height (El)', min: 0.04, max: 0.24, step: 0.002 },
      { key: 'eyeTilt', label: 'Eye Tilt (Cant)', min: -0.15, max: 0.35, step: 0.005 },
      { key: 'eyeYaw', label: 'Eye Yaw Outward', min: 0.05, max: 0.35, step: 0.005 },
      { key: 'eyeApertureX', label: 'Aperture Width', min: 0.35, max: 0.75, step: 0.005 },
      { key: 'eyeApertureHu', label: 'Upper Lid Arch', min: 0.40, max: 0.90, step: 0.005 },
      { key: 'eyeApertureHl', label: 'Lower Lid Arch', min: 0.40, max: 0.85, step: 0.005 },
      { key: 'eyeRx', label: 'Eyeball Radius X', min: 0.035, max: 0.08, step: 0.001 },
      { key: 'eyeRy', label: 'Eyeball Radius Y', min: 0.04, max: 0.09, step: 0.001 },
      { key: 'eyeRz', label: 'Eyeball Radius Z', min: 0.02, max: 0.06, step: 0.001 },
      { key: 'irisRadius', label: 'Iris Size', min: 0.25, max: 0.65, step: 0.005 },
      { key: 'corneaBulge', label: 'Cornea Bulge', min: 0.01, max: 0.08, step: 0.002 },
      { key: 'browRidge', label: 'Brow Ridge', min: 0.0, max: 0.008, step: 0.0002 },
      { key: 'glabella', label: 'Glabella Ridge', min: 0.0, max: 0.004, step: 0.0001 },
    ],
  },
  {
    id: 'sec-mask',
    sliders: [
      { key: 'maskLobeW', label: 'Socket Ring Width', min: 0.18, max: 0.45, step: 0.005 },
      { key: 'maskLobeH', label: 'Socket Ring Height', min: 0.18, max: 0.42, step: 0.005 },
      { key: 'maskBridgeW', label: 'Bridge Half-Width', min: 0.25, max: 0.55, step: 0.005 },
      { key: 'maskBridgeH', label: 'Bridge Height', min: 0.08, max: 0.28, step: 0.005 },
      { key: 'maskWingLen', label: 'Outer Wing Length', min: 0.4, max: 1.5, step: 0.01 },
      { key: 'maskWingCurv', label: 'Wing Sweep Curve', min: 0.08, max: 0.35, step: 0.005 },
      { key: 'maskRecess', label: 'Mask Skin Recess', min: 0.0, max: 0.002, step: 0.0001 },
    ],
  },
  {
    id: 'sec-nose-mouth',
    sliders: [
      { key: 'noseTip', label: 'Nose Button Proj', min: 0.002, max: 0.015, step: 0.0002 },
      { key: 'noseTipEl', label: 'Nose Elevation', min: -0.25, max: -0.05, step: 0.005 },
      { key: 'noseWings', label: 'Nose Wings Flare', min: 0.0, max: 0.006, step: 0.0001 },
      { key: 'nostrils', label: 'Nostril Depth', min: 0.0, max: 0.004, step: 0.0001 },
      { key: 'noseBridge', label: 'Bridge Ridge', min: 0.0, max: 0.005, step: 0.0001 },
      { key: 'subnasalTuck', label: 'Subnasal Dip', min: 0.0, max: 0.003, step: 0.0001 },
      { key: 'mouthEl', label: 'Mouth Elevation', min: -0.55, max: -0.30, step: 0.005 },
      { key: 'mouthHalfAz', label: 'Mouth Width', min: 0.06, max: 0.22, step: 0.002 },
      { key: 'mouthMound', label: 'Dental Mound', min: 0.0, max: 0.008, step: 0.0002 },
      { key: 'mentolabial', label: 'Mentolabial Fold', min: 0.0, max: 0.006, step: 0.0002 },
      { key: 'philtrum', label: 'Philtrum Groove', min: 0.0, max: 0.002, step: 0.0001 },
    ],
  },
  {
    id: 'sec-ears',
    sliders: [
      { key: 'earAz', label: 'Ear Azimuth', min: 1.2, max: 1.8, step: 0.01 },
      { key: 'earEl', label: 'Ear Elevation', min: -0.15, max: 0.1, step: 0.005 },
    ],
  },
];

// ------------------------------------------------------------------------------------------------
// Build UI Sliders
// ------------------------------------------------------------------------------------------------
const inputs = {};

function initSliders() {
  for (const group of SLIDER_GROUPS) {
    const container = document.getElementById(group.id);
    if (!container) continue;
    container.innerHTML = '';

    for (const s of group.sliders) {
      const row = document.createElement('div');
      row.className = 'sl-row';

      const label = document.createElement('span');
      label.textContent = s.label;
      label.title = s.key;

      const range = document.createElement('input');
      range.type = 'range';
      range.min = s.min;
      range.max = s.max;
      range.step = s.step;
      range.value = FACE_PARAMS[s.key] ?? DEFAULT_FACE_PARAMS[s.key];

      const num = document.createElement('input');
      num.type = 'number';
      num.min = s.min;
      num.max = s.max;
      num.step = s.step;
      num.value = (+range.value).toFixed(getDecimals(s.step));

      range.addEventListener('input', () => {
        const val = +range.value;
        num.value = val.toFixed(getDecimals(s.step));
        FACE_PARAMS[s.key] = val;
        requestRebuild();
      });

      num.addEventListener('change', () => {
        let val = Math.max(s.min, Math.min(s.max, +num.value));
        range.value = val;
        num.value = val.toFixed(getDecimals(s.step));
        FACE_PARAMS[s.key] = val;
        requestRebuild();
      });

      row.append(label, range, num);
      container.appendChild(row);

      inputs[s.key] = { range, num, step: s.step };
    }
  }

  buildHairAndStyleControls();
  buildOverlayControls();
}

function getDecimals(step) {
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  if (step >= 0.001) return 3;
  return 4;
}

function syncInputsFromParams() {
  for (const key in inputs) {
    if (FACE_PARAMS[key] !== undefined) {
      const { range, num, step } = inputs[key];
      range.value = FACE_PARAMS[key];
      num.value = (+FACE_PARAMS[key]).toFixed(getDecimals(step));
    }
  }
}

function buildHairAndStyleControls() {
  const container = document.getElementById('sec-hair');
  if (!container) return;
  container.innerHTML = '';

  // Hair Style buttons
  const hairLabel = document.createElement('div');
  hairLabel.style.fontSize = '11px';
  hairLabel.style.fontWeight = '600';
  hairLabel.textContent = 'Hairstyle:';
  const hairRow = document.createElement('div');
  hairRow.className = 'sw-row';
  ['Tide', 'Spike', 'Twin', 'Bob', 'Pony', 'Crest', 'Knot', 'Octo'].forEach((name, i) => {
    const b = document.createElement('button');
    b.textContent = name;
    if (state.hair === i) b.classList.add('on');
    b.onclick = () => {
      state.hair = i;
      hairRow.querySelectorAll('button').forEach((btn) => btn.classList.remove('on'));
      b.classList.add('on');
      makeHero();
    };
    hairRow.appendChild(b);
  });
  container.append(hairLabel, hairRow);

  // Palette swatch row
  const palLabel = document.createElement('div');
  palLabel.style.fontSize = '11px';
  palLabel.style.fontWeight = '600';
  palLabel.style.marginTop = '6px';
  palLabel.textContent = 'Ink Color:';
  const palRow = document.createElement('div');
  palRow.className = 'sw-row';
  TEAM_PALETTES.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'sw';
    b.innerHTML = `<i style="background:${p.a}"></i><i style="background:${p.b}"></i>`;
    b.onclick = () => {
      state.palette = i;
      makeHero();
    };
    palRow.appendChild(b);
  });
  container.append(palLabel, palRow);

  // Skin tones
  const skinLabel = document.createElement('div');
  skinLabel.style.fontSize = '11px';
  skinLabel.style.fontWeight = '600';
  skinLabel.style.marginTop = '6px';
  skinLabel.textContent = 'Skin Tone:';
  const skinRow = document.createElement('div');
  skinRow.className = 'sw-row';
  SKIN_TONES.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'sw';
    b.innerHTML = `<i style="background:${c}"></i>`;
    b.onclick = () => {
      state.skin = i;
      makeHero();
    };
    skinRow.appendChild(b);
  });
  container.append(skinLabel, skinRow);
}

function buildOverlayControls() {
  const container = document.getElementById('sec-overlay');
  if (!container) return;
  container.innerHTML = '';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.fontSize = '11px';
  fileInput.onchange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setOverlayImage(ev.target.result);
      };
      reader.readAsDataURL(f);
    }
  };

  const sampleBtn = document.createElement('button');
  sampleBtn.textContent = 'Load Desktop Screenshot';
  sampleBtn.onclick = () => {
    // Attempt loading the user's desktop screenshot
    setOverlayImage('/Users/scote/Desktop/Screenshot 2026-10-13 at 12.57.21.png');
  };

  // Opacity Slider
  const opRow = document.createElement('div');
  opRow.className = 'sl-row';
  opRow.innerHTML = `<span>Overlay Opacity</span><input type="range" min="0" max="1" step="0.05" value="${state.overlay.opacity}"><input type="number" min="0" max="1" step="0.05" value="${state.overlay.opacity}">`;
  const opRange = opRow.querySelector('input[type="range"]');
  const opNum = opRow.querySelector('input[type="number"]');
  opRange.oninput = () => {
    state.overlay.opacity = +opRange.value;
    opNum.value = state.overlay.opacity.toFixed(2);
    updateOverlayTransform();
  };
  opNum.onchange = () => {
    state.overlay.opacity = +opNum.value;
    opRange.value = state.overlay.opacity;
    updateOverlayTransform();
  };

  // Scale Slider
  const scRow = document.createElement('div');
  scRow.className = 'sl-row';
  scRow.innerHTML = `<span>Overlay Scale</span><input type="range" min="0.2" max="3.0" step="0.05" value="${state.overlay.scale}"><input type="number" min="0.2" max="3.0" step="0.05" value="${state.overlay.scale}">`;
  const scRange = scRow.querySelector('input[type="range"]');
  const scNum = scRow.querySelector('input[type="number"]');
  scRange.oninput = () => {
    state.overlay.scale = +scRange.value;
    scNum.value = state.overlay.scale.toFixed(2);
    updateOverlayTransform();
  };
  scNum.onchange = () => {
    state.overlay.scale = +scNum.value;
    scRange.value = state.overlay.scale;
    updateOverlayTransform();
  };

  const resetPosBtn = document.createElement('button');
  resetPosBtn.textContent = 'Reset Overlay Position';
  resetPosBtn.onclick = () => {
    state.overlay.x = 0;
    state.overlay.y = 0;
    state.overlay.scale = 1.0;
    scRange.value = 1.0;
    scNum.value = '1.00';
    updateOverlayTransform();
  };

  container.append(fileInput, sampleBtn, opRow, scRow, resetPosBtn);
}

// ------------------------------------------------------------------------------------------------
// Reference Overlay Logic (Draggable on screen)
// ------------------------------------------------------------------------------------------------
const overlayImg = document.getElementById('overlay-img');
const toggleOverlayBtn = document.getElementById('btn-toggle-overlay');

function setOverlayImage(src) {
  state.overlay.src = src;
  overlayImg.src = src;
  state.overlay.visible = true;
  toggleOverlayBtn.classList.add('on');
  updateOverlayTransform();
}

function updateOverlayTransform() {
  if (!state.overlay.visible || !state.overlay.src) {
    overlayImg.style.display = 'none';
    return;
  }
  overlayImg.style.display = 'block';
  overlayImg.style.opacity = state.overlay.opacity;
  overlayImg.style.transform = `translate(${state.overlay.x}px, ${state.overlay.y}px) scale(${state.overlay.scale})`;
}

toggleOverlayBtn.onclick = () => {
  state.overlay.visible = !state.overlay.visible;
  toggleOverlayBtn.classList.toggle('on', state.overlay.visible);
  updateOverlayTransform();
};

overlayImg.addEventListener('mousedown', (e) => {
  state.overlay.dragging = true;
  state.overlay.dragStartX = e.clientX - state.overlay.x;
  state.overlay.dragStartY = e.clientY - state.overlay.y;
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (state.overlay.dragging) {
    state.overlay.x = e.clientX - state.overlay.dragStartX;
    state.overlay.y = e.clientY - state.overlay.dragStartY;
    updateOverlayTransform();
  }
});

window.addEventListener('mouseup', () => {
  state.overlay.dragging = false;
});

// ------------------------------------------------------------------------------------------------
// Presets
// ------------------------------------------------------------------------------------------------
const CHIBI_SPLATOON_PRESET = {
  hrX: 0.174,
  hrY: 0.168,
  hrZ: 0.160,
  crownFlat: 0.055,
  foreheadLean: 0.075,
  skullBack: 0.065,
  jawTaperK: 1.45,
  jawTaperX1: 0.22,
  jawTaperX2: 0.13,
  jawTaperX3: 0.21,
  chinTuckZ: 0.088,
  chinRound: 0.0032,
  jawPlaneD: 0.165,
  jawPlaneK: 0.038,
  jawPlaneEnabled: true,
  midFaceForward: 0.0035,
  cheekVolume: 0.0072,
  cheekApples: 0.0052,
  cheekbone: 0.0022,
  mochiCheeks: 0.0062,
  cheekLineSpread: 0.038,
  eyeAz: 0.352,
  eyeEl: 0.138,
  eyeTilt: 0.115,
  eyeYaw: 0.19,
  eyeApertureX: 0.54,
  eyeApertureHu: 0.64,
  eyeApertureHl: 0.59,
  eyeRx: 0.055,
  eyeRy: 0.063,
  eyeRz: 0.036,
  irisRadius: 0.43,
  corneaBulge: 0.046,
  browRidge: 0.0022,
  glabella: 0.0008,
  maskLobeW: 0.32,
  maskLobeH: 0.30,
  maskBridgeW: 0.40,
  maskBridgeH: 0.17,
  maskWingLen: 1.05,
  maskWingCurv: 0.23,
  maskRecess: 0.0005,
  noseTip: 0.0072,
  noseTipEl: -0.126,
  noseWings: 0.0020,
  nostrils: 0.0011,
  noseBridge: 0.0018,
  subnasalTuck: 0.0009,
  mouthEl: -0.40,
  mouthHalfAz: 0.115,
  mouthMound: 0.0022,
  mentolabial: 0.0020,
  philtrum: 0.0005,
  earAz: 1.5,
  earEl: -0.035,
};

document.getElementById('btn-reset-stable').onclick = () => {
  resetFaceConfig();
  syncInputsFromParams();
  makeHero();
  showToast('Reset to Stable Baseline');
};

document.getElementById('btn-preset-chibi').onclick = () => {
  applyFaceConfig(CHIBI_SPLATOON_PRESET);
  syncInputsFromParams();
  makeHero();
  showToast('Applied Splatoon Chibi Preset');
};

// ------------------------------------------------------------------------------------------------
// Shading & HUD Controls
// ------------------------------------------------------------------------------------------------
['textured', 'clay', 'wire'].forEach((m) => {
  document.getElementById('view-' + m).onclick = (e) => {
    state.shading = m;
    document.querySelectorAll('#topbar .btn-group button').forEach((b) => {
      if (b.id.startsWith('view-')) b.classList.remove('on');
    });
    e.target.classList.add('on');
    applyShadingMode();
  };
});

function updateHud() {
  if (!hero) return;
  const tris = (countTriangles(hero.root) / 1000).toFixed(1) + 'k';
  let draws = 0;
  hero.root.traverseVisible((o) => { if (o.isMesh) draws++; });
  document.getElementById('hud-tris').textContent = tris;
  document.getElementById('hud-draws').textContent = draws;
}

// Camera preset buttons
['front', 'front-persp', '34', 'side', 'eyes', 'mouth', 'full'].forEach((k) => {
  const btn = document.getElementById('cam-' + k);
  if (btn) btn.onclick = () => setCameraPreset(k === 'front' ? 'front-flat' : k);
});

// ------------------------------------------------------------------------------------------------
// Code Export Modal
// ------------------------------------------------------------------------------------------------
const modal = document.getElementById('modal');
const modalCode = document.getElementById('modal-code');
const toast = document.getElementById('toast');

document.getElementById('btn-export-code').onclick = () => {
  const code = `// Tuned in INKWAVE Character Sculptor & Editor\nexport const TUNED_FACE_PARAMS = ${JSON.stringify(FACE_PARAMS, null, 2)};\n`;
  modalCode.value = code;
  modal.classList.add('open');
};

document.getElementById('modal-close').onclick = () => {
  modal.classList.remove('open');
};

document.getElementById('btn-copy-code').onclick = () => {
  navigator.clipboard.writeText(modalCode.value).then(() => {
    showToast('Configuration copied to clipboard!');
  });
};

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// Hotkeys
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'o') {
    toggleOverlayBtn.click();
  } else if (k === 'escape') {
    modal.classList.remove('open');
  }
});

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------------------------------------------
// Animation & Render Loop
// ------------------------------------------------------------------------------------------------
let lastTime = performance.now();
let fpsCounter = 0;
let fpsAcc = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  fpsCounter++;
  fpsAcc += dt;
  if (fpsAcc >= 0.5) {
    document.getElementById('hud-fps').textContent = Math.round(fpsCounter / fpsAcc);
    fpsCounter = 0;
    fpsAcc = 0;
  }

  controls.update();

  if (hero) {
    hero.update(dt, {
      time: now * 0.001,
      speed: 0,
      grounded: true,
      aimPitch: 0,
      firing: false,
      charge: 0,
    });
  }

  renderer.render(scene, camera);
}

// Initial Launch
initSliders();
makeHero();
setCameraPreset('front-flat');
animate(performance.now());

window.editor = {
  get hero() { return hero; },
  get camera() { return camera; },
  get controls() { return controls; },
  FACE_PARAMS,
  DEFAULT_FACE_PARAMS,
  applyFaceConfig,
  resetFaceConfig,
  makeHero,
  setCameraPreset,
  setOverlayImage,
};
