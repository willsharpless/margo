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
 * @param {Int} texture_type gives the type: 0 = particle field, 1 = bc texture, 2 = value texture
 * @param {Float32Array} color_start gives the color of the texture
 * @param {Float32Array} color_start2 gives second color of the texture
 */
export default function drawParticlesProgram_WAS(ctx, texture_type, color_start, color_start2, external_program=null) {
  var gl = ctx.gl;
  var color = color_start;
  var color2 = color_start2;

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
    const vertexShaderCode = drawGraph.getVertexShader(currentVectorField, color, color2);
    drawProgram = util.createProgram(gl, vertexShaderCode, drawGraph.getFragmentShader());
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyUp, true);
    window.removeEventListener('keyup', onKeyUp, true);
  }

  function updateParticlesPositions(external_textures=null) {
    if (!currentVectorField) return;

    ctx.frame += 1
    ctx.frameSeed = Math.random();

    // TODO: Remove this.
    if (audioProgram) audioProgram.updateTextures();

    updatePositionProgram.updateParticlesPositions(external_textures);
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
    ctx.particleIndexBuffer = particleIndexBuffer

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

    var min_enc_BC_val = 3.4028234663852886e+38;
    var max_enc_BC_val = -3.4028234663852886e+37;

    // debugging diff
    var spread = 1.;
    var mid_i   = particleStateResolution * particleStateResolution / 2 + particleStateResolution / 2;
    var mid_i_A = mid_i + spread * particleStateResolution;
    var mid_i_B = mid_i - spread * particleStateResolution;
    var mid_i_L = mid_i - spread * 1;
    var mid_i_R = mid_i + spread * 1;

    var mat_len = 5;
    var lowerl_mat_ix = new Float32Array(mat_len * mat_len);
    var center_mat_ix = new Float32Array(mat_len * mat_len);
    var lowerl_mat_x = new Float32Array(mat_len * mat_len);
    var lowerl_mat_y = new Float32Array(mat_len * mat_len);
    var center_mat_x = new Float32Array(mat_len * mat_len);
    var center_mat_y = new Float32Array(mat_len * mat_len);
    var lowerl_mat_bc_val = new Float32Array(mat_len * mat_len);
    var center_mat_bc_val = new Float32Array(mat_len * mat_len);
    
    // this data will be stored, in order of access (bottom row first)

    for (let k = 0; k < mat_len; k ++) {
      for (let j = 0; j < mat_len; j ++) {

        var i = (k * particleStateResolution) + j; // LOWER LEFT
        // var ic = (k * particleStateResolution) + j + (mid_i - 2 - 2 * particleStateResolution); // CENTER
        // var ic = (k * particleStateResolution) + j + ((mid_i - particleStateResolution/4 - (particleStateResolution * particleStateResolution/4)) - 2 - 2 * particleStateResolution); // LOWER LEFT CENTER
        var ic = (k * particleStateResolution) + j + (particleStateResolution * particleStateResolution - 5 - 4 * particleStateResolution); // UPPER RIGHT

        lowerl_mat_ix[k * mat_len + j] = i;
        center_mat_ix[k * mat_len + j] = ic;

        lowerl_mat_x[k * mat_len + j] = j;
        lowerl_mat_y[k * mat_len + j] = k;

        center_mat_x[k * mat_len + j] = j + (particleStateResolution / 2) - 2;
        center_mat_y[k * mat_len + j] = k + (particleStateResolution / 2) - 2;

        // lowerl_i_RGBA = pixelData.slice(i*4, i*4 + 4);
        // center_i_RGBA = pixelData.slice(ic*4, ic*4 + 4);

        // lowerl_i_val = decodeFloatRGBA(lowerl_i_RGBA[0], lowerl_i_RGBA[1], lowerl_i_RGBA[2], lowerl_i_RGBA[3]);
        // center_i_val = decodeFloatRGBA(center_i_RGBA[0], center_i_RGBA[1], center_i_RGBA[2], center_i_RGBA[3]);
        
        // lowerl_mat[k * mat_len + j] = lowerl_i_val;
        // center_mat[k * mat_len + j] = center_i_val;

        // if (k == 2 || j == 1) {
        //   lowerl_mat[k * mat_len + j] = 1.;
        // }
        // if (k == 4 && j == 1) {
        //   center_mat[k * mat_len + j] = 1.;
        // }

        // need to verify index location
        // then can verify values etc.

      }
    }

    // console.log("numParticles", numParticles)
    // console.log("particleStateResolution", particleStateResolution)
    for (var i = 0; i < numParticles; i++) {

      // // // WAS: not me, ~works (defines upper lim to be slightly less than bBox maxX/Y)
      // var flr_ix = Math.floor(i / particleStateResolution);
      // var x = width * ((i / particleStateResolution) - flr_ix) + minX;
      // var y = -height * (flr_ix / particleStateResolution) + ctx.bbox.maxY; // col major? also maxY/minY bug (not mine!)

      // WAS: corrected for upper box bds, ~works (defines upper lim to be slightly less than bBox maxX/Y)
      var flr_ix = Math.floor(i / particleStateResolution);
      var x = width * ((i-flr_ix*particleStateResolution) / (particleStateResolution-1)) + minX;
      var y = -height * (flr_ix / (particleStateResolution-1)) + ctx.bbox.maxY; // col major? also maxY/minY bug (not mine!)            
      // if (i < 10 || i % 10 == 0 || x == y) {
      //   console.log("i:(", i, "), x,y:(", x, ",", y, ")")
      // }

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
      
      // var topmid_txture_i = particleStateResolution * particleStateResolution / 2;

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
      
      // if (i == mid_i) {
      //   console.log("mid_i  : bc_val", bc_val);
      //   bc_val = 0.;
      // }
      // if (i == mid_i_R) {
      //   console.log("mid_i_R: bc_val", bc_val);
      //   bc_val = 0.;
      // }
      // if (i == mid_i_L) {
      //   console.log("mid_i_L: bc_val", bc_val);
      //   bc_val = 0.;
      // }
      // if (i == mid_i_A) {
      //   console.log("mid_i_A: bc_val", bc_val);
      //   bc_val = 0.;
      // }
      // if (i == mid_i_B) {
      //   console.log("mid_i_B: bc_val", bc_val);
      //   bc_val = 0.;
      // }

      for (let j = 0; j < mat_len*mat_len; j ++) {
        if (i == lowerl_mat_ix[j]) {
          // console.log('LOWERL matched i:', i)
          // bc_val = 0.;
          // console.log('i:', i, ", bc val:", bc_val)
          lowerl_mat_x[j] = x;
          lowerl_mat_y[j] = y;
          lowerl_mat_bc_val[j] = bc_val;
        }
        if (i == center_mat_ix[j]) {
          // console.log('CENTER matched i:', i)
          // bc_val = 0.;
          // console.log('i:', i, ", bc val:", bc_val)
          center_mat_x[j] = x;
          center_mat_y[j] = y;
          center_mat_bc_val[j] = bc_val;
        }
      }

      // insert value into temp array
      if (i==0) {
        console.log("First i, After min/max, bc_val", bc_val)
      }
      encodeFloatRGBA(bc_val, valueReachRGBA, i * 4);
      encodeFloatRGBA(bc_val, valueAvoidRGBA, i * 4);

      min_enc_BC_val = Math.min(min_enc_BC_val, bc_val);
      max_enc_BC_val = Math.max(max_enc_BC_val, bc_val);

      // // encoding/decoding test, interestingly only accurate to 1e-6
      // if (i == 0) {
      //   console.log("TEST, bc val before:", bc_val);
      //   var slice = valueReachRGBA.slice(i*4, i*4 + 4);
      //   console.log("slice:", slice)
      //   console.log("TEST, bc val after at (i*4, i*4 + 4):", decodeFloatRGBA(slice[0], slice[1], slice[2], slice[3]))
      // }

      valueIndices[i] = i;
    }

    // data printed to match spatial (bottom row last)
    console.log("\nLOWERL IX (1D)")
    for (let i = mat_len*(mat_len-1); i >= 0; i -= mat_len) {
        console.log(lowerl_mat_ix.slice(i, i + mat_len).join(' '));
    }
    console.log("\nCENTER IX (1D)")
    for (let i = mat_len*(mat_len-1); i >= 0; i -= mat_len) {
        console.log(center_mat_ix.slice(i, i + mat_len).join(' '));
    }

    var round_num = 12;
    console.log("\nSTATES - LOWERL - X")
    for (let i = mat_len*(mat_len-1); i >= 0; i -= mat_len) {
      console.log(Array.from(lowerl_mat_x.slice(i, i + mat_len)).map(num => parseFloat(num.toFixed(round_num)).toFixed(round_num-1)).join(' '));
    }
    console.log("\nSTATES - LOWERL - Y")
    for (let i = mat_len*(mat_len-1); i >= 0; i -= mat_len) {
      console.log(Array.from(lowerl_mat_y.slice(i, i + mat_len)).map(num => parseFloat(num.toFixed(round_num)).toFixed(round_num-1)).join(' '));
    }
    console.log("\nSTATES - CENTER - X")
    for (let i = mat_len*(mat_len-1); i >= 0; i -= mat_len) {
      console.log(Array.from(center_mat_x.slice(i, i + mat_len)).map(num => parseFloat(num.toFixed(round_num)).toFixed(round_num-1)).join(' '));
    }
    console.log("\nSTATES - CENTER - Y")
    for (let i = mat_len*(mat_len-1); i >= 0; i -= mat_len) {
      console.log(Array.from(center_mat_y.slice(i, i + mat_len)).map(num => parseFloat(num.toFixed(round_num)).toFixed(round_num-1)).join(' '));
    }
    console.log("\nVALUES - LOWERL - BC")
    for (let i = mat_len*(mat_len-1); i >= 0; i -= mat_len) {
      console.log(Array.from(lowerl_mat_bc_val.slice(i, i + mat_len)).map(num => parseFloat(num.toFixed(round_num)).toFixed(round_num-1)).join(' '));
    }
    console.log("\nVALUES - CENTER - BC")
    for (let i = mat_len*(mat_len-1); i >= 0; i -= mat_len) {
      console.log(Array.from(center_mat_bc_val.slice(i, i + mat_len)).map(num => parseFloat(num.toFixed(round_num)).toFixed(round_num-1)).join(' '));
    }

    // NEXT NEED TO CONSOLE LOG:
    // LR grads (in uPP)
    // Diss coeff (in uPP)
    // Diss ham (in uPP)
    // Ham (in uPP)
    // Next value (in uPP)

    console.log("")

    console.log("BC Value Encoded cx:", bc.cx);
    console.log("BC Value Encoded cy:", bc.cy);
    console.log("BC Value Encoded qx:", bc.qx);
    console.log("BC Value Encoded qy:", bc.qy);

    console.log("Min BC Value Encoded:", min_enc_BC_val);
    console.log("Max BC Value Encoded:", max_enc_BC_val);

    if (valueIndexBuffer) gl.deleteBuffer(valueIndexBuffer);
    valueIndexBuffer = util.createBuffer(gl, valueIndices);
    ctx.valueIndexBuffer = valueIndexBuffer;
    ctx.particleIndexBuffer = particleIndexBuffer;

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
    if (texture_type == 1) {console.log("uPP.readTextures UPDATED", updatePositionProgram.getTextures())} // DELETE ME

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
  
    gl.uniform1f(program.time_step, ctx.integrationTimeStep);
    gl.uniform1f(program.frame, ctx.frame);
    gl.uniform1f(program.u_particles_res, particleStateResolution);
    var bbox = ctx.bbox;
    gl.uniform2f(program.u_min, bbox.minX, bbox.minY);
    gl.uniform2f(program.u_max, bbox.maxX, bbox.maxY);

    var bbox_enc = ctx.bbox_at_bc_enc;
    gl.uniform2f(program.u_min_enc, bbox_enc.minX, bbox_enc.minY);
    gl.uniform2f(program.u_max_enc, bbox_enc.maxX, bbox_enc.maxY);

    gl.uniform1i(program.texture_type, texture_type);
    gl.uniform1f(program.thresh, ctx.draw_thresh);
    gl.uniform1f(program.drawing_click_sum, ctx.drawing_click_sum);
    gl.uniform1i(program.bc_drawing_mode, ctx.bc_drawing_mode);
    gl.uniform1i(program.reach_mode, ctx.bc_reach_mode);
    gl.uniform1i(program.flip_mode, ctx.bc_flip_mode);
    // gl.uniform1f(program.sign, (2 * ctx.bc_reach_mode - 1) * (2 * !ctx.bc_flip_mode - 1))
    gl.uniform1f(program.sign, (2 * !ctx.bc_flip_mode - 1))
    // console.log("program.sign", (2 * ctx.bc_reach_mode - 1) * (2 * !ctx.bc_flip_mode - 1))
    gl.uniform1i(program.draw_fill, ctx.draw_fill);
    gl.uniform1i(program.draw_levels, ctx.draw_levels);
    gl.uniform1f(program.level_step, ctx.draw_level_step);
    
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
    var maxw = Math.abs(ctx.bbox.maxX - ctx.bbox.minX);
    var maxh = Math.abs(ctx.bbox.maxY - ctx.bbox.minY);
    var minmax = Math.min(maxw, maxh); // to prevent screen cover before moving

    if (ctx.bc.shape == 1) { // square
      ctx.bc.qx = Math.max(0.5 * w, 0.005 * minmax);
      ctx.bc.qy = Math.max(0.5 * h, 0.005 * minmax);
      // console.log("ctx.bc.qx",ctx.bc.qx)
    } else if (ctx.bc.shape == 2) { // circle
      ctx.bc.qx = Math.max(2 * Math.pow(0.5 * w, 2), 0.0005 * minmax);
      ctx.bc.qy = Math.max(2 * Math.pow(0.5 * h, 2), 0.0005 * minmax); // 2x for better Ux
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
        // color = [46/255, 121/255, 199/255, 0.9];  // blue
        color = color_start;
        initDrawProgram();
        console.log("You are reach drawing (reach mode true, default)")
        e.preventDefault();
      }
      if (e.which === 65 && e.target === document.body) { // a for avoid drawing
        ctx.bc_reach_mode = false;
        // color = [223/255, 28/255, 28/255, 0.85];  // red
        color = color_start2;
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
        eraseBC(true, false); // BUG WAS: if field going, both bc & field die and cant turn on w/o refresh (but only happens w BC erase not val?)
      } else if (keysPressed['a']) {
        console.log('Avoid drawings erased.');
        eraseBC(false, true);
      } else if (keysPressed['Shift']) {
        console.log('All drawings erased.');
        eraseBC(true, true);
        ctx.value_mode = false;
      } else if (keysPressed['v']) {
        console.log('Value erased.')
        ctx.value_mode = false;
      } 
      // else if (keysPressed['b']) {
      //   console.log('Bounding box reset.')
      // wont work because
      // }
    } 
    if (keysPressed['Shift'] && (keysPressed['Return'] || keysPressed['Enter'])) {
      ctx.value_transfer = true;
      ctx.value_mode = true;
      updateCode(currentVectorField) // resets frame and shaders //FIXME: is there a better way? does this cause field bug?
      console.log('Value evolution beginning :)');
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