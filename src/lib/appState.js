import queryState from 'query-state';
import bus from './bus';
import ColorModes from './programs/colorModes';
import wrapVectorField from './wrapVectorField';
import isSmallScreen from './isSmallScreen';

/**
 * The state of the fieldplay is stored in the query string. This is the
 * only place where query string can be manipulated or fetched.
 */

var qs = queryState({}, {
  useSearch: true,
  // Older version of the app used hash to store application arguments.
  // Turns out hash is not good for websites like reddit. They can block
  // url, saying "url was already submitted" if the only part that is different
  // is hash. So, we switch to search string, and maintain backward compatibility
  // for fields created before.
  rewriteHashToSearch: true
});

var currentState = qs.get();

var defaultVectorField = wrapVectorField(`v.x = 0.1 * p.y;
  v.y = -0.2 * p.y;`);

var pendingSave;
var defaults = {
  timeStep: 0.01,
  dropProbability: 0.0001,
  particleCount: 1000000, // FIXME WAS: Separate particle count for value textures
  fadeout: .999,
  colorMode: ColorModes.UNIFORM
}
// TODO: slowly populate the particles into the screen (instead of all at once)
// idea: random percentage (if state) based on frame var in vertex shader

let settingsPanel = {
  // collapsed: isSmallScreen(),
  collapsed: true,
};

export default {
  settingsPanel,
  saveBBox,
  getBBox,
  makeBBox,

  getBC, // TODO: make/save fns for editor

  getQS() { return qs; },
  saveCode,
  getCode,
  getDefaultCode,

  getDropProbability,
  setDropProbability,

  getIntegrationTimeStep,
  setIntegrationTimeStep,

  getParticleCount,
  setParticleCount,

  getFadeout,
  setFadeout,

  getColorMode,
  setColorMode,

  getColorFunction,
  setColorFunction
}

qs.onChange(function() {
  bus.fire('scene-ready', window.scene);
});

function getColorMode() {
  let colorMode = qs.get('cm');
  return defined(colorMode) ? colorMode : defaults.colorMode;
}

function setColorMode(colorMode) {
  if (!defined(colorMode)) return;
  qs.set({cm: colorMode});
  currentState.cm = colorMode;
}

function getColorFunction() {
  let colorFunction = qs.get('cf');
  return colorFunction || '';
}

function setColorFunction(colorFunction) {
  qs.set({cf: colorFunction});
  currentState.cf = colorFunction;
}

function getFadeout() {
  let fadeout = qs.get('fo');
  return defined(fadeout) ? fadeout : defaults.fadeout;
}

function setFadeout(fadeout) {
  if (!defined(fadeout)) return;
  qs.set({fo: fadeout});
  currentState.fo = fadeout;
}

function getParticleCount() {
  let particleCount = qs.get('pc');
  return defined(particleCount) ? particleCount : defaults.particleCount;
}

function setParticleCount(particleCount) {
  if (!defined(particleCount)) return;
  qs.set({pc: particleCount});
  currentState.pc = particleCount;
}

function getIntegrationTimeStep() {
  let timeStep = qs.get('dt');
  return defined(timeStep) ? timeStep : defaults.timeStep;
}

function setIntegrationTimeStep(dt) {
  if (!defined(dt)) return;
  qs.set({dt: dt})
  currentState.dt = dt;
}

function getDropProbability() {
  let dropProbability = qs.get('dp');
  return defined(dropProbability) ? dropProbability : defaults.dropProbability;
}

function setDropProbability(dropProbability) {
  if (!defined(dropProbability)) return;
  clamp(dropProbability, 0, 1);
  qs.set({dp: dropProbability})
}

function getBC() {
  // return {
  //   minX: -1.,
  //   maxX: 1.,
  //   minY: -1.,
  //   maxY: 1.,
  // };
  return {
    cx: 0.,
    cy: 0.,
    qx: 1.,
    qy: 1.,
    shape: 1, // 1 : square, 2 : circle, TODO WAS 3 for free draw (gonna need some math)
  };
}

function getBBox() {
  let cx = qs.get('cx');
  let cy = qs.get('cy');
  let w = qs.get('w');
  let h = qs.get('h');
  return makeBBox(cx, cy, w, h);
}

function makeBBox(cx, cy, w, h) {
  let bboxDefined = defined(cx) && defined(cy) && defined(w) && defined(h);
  if (!bboxDefined) return;

  let w2 = w/2;
  let h2 = h/2;
  var p = 10000;
  return {
    minX: Math.round(p * (cx - w2))/p,
    maxX: Math.round(p * (cx + w2))/p,
    minY: Math.round(p * (cy - h2))/p,
    maxY: Math.round(p * (cy + h2))/p
  };
}

function saveBBox(bbox, immediate = false) {
  bbox = {
    cx: (bbox.minX + bbox.maxX) * 0.5,
    cy: (bbox.minY + bbox.maxY) * 0.5,
    w: (bbox.maxX - bbox.minX),
    h: (bbox.maxX - bbox.minX)
  }

  if (bbox.w <= 0 || bbox.h <= 0) return;

  currentState.cx = bbox.cx;
  currentState.cy = bbox.cy;
  currentState.w = bbox.w;
  currentState.h = bbox.h;

  if(pendingSave) {
    clearTimeout(pendingSave);
    pendingSave = 0;
  }

  if (immediate) qs.set(bbox);
  else {
    pendingSave = setTimeout(() => {
      pendingSave = 0;
      qs.set(bbox);
    }, 300);
  }
}

function getCode() {
  var vfCode = qs.get('vf');
  if (vfCode) return vfCode;

  // If we didn't get code yet, let's try read to read it from previous version
  // of the API.
  // TODO: Need to figure out how to develop this in backward/future compatible way.
  var oldCode = qs.get('code');
  if (oldCode) {
    vfCode = wrapVectorField(oldCode);
    // side effect - let's clean the old URL
    delete(currentState.code);
    qs.set('vf', vfCode);
    return vfCode;
  }

  return defaultVectorField;
}

function getDefaultCode() {
  return defaultVectorField;
}

function saveCode(code) {
  qs.set({
    vf: code
  });
  currentState.code = code;
}

function defined(number) {
  return Number.isFinite(number);
}

function clamp(x, min, max) {
  return x < min ? min :
        (x > max) ? max : x;
}
