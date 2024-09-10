import util from '../gl-utils';
import DrawParticleGraph_WAS from '../shaderGraph/DrawParticleGraph_WAS';
import makeUpdatePositionProgram_WAS from './updatePositionProgram_WAS';
import { encodeFloatRGBA } from '../utils/floatPacking.js';
import config from '../config';
import createAudioProgram from './audioProgram';

/**
 * This program manages particles life-cycle. It updates particles positions
 * and initiates drawing them on screen.
 * 
 * @param {Object} ctx rendering context. Holds WebGL state
 * @param {Int} texture_type gives the type: 1 = bc texture (no tex enc/dec), 2 = value texture
 * @param {Float32Array} color gives the color fo the texture
 */
export default function drawParticlesProgram_WAS(ctx, texture_type, color) {
  var gl = ctx.gl;

  var particleStateResolution, particleIndexBuffer;
  var valueIndexBuffer;
  var numParticles;

  var currentVectorField = '';
  var updatePositionProgram = makeUpdatePositionProgram_WAS(ctx, texture_type);
  var audioProgram;

  window.addEventListener('keydown', onKey, true);

  var drawProgram;
  initPrograms();

  return {
    updateParticlesCount,
    updateParticlesPositions,
    drawParticles,
    updateCode,
    updateColorMode,
    convertCursor2bcParams,
    // transferValue,
    encodeBCValue,
    dispose,
  }

  function initPrograms() {
    // need to update the draw graph because color mode shader has changed.
    initDrawProgram();

    if (config.isAudioEnabled) {
      if (audioProgram) audioProgram.dispose();
      audioProgram = createAudioProgram(ctx);
    }
  }

  function initDrawProgram() {
    if (drawProgram) drawProgram.unload();

    const drawGraph = new DrawParticleGraph_WAS(ctx);
    const vertexShaderCode = drawGraph.getVertexShader(currentVectorField, color);
    drawProgram = util.createProgram(gl, vertexShaderCode, drawGraph.getFragmentShader());
  }

  function dispose() {
    window.removeEventListener('keydown', onKey, true);
  }

  function updateParticlesPositions() {
    if (!currentVectorField) return;

    ctx.frame += 1
    ctx.frameSeed = Math.random();

    // TODO: Remove this.
    if (audioProgram) audioProgram.updateTextures();

    updatePositionProgram.updateParticlesPositions();
  }

  function transferValue(valueProgram) {
    if (texture_type != 1) return;

    // WAS TODO: ready SPACEBAR for starting value evolution?

    updatePositionProgram.transferValue(valueProgram);
  }

  function updateColorMode() {
    initDrawProgram();
  }

  function updateCode(vfCode) {
    ctx.frame = 0;
    currentVectorField = vfCode;
    updatePositionProgram.updateCode(vfCode);

    initDrawProgram();
  }

  function updateParticlesCount() {
    particleStateResolution = ctx.particleStateResolution; // TODO: make second res for bc/vals
    numParticles = particleStateResolution * particleStateResolution;
    var particleIndices = new Float32Array(numParticles);
    var particleStateX = new Uint8Array(numParticles * 4);
    var particleStateY = new Uint8Array(numParticles * 4);

    var minX = ctx.bbox.minX; var minY = ctx.bbox.minY;
    var width = ctx.bbox.maxX - minX;
    var height = ctx.bbox.maxY - minY;
    for (var i = 0; i < numParticles; i++) {
      encodeFloatRGBA((Math.random()) * width + minX, particleStateX, i * 4); // randomize the initial particle positions
      encodeFloatRGBA((Math.random()) * height + minY, particleStateY, i * 4); // randomize the initial particle positions

      particleIndices[i] = i;
    }

    if (particleIndexBuffer) gl.deleteBuffer(particleIndexBuffer);
    particleIndexBuffer = util.createBuffer(gl, particleIndices);

    updatePositionProgram.updateParticlesCount(particleStateX, particleStateY);
  }

  function encodeBCValue() {
    particleStateResolution = ctx.particleStateResolution; // TODO: make second res for bc/vals
    numParticles = particleStateResolution * particleStateResolution;

    var valueIndices = new Float32Array(numParticles);
    var valueReachRGBA = new Uint8Array(numParticles * 4);
    var valueAvoidRGBA = new Uint8Array(numParticles * 4);

    var minX = ctx.bbox.minX; 
    var minY = ctx.bbox.minY;
    var width = ctx.bbox.maxX - minX;
    var height = ctx.bbox.maxY - minY;

    // console.log("bbox at enc (orig) minX", ctx.bbox_at_bc_enc.minX);
    ctx.bbox_at_bc_enc = JSON.parse(JSON.stringify(ctx.bbox)); // bbox right now defines the grid location!
    // console.log("bbox (now) minX", ctx.bbox.minX);

    var bbox_enc = ctx.bbox_at_bc_enc;
    console.log("u_min_enc:", bbox_enc.minX, bbox_enc.minY)
    console.log("du_enc:", bbox_enc.maxX - bbox_enc.minX, bbox_enc.maxY - bbox_enc.minY)

    var bc = ctx.bc

    var max_val = -100.
    var max_x = 0.
    var max_y = 0.
    var min_val = 100.
    var min_x = 0.
    var min_y = 0.

    // for (var i = 0; i < 4; i++) {
    for (var i = 0; i < numParticles; i++) {

      var flr_ix = Math.floor(i / particleStateResolution);
      var x = width * ((i / particleStateResolution) - flr_ix) + minX;
      var y = -height * (flr_ix / particleStateResolution) + ctx.bbox.maxY; // col major? also maxY/minY bug (not mine!)
      // var x = ((i / particleStateResolution) - flr_ix);
      // var y = (flr_ix / particleStateResolution);

      if (bc.shape == 1) { // square
        var bc_val = 0.5 * (Math.max(Math.abs(x - bc.cx)/bc.qx, Math.abs(y - bc.cy)/bc.qy) - 1.);
      } else if (bc.shape == 2) { // circle
        var bc_val = 0.5 * ((x - bc.cx)*(x - bc.cx)/bc.qx + (y - bc.cy)*(y - bc.cy)/bc.qy - 1.);
      } else { // free draw
        // TODO WAS: not implemented yet
        var bc_val = 0.;
      }

      if (x > 0. && x < 1. && y > 0. && y < 1.) {
        if (max_val < bc_val) {
          max_x = x
          max_y = y
          max_val = bc_val
        }
        if (min_val > bc_val) {
          min_x = x
          min_y = y
          min_val = bc_val
        }
      }

      encodeFloatRGBA(bc_val, valueReachRGBA, i * 4); // insert value into texture, TODO WAS: only in reach mode
      encodeFloatRGBA(bc_val, valueAvoidRGBA, i * 4); // TODO wAS: only in avoid mode

      valueIndices[i] = i;

      // Debugging
      // if (i == 0) {
      //   console.log("i == 0, at ", x, y, ", bc_val=", bc_val)
      // }
      // if (Math.abs(x) < 0.001 || Math.abs(y) < 0.001) {
      //   console.log("at ", x, y, ", bc_val=", bc_val)
      // }
      // if (Math.abs(bc_val) < ctx.thresh) {
      //   console.log("at ", x, y, ", bc_val=", bc_val)
      // }
      // console.log("at (", x, y, "), bc_val=", bc_val)
    }

    // console.log("Maximum value in [0,1] is ", max_val, ", occured at (",max_x, max_y,")")
    // console.log("Minimum value in [0,1] is ", min_val, ", occured at (",min_x, min_y,")")

    if (valueIndexBuffer) gl.deleteBuffer(valueIndexBuffer);
    valueIndexBuffer = util.createBuffer(gl, valueIndices);

    // console.log("valueIndices", valueIndices)

    updatePositionProgram.updateParticlesCount(valueReachRGBA, valueAvoidRGBA);
  }

  function drawParticles() {
    if (!currentVectorField) return;

    var program = drawProgram;
    gl.useProgram(program.program);
    
    if (texture_type == 0) {
      util.bindAttribute(gl, particleIndexBuffer, program.a_index, 1);
    } else {
      // updateParticlesCount(); util.bindAttribute(gl, particleIndexBuffer, program.a_index, 1);
      util.bindAttribute(gl, valueIndexBuffer, program.a_index, 1);
    }
    
    updatePositionProgram.prepareToDraw(program);
    ctx.inputs.updateBindings(program);
  
    gl.uniform1f(program.u_h, ctx.integrationTimeStep);
    gl.uniform1f(program.frame, ctx.frame);
    gl.uniform1f(program.u_particles_res, particleStateResolution);
    var bbox = ctx.bbox;
    gl.uniform2f(program.u_min, bbox.minX, bbox.minY);
    gl.uniform2f(program.u_max, bbox.maxX, bbox.maxY);

    var bbox_enc = ctx.bbox_at_bc_enc;
    gl.uniform2f(program.u_min_enc, bbox_enc.minX, bbox_enc.minY);
    gl.uniform2f(program.u_max_enc, bbox_enc.maxX, bbox_enc.maxY);

    // gl.uniform1i(program.texture_type, 0);
    gl.uniform1i(program.texture_type, texture_type);
    gl.uniform1f(program.thresh, ctx.thresh);
    gl.uniform1f(program.drawing_click_sum, ctx.drawing_click_sum);
    gl.uniform1i(program.bc_drawing_mode, ctx.bc_drawing_mode);
    
    if (texture_type == 1) { // Boundary Condition Texture (value defined by implicit location)

      var bc = ctx.bc;
      gl.uniform1f(program.bc_cx, bc.cx);
      gl.uniform1f(program.bc_cy, bc.cy);
      gl.uniform1f(program.bc_qx, bc.qx);
      gl.uniform1f(program.bc_qy, bc.qy);
      gl.uniform1i(program.bc_shape, bc.shape); // TODO: Make string  

    } else if (texture_type == 2) { // Value Texture (value encoded in texture RGBA data)

      // TODO: bind some things?
    
    } else {

      // TODO

    }

    var cursor = ctx.cursor;
    gl.uniform4f(program.cursor, cursor.clickX, cursor.clickY, cursor.hoverX, cursor.hoverY);
    gl.drawArrays(gl.POINTS, 0, numParticles); 
    // TODO: draw triangles between the points (shade)
  }


  function convertCursor2bcParams() {
    var cursor = ctx.cursor;

    // Corner Drawing Method
    var w = Math.abs(cursor.clickX - cursor.hoverX);
    var h = Math.abs(cursor.clickY - cursor.hoverY); 
    ctx.bc.cx = Math.min(cursor.clickX, cursor.hoverX) + 0.5 * w;
    ctx.bc.cy = Math.min(cursor.clickY, cursor.hoverY) + 0.5 * h;

    // Radial Drawing Method
    // ctx.bc.cx = cursor.clickX
    // ctx.bc.cy = cursor.clickY
    // var w = 2 * Math.abs(ctx.bc.cx - cursor.hoverX);
    // var h = 2 * Math.abs(ctx.bc.cy - cursor.hoverY);

    if (ctx.bc.shape == 1) { // square
      ctx.bc.qx = 0.5 * w;
      ctx.bc.qy = 0.5 * h;
    } else if (ctx.bc.shape == 2) { // circle
      ctx.bc.qx = 2 * Math.pow(0.5 * w, 2);
      ctx.bc.qy = 2 * Math.pow(0.5 * h, 2); // 2x for better UX
    } else {
      console.log(ctx.bc.shape, " not possible yet!")
    }
  }

  function onKey(e) {
    if (ctx.bc_drawing_mode && texture_type == 1) {
      if (e.which === 13 && e.target === document.body) { // Enter for BC Drawing Transfer
        encodeBCValue();
        // transferValue(); //TODO

        e.preventDefault(); // do I need this?
        console.log("value encoded")
      }
      if (e.which === 49 && e.target === document.body) { // 1 for square drawing
        ctx.bc.shape = 1;
        e.preventDefault();
        console.log("square drawing mode")
      }
      if (e.which === 50 && e.target === document.body) { // 2 for circle drawing
        ctx.bc.shape = 2;
        e.preventDefault();
        console.log("circle drawing mode")
      }
    }
  }
}