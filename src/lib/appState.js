import queryState from 'query-state';
import bus from './bus';
import ColorModes from './programs/colorModes';
import wrapVectorField from './wrapVectorField';
import wrapBoundaryCondition from './wrapBoundaryCondition';
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

var defaultVectorFieldCode = wrapVectorField(`v.x = -0.2 * s.x + 0.1 * s.y;
  v.y = -0.1 * s.x - 0.2 * s.y;`);

var defaultBoundaryConditionCode = wrapBoundaryCondition(`float bc_val = 0.5 * (max(abs(s.x), abs(s.y)) - 1.); // unit box
  // float bc_val = 0.5 * (length(s) - 1.); // unit ball`);

var defaultValueCode = `
// Hamiltonian
float get_hamiltonian(vec2 state, vec2 costate, float time, float value) {
  float ham = -dot(costate, get_velocity(state));
  return ham;
}

// Value Alteration (after update)
float value_alteration(float newValue, float reach_bc, float avoid_bc) {
  float newValueAltered = newValue; // BRS
  // float newValueAltered = min(reach_bc, newValue); // BRT
  // float newValueAltered = max(min(reach_bc, newValue), avoid_bc); // BRAT
  return newValueAltered;
}

`;

var texture_type;

var pendingSave;
var defaults = {
  timeStep: 0.001,
  dropProbability: 0.000125,
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

let settingsmomentumPanel = {
  // collapsed: isSmallScreen(),
  collapsed: true,
};

export default {
  settingsPanel,
  settingsmomentumPanel,
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
  // Initial Shape!
  
  // // First Quadrant Sqr
  // return {
  //   cx: 0.5,
  //   cy: 0.5,
  //   qx: 0.5,
  //   qy: 0.5,
  //   shape: 1, 
  // };

  // Center Circle
  // return {
  //   cx: 0.,
  //   cy: 0.,
  //   qx: 1.,
  //   qy: 1.,
  //   shape: 2, // 1 : square, 2 : circle, TODO WAS 3 for free draw (gonna need some math)
  // };

  // Center Sqr
  return {
    cx: 0.,
    cy: 0.,
    qx: 0.5,
    qy: 0.5,
    shape: 1, // 1 : square, 2 : circle, TODO WAS 3 for free draw (gonna need some math)
  };

    // // Center Cyclinder
    // return {
    //   cx: 0.,
    //   cy: 0.,
    //   qx: 0.5,
    //   qy: 3.4028234663852886e+38,
    //   shape: 1, // 1 : square, 2 : circle, TODO WAS 3 for free draw (gonna need some math)
    // };
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

function getCode(texture_type=0) {
  var anyCode
  if (texture_type == 0) {
    anyCode = qs.get('vf');
  } else if (texture_type == 1) {
    anyCode = false;
    // anyCode = qs.get('bc');
  } else if (texture_type == 2) {
    anyCode = false;
    // anyCode = qs.get('val');
  }
  if (anyCode) return anyCode;

  // If we didn't get code yet, let's try read to read it from previous version
  // of the API.
  // TODO: Need to figure out how to develop this in backward/future compatible way.
  if (texture_type == 0) {
    var oldCode = qs.get('code');
    if (oldCode) {
      vfCode = wrapVectorField(oldCode);
      // side effect - let's clean the old URL
      delete(currentState.code);
      qs.set('vf', vfCode);
      return vfCode;
    }
  } else if (texture_type == 1) {
    // var oldCode = qs.get('codeham');
    // if (oldCode) {
    //   hamCode = wrapHam(oldCode);
    //   // side effect - let's clean the old URL
    //   delete(currentState.hamcode);
    //   qs.set('ham', hamCode);
    //   return hamCode;
    // }
  } else if (texture_type == 2) {
    // var oldCode = qs.get('codeval');
    // if (oldCode) {
    //   valCode = wrapVal(oldCode);
    //   // side effect - let's clean the old URL
    //   delete(currentState.valcode);
    //   qs.set('val', valCode);
    //   return valCode;
    // }
  }

  return getDefaultCode(texture_type);
}

function getDefaultCode(texture_type=0) {
  var defaultCode;
  if (texture_type == 0) {
    defaultCode = defaultVectorFieldCode;
  } else if (texture_type == 1) {
    defaultCode = defaultBoundaryConditionCode;
  } else if (texture_type == 2) {
    // defaultCode = defaultVectorFieldCode + '\n\n' + defaultValueCode;
    defaultCode = defaultValueCode;
  }
  return defaultCode;
}

function saveCode(code, texture_type=0) {
  if (texture_type == 0) {
    qs.set({
      vf: code
    });
    currentState.code = code;
  } else if (texture_type == 1) { // dont do anything for now
    // qs.set({
    //   ham: code
    // });
    // currentState.code = code;
  } else if (texture_type == 2) {
    // qs.set({
    //   val: code
    // });
    // currentState.code = code;
  }
}

function defined(number) {
  return Number.isFinite(number);
}

function clamp(x, min, max) {
  return x < min ? min :
        (x > max) ? max : x;
}
