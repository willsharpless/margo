/**
 * This file is based on https://github.com/mapbox/webgl-wind
 * by Vladimir Agafonkin
 *
 * Released under ISC License, Copyright (c) 2016, Mapbox
 * https://github.com/mapbox/webgl-wind/blob/master/LICENSE
 *
 * Adapted to field maps by Andrei Kashcha
 * Copyright (C) 2017
 */
import util from './gl-utils';
import makePanzoom from 'panzoom';
import bus from './bus';
import appState from './appState';
import wglPanZoom from './wglPanZoom';

import createScreenProgram from './programs/screenProgram';
import createDrawParticlesProgram from './programs/drawParticlesProgram';
import createDrawParticlesProgram_WAS from './programs/drawParticlesProgram_WAS';
import createCursorUpdater from './utils/cursorUpdater';
import createVectorFieldEditorState from './editor/vectorFieldState';
import createInputsModel from './createInputsModel';

/**
 * Kicks offs the app rendering. Initialized before even vue is loaded.
 *
 * @param {WebGLRenderingContext} gl
 */
export default function initScene(gl) {
  // Canvas size management
  var canvasRect = { width: 0, height: 0, top: 0, left: 0 };
  setWidthHeight(gl.canvas.width, gl.canvas.height);
  window.addEventListener('resize', onResize, true);

  // Video capturing is available in super advanced mode. You'll need to install
  // and start https://github.com/greggman/ffmpegserver.js
  // Then type in the console: window.startRecord();
  // This will trigger frame-by-frame recording (it is slow). To stop it, call window.stopRecord();
  bus.on('start-record', startRecord);
  bus.on('stop-record', stopRecord);
  var currentCapturer = null;

  // TODO: It feels like bounding box management needs to be moved out from here.
  // TODO: bbox needs to be a class with width/height properties.
  var bbox = appState.getBBox() || {};
  var currentPanZoomTransform = {
    scale: 1,
    x: 0,
    y: 0
  };

  // Boundary Condition, i.e. Target
  var bc = appState.getBC() || {};
  var bc_drawing_mode = false;
  var drawing_click_sum = 0;

  var field_mode = false;

  // How many particles do we want?
  var particleCount = appState.getParticleCount();

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.STENCIL_TEST);

  // Context variable is a way to share rendering state between multiple programs. It has a lot of stuff on it.
  // I found that it's the easiest way to work in state-full world of WebGL.
  // Until I discover a better way to write WebGL code.
  var ctx = {
    gl,
    bbox,
    field_mode,
    canvasRect,

    bc,
    bc_drawing_mode,
    drawing_click_sum,

    inputs: null,

    framebuffer: gl.createFramebuffer(),

    // This is used only to render full-screen rectangle. Main magic happens inside textures.
    quadBuffer: util.createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])),

    colorMode: appState.getColorMode(),
    colorFunction: appState.getColorFunction(),

    // This defines texture unit for screen rendering. First few indices are taken by textures
    // that compute particles position/color
    // TODO: I need to find a better way to manage this.
    screenTextureUnit: 3,

    integrationTimeStep: appState.getIntegrationTimeStep(),

    // On each frame the likelihood for a particle to reset its position is this:
    dropProbability: appState.getDropProbability(),

    // current frame number. Reset every time when new shader is compiled
    frame: 0,

    // Information about mouse cursor. Could be useful to simplify
    // exploration
    cursor: {
      // Where mouse was last time clicked (or tapped)
      clickX: 0, clickY: 0,
      // where mouse was last time moved. If this is a touch device
      // this is the same as clickX, clickY
      hoverX: 0, hoverY: 0
    },

    // Texture size to store particles' positions
    particleStateResolution: 0,

    // How quickly we should fade previous frame (from 0..1)
    fadeOpacity: appState.getFadeout(),

    // Ignore this one for a moment. Yes, the app support web audio API,
    // but it's rudimentary, so... shhh! it's a secret.
    // Don't shhh on me!
    audioTexture: null
  };

  // Frame management
  var lastAnimationFrame;
  var isPaused = false;

  var inputsModel = createInputsModel(ctx);

  // screen rendering;
  var screenProgram = createScreenProgram(ctx);
  var drawProgram = createDrawParticlesProgram(ctx);
  var drawProgram_WAS = createDrawParticlesProgram_WAS(ctx);
  var cursorUpdater = createCursorUpdater(ctx);
  var vectorFieldEditorState = createVectorFieldEditorState(drawProgram);
  var vectorFieldEditorState_WAS = createVectorFieldEditorState(drawProgram_WAS);

  // particles
  updateParticlesCount(particleCount);

  var api = {
    start: nextFrame,
    stop,
    dispose,

    resetBoundingBox,
    moveBoundingBox,
    applyBoundingBox,

    setPaused,
    setBCDrawingMode,
    setFieldMode,

    getParticlesCount,
    setParticlesCount,

    setFadeOutSpeed,
    getFadeOutSpeed,

    setDropProbability,
    getDropProbability,

    getIntegrationTimeStep,
    setIntegrationTimeStep,

    setColorMode,
    getColorMode,

    vectorFieldEditorState,
    vectorFieldEditorState_WAS,

    inputsModel,

    getCanvasRect() {
      // We trust they don't do anything bad with this ...
      return canvasRect;
    },

    getBoundingBox() {
      // again, we trust. Maybe to much?
      return ctx.bbox;
    },

    getBoundaryConditionBox() {
      // not sure if needed, but making to have
      return ctx.bc;
    }
  }

  var panzoom = initPanzoom();
  restoreBBox();

  setTimeout(() => {
    bus.fire('scene-ready', api);
  })

  return api;

  function moveBoundingBox(changes) {
    if (!changes) return;
    var parsedBoundingBox = Object.assign({}, ctx.bbox);

    assignIfPossible(changes, 'minX', parsedBoundingBox);
    assignIfPossible(changes, 'minY', parsedBoundingBox);
    assignIfPossible(changes, 'maxX', parsedBoundingBox);
    assignIfPossible(changes, 'maxY', parsedBoundingBox);

    // for Y axis changes we need to preserve aspect ration, which means
    // we also need to change X...
    if (changes.minY !== undefined || changes.maxY !== undefined) {
      // adjust values for X
      var heightChange = Math.abs(parsedBoundingBox.minY - parsedBoundingBox.maxY)/Math.abs(ctx.bbox.minY - ctx.bbox.maxY);
      var cx = (ctx.bbox.maxX + ctx.bbox.minX)/2;
      var prevWidth = (ctx.bbox.maxX - ctx.bbox.minX)/2;
      parsedBoundingBox.minX = cx - prevWidth * heightChange;
      parsedBoundingBox.maxX = cx + prevWidth * heightChange;

    }

    applyBoundingBox(parsedBoundingBox);
  }

  function assignIfPossible(change, key, newBoundingBox) {
    var value = Number.parseFloat(change[key]);
    if (Number.isFinite(value)) {
      newBoundingBox[key] = value;
    }
  }

  function startRecord(capturer) {
    currentCapturer = capturer;
  }

  function stopRecord() {
    currentCapturer = null;
  }

  function setColorMode(x) {
    var mode = parseInt(x, 10);
    appState.setColorMode(mode);
    ctx.colorMode = appState.getColorMode();
    drawProgram.updateColorMode(mode);
    drawProgram_WAS.updateColorMode(mode);
  }

  function getColorMode() {
    return appState.getColorMode();
  }

  function getIntegrationTimeStep() {
    return appState.getIntegrationTimeStep();
  }

  function setIntegrationTimeStep(x) {
    var f = parseFloat(x);
    if (Number.isFinite(f)) {
      ctx.integrationTimeStep = f;
      appState.setIntegrationTimeStep(f);
      bus.fire('integration-timestep-changed', f);
    }
  }

  function setPaused(shouldPause) {
    isPaused = shouldPause;
    nextFrame();
  }

  function setBCDrawingMode(shouldBCDrawingMode) {
    ctx.cursor.clickX = 0.;
    ctx.cursor.clickY = 0.;
    ctx.bc_drawing_mode = shouldBCDrawingMode;
    // nextFrame(); // do I need this?
  }

  function setFieldMode(shouldFieldMode) {
    ctx.field_mode = shouldFieldMode;
    // nextFrame(); // do I need this?
  }

  // Main screen fade out configuration
  function setFadeOutSpeed(x) {
    var f = parseFloat(x);
    if (Number.isFinite(f)) {
      ctx.fadeOpacity = f;
      appState.setFadeout(f);
    }
  }

  function getFadeOutSpeed() {
    return appState.getFadeout();
  }

  // Number of particles configuration
  function getParticlesCount() {
    return appState.getParticleCount();
  }

  function setParticlesCount(newParticleCount) {
    if (!Number.isFinite(newParticleCount)) return;
    if (newParticleCount === particleCount) return;
    if (newParticleCount < 1) return;

    updateParticlesCount(newParticleCount);

    particleCount = newParticleCount;
    appState.setParticleCount(newParticleCount);
  }

  // drop probability
  function setDropProbability(x) {
    var f = parseFloat(x);
    if (Number.isFinite(f)) {
      // TODO: Do I need to worry about duplication/clamping?
      appState.setDropProbability(f);
      ctx.dropProbability = f;
    }
  }

  function getDropProbability() {
    return appState.getDropProbability();
  }

  function onResize() {
    if (!ctx.bc_drawing_mode) {
      setWidthHeight(window.innerWidth, window.innerHeight);

      screenProgram.updateScreenTextures();

      updateBoundingBox(currentPanZoomTransform);
    }
  }

  function setWidthHeight(w, h) {
    var dx = Math.max(w * 0.02, 30);
    var dy = Math.max(h * 0.02, 30);
    canvasRect.width = w + 2 * dx;
    canvasRect.height = h + 2 * dy;
    canvasRect.top = - dy;
    canvasRect.left = - dx;


    let canvas = gl.canvas;
    canvas.width = canvasRect.width;
    canvas.height = canvasRect.height;
    canvas.style.left = (-dx) + 'px';
    canvas.style.top = (-dy) + 'px';
  }

  function dispose() {
      stop();
      panzoom.dispose();
      window.removeEventListener('resize', onResize, true);
      cursorUpdater.dispose();
      vectorFieldEditorState.dispose();
      vectorFieldEditorState_WAS.dispose();
  }

  function nextFrame() {
    if (lastAnimationFrame) return;

    if (isPaused) return;

    lastAnimationFrame = requestAnimationFrame(draw);
  }

  function stop() {
    cancelAnimationFrame(lastAnimationFrame);
    lastAnimationFrame = 0;
  }

  function draw() {
    lastAnimationFrame = 0;

    drawScreen();

    if (currentCapturer) currentCapturer.capture(gl.canvas);

    nextFrame();
  }

  function drawScreen() {
    screenProgram.fadeOutLastFrame()
    // TODO WAS: make seperate fade out speed for bc texture (value texture ok)

    if (ctx.field_mode) {
      drawProgram.drawParticles();
    }

    if (ctx.bc_drawing_mode && ctx.drawing_click_sum % 3 != 0) {
      if (ctx.drawing_click_sum % 3 == 1) {
        drawProgram_WAS.convertCursor2bcParams();
      }
      drawProgram_WAS.drawParticles();
    }
    // else {
    //   drawProgram.drawParticles();
    // }

    screenProgram.renderCurrentScreen();

    if (ctx.field_mode) {
      drawProgram.updateParticlesPositions();
    }
    if (ctx.bc_drawing_mode && ctx.drawing_click_sum % 3 != 0) {
      drawProgram_WAS.updateParticlesPositions(); // actual bc texture will not need this
    }
    // else {
    //   drawProgram.updateParticlesPositions();
    // }

    // TODO WAS: if ctx.bc_drawing_mode, pause or slow & gray particles?
    // TODO WAS: if ctx.bc_drawing_mode done, start value evolution (and reverse particle flow?)
    // note, particle slowing and reversing could be done by decaying or making negative the field!
  }

  function updateParticlesCount(numParticles) {
    // we create a square texture where each pixel will hold a particle position encoded as RGBA
    ctx.particleStateResolution = Math.ceil(Math.sqrt(numParticles));
    drawProgram.updateParticlesCount();
    drawProgram_WAS.updateParticlesCount();
  }

  function initPanzoom() {
    let initializedPanzoom = makePanzoom(gl.canvas, {
      controller: wglPanZoom(gl.canvas, updateBoundingBox)
    });

    return initializedPanzoom;
  }

  function restoreBBox() {
    var savedBBox = appState.getBBox();
    var {width, height} = canvasRect;

    let sX = Math.PI * Math.E;
    let sY = Math.PI * Math.E;
    let tX = 0;
    let tY = 0;
    if (savedBBox) {
      sX = savedBBox.maxX - savedBBox.minX;
      sY = savedBBox.maxY - savedBBox.minY;
      // TODO: Not sure if this is really the best way to do it.
      // var ar = width/height;
      tX = width * (savedBBox.minX + savedBBox.maxX)/2;
      tY = width * (savedBBox.minY + savedBBox.maxY)/2;
    }

    var w2 = sX * width/2;
    var h2 = sY * height/2;
    panzoom.showRectangle({
      left: -w2 + tX,
      top: -h2 - tY,
      right: w2 + tX,
      bottom: h2 - tY ,
    });
  }

  function updateBoundingBox(transform) {
    screenProgram.boundingBoxUpdated = true;

    currentPanZoomTransform.x = transform.x;
    currentPanZoomTransform.y = transform.y;
    currentPanZoomTransform.scale = transform.scale;

    var {width, height} = canvasRect;

    var minX = clientX(0);
    var minY = clientY(0);
    var maxX = clientX(width);
    var maxY = clientY(height);

    // we divide by width to keep aspect ratio
    // var ar = width/height;
    var p = 10000;
    bbox.minX = Math.round(p * minX/width)/p;
    bbox.minY = Math.round(p * -minY/width)/p;
    bbox.maxX = Math.round(p * maxX/width)/p;
    bbox.maxY = Math.round(p * -maxY/ width)/p;


    appState.saveBBox(bbox);

    bus.fire('bbox-change', bbox);

    function clientX(x) {
      return (x - transform.x)/transform.scale;
    }

    function clientY(y) {
      return (y - transform.y)/transform.scale;
    }
  }

  function resetBoundingBox() {
    var w = Math.PI * Math.E * 0.5;
    var h = Math.PI * Math.E * 0.5;

    applyBoundingBox({
      minX: -w,
      minY: -h,
      maxX: w,
      maxY: h
    })
  }

  function applyBoundingBox(boundingBox) {
    appState.saveBBox(boundingBox);
    restoreBBox();
    // a hack to trigger panzoom event
    panzoom.moveBy(0, 0, false);
  }
}
