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
import createGeneralEditorState from './editor/codeState';
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

  let keysPressed = {};
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);

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

  // Some Colors
  var field_color = [1., 1., 1., 1.]; // white
  var field_color_second = [0.949, 0.768, 0.306, 1.0]; // gold
  var reach_color = [46/255, 121/255, 199/255, 0.9];  // blue
  var avoid_color = [223/255, 28/255, 28/255, 0.85];  // red
  var value_color = [245/255, 50/255, 145/255, 1.0];  // magenta for now
  // var value_color = [1., 1., 1., 1.];  // 

  // Boundary Condition, i.e. Target
  var bc = appState.getBC() || {};
  var bc_showing_mode = true;
  var bc_drawing_mode = false;
  var value_mode = false;
  var value_transfer = false;
  var bc_flip_mode = false;
  var bc_default_mode = false;
  var draw_fill = false;
  var bc_reach_mode = true; // if false, then avoid
  // var bbox_at_bc_enc = appState.getBBox() || {};
  var bbox_at_bc_enc = JSON.parse(JSON.stringify(bbox));
  var draw_thresh = 0.015; // TODO: make all this editabdle
  var draw_levels = false;
  var draw_level_step = 0.25;
  var diff_mag = 1.0; // TODO: make all this editable
  var drawing_click_sum = 0;
  var no_bc_encoded = true;
  var no_reach_bc_encoded = true;
  var no_avoid_bc_encoded = true;

  var field_mode = true;

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
    bbox_at_bc_enc,
    bc_showing_mode,
    bc_drawing_mode,
    no_bc_encoded,
    no_reach_bc_encoded,
    no_avoid_bc_encoded,
    value_mode,
    value_transfer,
    bc_reach_mode,
    bc_flip_mode,
    draw_fill,
    draw_levels,
    drawing_click_sum,
    draw_thresh,
    draw_level_step,
    diff_mag,

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

    cursor_last: {
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
    // WAS - these comments precede me, but damn would audio be cool
    // especially if the field reacted to it...!
    audioTexture: null
  };

  // Frame management
  var lastAnimationFrame;
  var isPaused = false;

  var inputsModel = createInputsModel(ctx);

  // screen rendering;
  var screenProgram = createScreenProgram(ctx);

  // var drawProgram = createDrawParticlesProgram_WAS(ctx, 0, );
  var drawProgramField = createDrawParticlesProgram_WAS(ctx, 0, field_color, field_color_second);
  // var drawProgramField2 = createDrawParticlesProgram_WAS(ctx, 0, field_color_second, field_color_second);
  var drawProgramBC = createDrawParticlesProgram_WAS(ctx, 1, reach_color, avoid_color); // Boundary Condition Program
  var drawProgramValue = createDrawParticlesProgram_WAS(ctx, 2, value_color, value_color); // Value Program

  var cursorUpdater = createCursorUpdater(ctx);

  // var vectorFieldEditorState = createVectorFieldEditorState(drawProgramField);
  // var vectorField2EditorState = createVectorFieldEditorState(drawProgramField2);
  var vectorFieldEditorState = createGeneralEditorState(drawProgramField, 0);

  // var bcEditorState = createVectorFieldEditorState(drawProgramBC);
  var bcEditorState = createGeneralEditorState(drawProgramBC, 1);
  // var valueEditorState = createVectorFieldEditorState(drawProgramValue);
  var valueEditorState = createGeneralEditorState(drawProgramValue, 2);

  // particles
  updateParticlesCount(particleCount);
  drawProgramValue.updateColorMode(3);

  // values
  // drawProgramBC.encodeBCValue()

  var api = {
    ctx,
    start: nextFrame,
    stop,
    dispose,

    resetBoundingBox,
    moveBoundingBox,
    applyBoundingBox,

    setPaused,
    setBCDrawingMode,
    setBCShowingMode,
    setDrawFill,
    setDrawLevels,
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
    // vectorField2EditorState,
    bcEditorState,
    valueEditorState,

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
  console.log("bbox", bbox)
  restoreBBox();
  // console.log("bbox after restore", bbox)

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
    drawProgramField.updateColorMode(mode);
    // drawProgramField2.updateColorMode(mode);
    drawProgramBC.updateColorMode(mode);
    // drawProgramValue.updateColorMode(mode);
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
    console.log("DRAWING MODE", ctx.bc_drawing_mode)
    // nextFrame(); // do I need this?
  }

  function setBCShowingMode(shouldBCShowingMode) {
    ctx.bc_showing_mode = shouldBCShowingMode;
    // nextFrame(); // do I need this?
  }

  function setDrawFill(shouldDrawFill) {
    ctx.draw_fill = shouldDrawFill;
    // nextFrame(); // do I need this?
  }

  function setDrawLevels(shouldDrawLevels) {
    ctx.draw_levels = shouldDrawLevels;
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
      window.removeEventListener('keydown', onKeyUp, true);
      window.removeEventListener('keyup', onKeyUp, true);
      cursorUpdater.dispose();
      drawProgramBC.dispose();
      drawProgramField.dispose();
      // drawProgramField2.dispose();
      drawProgramValue.dispose();
      vectorFieldEditorState.dispose();
      // vectorField2EditorState.dispose();
      bcEditorState.dispose();
      valueEditorState.dispose();
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


  // DRAWING FUNCTION //
  // panzoom.moveBy(0, 0, false);
  // panzoom.dispose();
  // maybe we can turn this on by pressing w or z? 
  // do I have to force deletion? should I give a warning? 
  // maybe I could just shift the old parameter (centers) by the change in bbox center? so we can keep previous drawings

  function drawScreen() {
    screenProgram.fadeOutLastFrame()

    if (ctx.field_mode) {
      drawProgramField.drawParticles();
      // drawProgramField2.drawParticles();
    }

    if (ctx.value_mode && !ctx.value_transfer) {
      drawProgramValue.drawParticles(); // only works after recompilation
    }

    // Boundary Condition Drawing
    if (ctx.bc_drawing_mode) {
      
      if (ctx.cursor.clickX == 0. && ctx.cursor.clickY == 0.) {
        ctx.cursor.clickX = ctx.cursor.hoverX;
        ctx.cursor.clickY = ctx.cursor.hoverY;
      }

      if (ctx.drawing_click_sum % 2 == 0) { // bc dynamic only after first click
        drawProgramBC.convertCursor2bcParams();
      }
      // if (bc_default_mode) {
      //   drawProgramBC.encodeBCValue();
      //   console.log('default bc encoded');
      //   bc_default_mode = false;
      // }
    }
    if (ctx.bc_showing_mode) {
      drawProgramBC.drawParticles(); // bc stays after second
    }

    // TODO WAS: is there a way to make a seperate fade out rate for bc? (value texture ok)
    screenProgram.renderCurrentScreen();

    if (ctx.field_mode) {
      drawProgramField.updateParticlesPositions();
      // drawProgramField2.updateParticlesPositions();
    }
    // if (ctx.bc_drawing_mode && ctx.drawing_click_sum % 3 != 0) {
    //   drawProgramBC.updateParticlesPositions();
    // }
    
    if (ctx.value_mode) {
      drawProgramValue.updateParticlesPositions(drawProgramBC.updatePositionProgram.getTextures());
      if (ctx.value_transfer) { ctx.value_transfer = false; }
    }

    // TODO WAS: if ctx.bc_drawing_mode, pause or slow & gray particles? 
    // TODO WAS: if ctx.bc_drawing_mode done, start value evolution (and reverse particle flow?)
    // note, particle slowing/reversing could be done by simply altering field...
  }


  // //


  function updateParticlesCount(numParticles) {
    // we create a square texture where each pixel will hold a particle position encoded as RGBA
    ctx.particleStateResolution = Math.ceil(Math.sqrt(numParticles));
    drawProgramField.updateParticlesCount();
    // drawProgramField2.updateParticlesCount();
    drawProgramBC.updateParticlesCount(); // don't think needed
    drawProgramValue.updateParticlesCount(); // don't think needed
    //TODO WAS: two separate user-defined params for particle count and value grid size
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

    // let sX = Math.PI * Math.E;
    // let sY = Math.PI * Math.E;

    // WAS edit to simplify debug
    let sX = 4.;
    let sY = 4.;

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
    console.log("savedBBox", savedBBox)
    console.log("ctx.bbox", bbox)
    panzoom.showRectangle({
      left: -w2 + tX,
      top: -h2 - tY,
      right: w2 + tX,
      bottom: h2 - tY ,
    });
    // bizarre: cannot directly show, but the og fix isn't perfect and either way doesnt change Bbox
    // if (savedBBox) {
    //   panzoom.showRectangle({
    //     left: savedBBox.minX,
    //     top: savedBBox.maxY,
    //     right: savedBBox.maxX,
    //     bottom: savedBBox.minY,
    //   });
    // }
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
    // var w = Math.PI * Math.E * 0.5;
    // var h = Math.PI * Math.E * 0.5;

    // WAS edit to simplify for debug
    // var w = 4. * 0.5;
    // var h = 4. * 0.5;
    var w = 2.;
    var h = 2.;

    applyBoundingBox({
      // // OFFSET SQUARE
      // minX: -w + w/2,
      // minY: -h + h/2,
      // maxX: w + w/2,
      // maxY: h + h/2
      // SQUARE
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

  function onKeyDown(e) {
    keysPressed[e.key] = true;
    if (e.which === 13 && e.target === document.body) { // ENTER for BC Drawing Transfer
      drawProgramBC.updateParticlesPositions()
      drawProgramBC.updateParticlesPositions()
      e.preventDefault(); // do I need this?
      console.log("bc encoded")
    }
  }

  function onKeyUp(e) {
    delete keysPressed[e.key];
  }
}
