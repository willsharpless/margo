import util from '../gl-utils';
import DrawParticleGraph_WAS from '../shaderGraph/DrawParticleGraph_WAS';
import makeUpdatePositionProgram_WAS from './updatePositionProgram_WAS';
import { encodeFloatRGBA, decodeFloatRGBA } from '../utils/floatPacking.js';
// import { encodeFloatRGBA } from '../utils/floatPacking.js';
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
export default function drawParticlesProgram_WAS(ctx, texture_type, color_start, external_program=null) {
  var gl = ctx.gl;
  var color = color_start;

  var particleStateResolution, particleIndexBuffer;
  var valueIndexBuffer;
  var numParticles;
  var valueReachRGBA_enc, valueAvoidRGBA_enc;

  var currentVectorField = '';
  var updatePositionProgram = makeUpdatePositionProgram_WAS(ctx, texture_type, external_program);
  var audioProgram;

  let keysPressed = {};
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);

  var drawProgram;
  initPrograms();

  return {
    updateParticlesCount,
    updateParticlesPositions,
    drawParticles,
    updateCode,
    updateColorMode,
    convertCursor2bcParams,
    encodeBCValue,
    dispose,
    drawProgram,
    updatePositionProgram,
    eraseBC
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
    window.removeEventListener('keydown', onKeyUp, true);
    window.removeEventListener('keyup', onKeyUp, true);
  }

  function updateParticlesPositions() {
    if (!currentVectorField) return;

    ctx.frame += 1
    ctx.frameSeed = Math.random();

    // TODO: Remove this.
    if (audioProgram) audioProgram.updateTextures();

    updatePositionProgram.updateParticlesPositions();
  }

  // function transferValue(valueProgram) {
  //   if (texture_type != 1) return;

  //   // WAS TODO: ready SPACEBAR for starting value evolution?

  //   updatePositionProgram.transferValue(valueProgram);
  // }

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
    var reach_mode = ctx.bc_reach_mode;
    var avoid_mode = !ctx.bc_reach_mode;
    var flip_mode = ctx.bc_flip_mode;

    var minX = ctx.bbox.minX;
    var minY = ctx.bbox.minY;
    var width = ctx.bbox.maxX - minX;
    var height = ctx.bbox.maxY - minY;

    ctx.bbox_at_bc_enc = JSON.parse(JSON.stringify(ctx.bbox)); // bbox right now defines the grid location!

    var bbox_enc = ctx.bbox_at_bc_enc;
    // console.log("u_min_enc:", bbox_enc.minX, bbox_enc.minY)
    // console.log("du_enc:", bbox_enc.maxX - bbox_enc.minX, bbox_enc.maxY - bbox_enc.minY)

    var bc = ctx.bc

    // var sign = (2 * reach_mode - 1) * (2 * !flip_mode - 1) // determines up/down of bc
    var sign = (2 * !flip_mode - 1) // determines up/down of bc
    console.log("reach mode?", reach_mode)
    console.log("flip mode?", flip_mode)
    console.log("sign", sign)

    for (var i = 0; i < numParticles; i++) {

      var flr_ix = Math.floor(i / particleStateResolution);
      var x = width * ((i / particleStateResolution) - flr_ix) + minX;
      var y = -height * (flr_ix / particleStateResolution) + ctx.bbox.maxY; // col major? also maxY/minY bug (not mine!)
      
      if (valueReachRGBA_enc && valueAvoidRGBA_enc) { // TODO WAS: walk thru cases!
        if (bc.shape == 1) { // square
          var bc_val = sign * 0.5 * (Math.max(Math.abs(x - bc.cx)/bc.qx, Math.abs(y - bc.cy)/bc.qy) - 1.);
        } else if (bc.shape == 2) { // circle
          var bc_val = sign * 0.5 * ((x - bc.cx)*(x - bc.cx)/bc.qx + (y - bc.cy)*(y - bc.cy)/bc.qy - 1.);
        } else { // free draw (not implemented yet)
          var bc_val = 0.;
        }
      } else {
        var bc_val = 3.4028234663852886e+38 // FIXME WAS: atm, ~largest 32-bit number, 10^38            
      }
      
      if (i==0) {
        console.log("First i, Before min/max, bc_val", bc_val)
      }

      // if (i == 0) {
      //   console.log("reach mode:", reach_mode)
      //   // console.log("valueReachRGBA_enc:", valueReachRGBA_enc)
      //   if (valueReachRGBA_enc) {
      //     console.log("Should be taking min!")
      //   }
      // }

      // Flip Draw Sets (Need to fill shapes for this to be usable, still might recommend against (given avoid))
      // if (!flip_mode && valueReachRGBA_enc && valueAvoidRGBA_enc) {
      //   bc_val = - bc_val;
      // }

      // Take minimum with existing bc (Reach or Avoid)
      if (reach_mode && valueReachRGBA_enc) {
        var old_val_rgba = valueReachRGBA_enc.slice(i*4, i*4 + 4)
        if (!flip_mode) {
          bc_val = Math.min(decodeFloatRGBA(old_val_rgba[0], old_val_rgba[1], old_val_rgba[2], old_val_rgba[3]), bc_val);
        } else {
          bc_val = Math.min(decodeFloatRGBA(old_val_rgba[0], old_val_rgba[1], old_val_rgba[2], old_val_rgba[3]), bc_val);
        }
      } else if (avoid_mode && valueAvoidRGBA_enc) {
        var old_val_rgba = valueAvoidRGBA_enc.slice(i*4, i*4 + 4)
        if (!flip_mode) {
          bc_val = Math.min(decodeFloatRGBA(old_val_rgba[0], old_val_rgba[1], old_val_rgba[2], old_val_rgba[3]), bc_val);
        } else {
          bc_val = Math.min(decodeFloatRGBA(old_val_rgba[0], old_val_rgba[1], old_val_rgba[2], old_val_rgba[3]), bc_val);
        }
      }

      // insert value into temp array
      if (i==0) {
        console.log("First i, After min/max, bc_val", bc_val)
      }
      encodeFloatRGBA(bc_val, valueReachRGBA, i * 4);
      encodeFloatRGBA(bc_val, valueAvoidRGBA, i * 4);

      // // encoding/decoding test, interestingly only accurate to 1e-6
      // if (i == 0) {
      //   console.log("TEST, bc val before:", bc_val);
      //   var slice = valueReachRGBA.slice(i*4, i*4 + 4);
      //   console.log("slice:", slice)
      //   console.log("TEST, bc val after at (i*4, i*4 + 4):", decodeFloatRGBA(slice[0], slice[1], slice[2], slice[3]))
      // }

      valueIndices[i] = i;
    }

    if (valueIndexBuffer) gl.deleteBuffer(valueIndexBuffer);
    valueIndexBuffer = util.createBuffer(gl, valueIndices);

    // only store new one, this assumes the grid fixed after first bc encoding...
    if (valueReachRGBA_enc || valueAvoidRGBA_enc) {
      if (reach_mode) {
        valueReachRGBA = valueReachRGBA;
        valueAvoidRGBA = valueAvoidRGBA_enc; // avoid stays old, doesnt change
      } else if (avoid_mode) {
        valueReachRGBA = valueReachRGBA_enc; // reach stays old, doesnt change
        valueAvoidRGBA = valueAvoidRGBA;
      }
    }
    
    // Overwrite and Store BC Textures
    // console.log("valueReachRGBA", valueReachRGBA)
    // console.log("valueAvoidRGBA", valueAvoidRGBA)
    updatePositionProgram.updateParticlesCount(valueReachRGBA, valueAvoidRGBA); // this works as intended for some rzn...
    // updatePositionProgram.encodeBCValue(valueReachRGBA, valueAvoidRGBA); // doesn't show the textures for some rzn... something in uPP/uPG_WAS.js
    valueReachRGBA_enc = valueReachRGBA
    valueAvoidRGBA_enc = valueAvoidRGBA
    // console.log("valueReachRGBA_enc", valueReachRGBA_enc)
    // console.log("valueAvoidRGBA_enc", valueAvoidRGBA_enc)
  }

  function eraseBC(erase_reach, erase_avoid) {
    if (erase_reach) {
      valueReachRGBA_enc = null; 
    } else if (erase_avoid) {
      valueAvoidRGBA_enc = null;
    }
    if (erase_reach || erase_avoid) {
      encodeBCValue();
    }
  }

  function drawParticles() {
    if (!currentVectorField) return;

    var program = drawProgram;
    gl.useProgram(program.program);
    
    if (texture_type == 0 || texture_type == 2) {
      util.bindAttribute(gl, particleIndexBuffer, program.a_index, 1);
    } else {
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

    gl.uniform1i(program.texture_type, texture_type);
    gl.uniform1f(program.thresh, ctx.thresh);
    gl.uniform1f(program.drawing_click_sum, ctx.drawing_click_sum);
    gl.uniform1i(program.bc_drawing_mode, ctx.bc_drawing_mode);
    gl.uniform1i(program.reach_mode, ctx.bc_reach_mode);
    gl.uniform1i(program.flip_mode, ctx.bc_flip_mode);
    // gl.uniform1f(program.sign, (2 * ctx.bc_reach_mode - 1) * (2 * !ctx.bc_flip_mode - 1))
    gl.uniform1f(program.sign, (2 * !ctx.bc_flip_mode - 1))
    // console.log("program.sign", (2 * ctx.bc_reach_mode - 1) * (2 * !ctx.bc_flip_mode - 1))
    gl.uniform1i(program.draw_fill, ctx.draw_fill);
    
    if (texture_type == 1) { // Boundary Condition Texture (value defined by implicit location)

      // draw the fill partially transparent - doesn't integrate with screenProgram mechanics yet, coming soon
      // if (ctx.draw_fill) {
      //   gl.enable(gl.BLEND); 
      //   gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      //   // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      //   // gl.clearColor(color[0], color[1], color[2], color[3]);
      // }

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

    // draw the fill partially transparent - doesn't integrate with screenProgram mechanics yet, coming soon
    // if (ctx.draw_fill) {
    //   gl.clear(gl.COLOR_BUFFER_BIT);
    //   gl.disable(gl.BLEND);
    // }
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
      ctx.bc.qy = 2 * Math.pow(0.5 * h, 2); // 2x for better Ux
    } else {
      console.log("Drawing mode ", ctx.bc.shape, " not possible yet!")
    }
  }

  function onKeyDown(e) {
    keysPressed[e.key] = true;
    if (ctx.bc_drawing_mode && texture_type == 1) {
      if (e.which === 13 && e.target === document.body) { // ENTER for BC Drawing Transfer
        encodeBCValue(); // I get a violation(warning?) saying this takes too long
        e.preventDefault(); // do I need this?
        console.log("bc encoded")
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
      if (e.which === 82 && e.target === document.body) { // r for reach drawing (default)
        ctx.bc_reach_mode = true;
        color = [46/255, 121/255, 199/255, 0.9];  // blue
        initDrawProgram();
        console.log("You are reach drawing (reach mode true, default)")
        e.preventDefault();
      }
      if (e.which === 65 && e.target === document.body) { // a for avoid drawing
        ctx.bc_reach_mode = false;
        color = [223/255, 28/255, 28/255, 0.85];  // red
        initDrawProgram();
        console.log("You are avoid drawing (reach mode false)")
        e.preventDefault();
      }
      if (e.which === 73 && e.target === document.body) { // i for inside drawing (default)
        ctx.bc_flip_mode = false;
        e.preventDefault();
        console.log("You are inside drawing which takes unions (flip mode false, default)")
      }
      if (e.which === 79 && e.target === document.body) { // o for inside drawing
        ctx.bc_flip_mode = true;
        e.preventDefault();
        console.log("You are outside drawing which takes intersections (flip mode true)")
      }
    }
    if (keysPressed['Backspace']) {
      if (keysPressed['r']) {
        console.log('Reach drawings erased.');
        eraseBC(true, false);
      } else if (keysPressed['a']) {
        console.log('Avoid drawings erased.');
        eraseBC(false, true);
      } else if (keysPressed['Shift']) {
        console.log('All drawings erased.');
        eraseBC(true, true);
      }
    } 
    // if (ctx.bc_drawing_mode && texture_type == 2) {
    //   if (e.which === 13 && e.target === document.body) { // SPACE set value in motion? actually probably should just be pause induced so UL button also works
    //     // encodeBCValue();
    //     transferValue(); //TODO

    //     e.preventDefault(); // do I need this?
    //     console.log("value transferred bc to value")
    //   }
    //   if (e.which === 49 && e.target === document.body) { // Q for reset?
    //     ctx.bc.shape = 1;
    //     e.preventDefault();
    //     console.log("square drawing mode")
    //   }
    // }
  }

  function onKeyUp(e) {
    delete keysPressed[e.key];
  }
}