import util from '../gl-utils';
import UpdatePositionGraph_WAS from '../shaderGraph/updatePositionGraph_WAS';
import ColorMode from './colorModes';
import makeReadProgram from './colorProgram';
import textureCollection_WAS from '../utils/textureCollection_WAS';
import makeStatCounter from '../utils/makeStatCounter';
import {decodeFloatRGBA} from '../utils/floatPacking';
import bus from '../bus';

const particlePositionShaderCodeBuilder = new UpdatePositionGraph_WAS();

export default function updatePositionProgram_WAS(ctx, texture_type) {
  var gl = ctx.gl;
  var readTextures, writeTextures;
  // var bc_textures;
  var particleStateResolution;
  var updateProgram;
  var readVelocity = makeReadProgram(ctx);

  // If someone needs to get vectors out from the GPU, they send a `vector-lines-request`
  // over the bus. This request is delayed until next compute frame. Once it is handled,
  // we send them back response with calculated vectors.
  // var pendingVectorLines; // FIXME WAS: commenting for now

  // TODO: need to make sure we are not leaking.
  // bus.on('vector-lines-request', putVectorLinesRequestIntoQueue);

  return {
    updateCode,
    updateParticlesPositions,
    updateParticlesCount,
    prepareToDraw,
    encodeBCValue,
    getTextures,
    // setBCTextures, 
  };

  function updateCode(vectorField) {
    particlePositionShaderCodeBuilder.setCustomVectorField(vectorField);
    let fragment = particlePositionShaderCodeBuilder.getFragmentShader(texture_type);
    let vertex = particlePositionShaderCodeBuilder.getVertexShader();

    let newProgram = util.createProgram(gl, vertex, fragment);

    if (updateProgram) updateProgram.unload();
    updateProgram = newProgram;

    if (ctx.colorMode === ColorMode.VELOCITY) readVelocity.requestSpeedUpdate();
  }

  function getTextures() {
    return readTextures
  }

  // function setBCTextures(bc_textures_in) {
  //   // modification to distinguish index etc?
  //   bc_textures = {...bc_textures_in}
  //   bc_textures.textures.index + uniqueness_offset
  // }
  
  function updateParticlesCount(x, y) {
    particleStateResolution = ctx.particleStateResolution;

    var dimensions = [{
      name: 'x',
      particleState: x
    }, {
      name: 'y',
      particleState: y
    }];

    if (readTextures) readTextures.dispose();
    readTextures = textureCollection_WAS(gl, dimensions, particleStateResolution);
    // if (texture_type == 1) {console.log("readTextures (inside uPP)", readTextures)} // DELETE ME

    if (writeTextures) writeTextures.dispose();
    writeTextures = textureCollection_WAS(gl, dimensions, particleStateResolution);

    readVelocity.updateParticlesCount();
  }

  function encodeBCValue(reach, avoid) {
    particleStateResolution = ctx.particleStateResolution;

    var dimensions = [{
      name: 'reach',
      particleState: reach
    }, {
      name: 'avoid',
      particleState: avoid
    }]; // WAS: somehow x and y are still the proper tags in shaders...?

    if (readTextures) readTextures.dispose();
    readTextures = textureCollection_WAS(gl, dimensions, particleStateResolution);

    if (writeTextures) writeTextures.dispose();
    writeTextures = textureCollection_WAS(gl, dimensions, particleStateResolution);
  }

  function prepareToDraw(program) {
    var colorMode = ctx.colorMode;
    if (colorMode === ColorMode.VELOCITY) readVelocity.setColorMinMax(program);

    readTextures.bindTextures(gl, program);
  }

  function updateParticlesPositions(bc_textures=null) {
    
    var program = updateProgram;
    var cursor = ctx.cursor;
    var bbox = ctx.bbox;
    var bbox_enc = ctx.bbox_at_bc_enc;

    gl.useProgram(program.program);
  
    util.bindAttribute(gl, ctx.quadBuffer, program.a_pos, 2);
  
    ctx.inputs.updateBindings(program);

    // TODO: Remove this.
    if (ctx.audioTexture) {
      util.bindTexture(gl, ctx.audioTexture, 5);
      gl.uniform1i(program['u_audio'], 5);
    }

    readTextures.bindTextures(gl, program);

    gl.uniform1i(program.texture_type, texture_type);
    gl.uniform1f(program.value_transfer, ctx.value_transfer);
    gl.uniform1f(program.spacing_std, 1/(ctx.particleStateResolution-1)); //
    gl.uniform1f(program.spacing_x, Math.abs(bbox_enc.maxX - bbox_enc.minX)/(ctx.particleStateResolution-1)); // TODO WAS: diff size for diff dims
    gl.uniform1f(program.spacing_y, Math.abs(bbox_enc.maxY - bbox_enc.minY)/(ctx.particleStateResolution-1)); // TODO WAS: diff size for diff dims

    // Bind the external bc textures
    if (texture_type == 2 && bc_textures) {
      var extra_tag = '_bc';
      var unit_offset = 2;
      bc_textures.bindTextures(gl, program, extra_tag, unit_offset) // for texturePositionNode
    }
    // late night idea: really need to ultimately interpolate the value with frag shader
    // late night idea: M optimal flow mode based on value evolution

    gl.uniform1f(program.u_rand_seed, ctx.frameSeed);
    gl.uniform1f(program.u_h, ctx.integrationTimeStep);
    gl.uniform1f(program.time_step, ctx.integrationTimeStep);
    gl.uniform1f(program.frame, ctx.frame);
    gl.uniform4f(program.cursor, cursor.clickX, cursor.clickY, cursor.hoverX, cursor.hoverY);
    gl.uniform2f(program.u_min, bbox.minX, bbox.minY);
    gl.uniform2f(program.u_max, bbox.maxX, bbox.maxY);

    gl.uniform1f(program.u_drop_rate, ctx.dropProbability);

    // Draw each coordinate individually
    if (texture_type == 0) {
      for(var i = 0; i < writeTextures.length; ++i) {
        var writeInfo = writeTextures.get(i);
        gl.uniform1i(program.u_out_coordinate, i);
        util.bindFramebuffer(gl, ctx.framebuffer, writeInfo.texture);
        gl.viewport(0, 0, particleStateResolution, particleStateResolution);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    } else if (texture_type == 2) { // value only uses one texture atm
      var writeInfo = writeTextures.get(0);
      util.bindFramebuffer(gl, ctx.framebuffer, writeInfo.texture);
      gl.viewport(0, 0, particleStateResolution, particleStateResolution);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // debugging
      gl.bindFramebuffer(gl.FRAMEBUFFER, ctx.framebuffer);
      var pixelData = new Uint8Array(particleStateResolution * particleStateResolution * 4); // Assuming RGBA
      gl.readPixels(0, 0, particleStateResolution, particleStateResolution, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
      // var pixelData = new Float32Array(particleStateResolution * particleStateResolution * 4); // Assuming RGBA
      // gl.readPixels(0, 0, particleStateResolution, particleStateResolution, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
      // console.log("Raw output texture data:", pixelData);
      // var mid_txture_i = particleStateResolution * particleStateResolution / 2 + 500;
      // // console.log("mid_txture_i", mid_txture_i)
      // var mid_texture_RGBA = pixelData.slice(mid_txture_i*4, mid_txture_i*4 + 4);
      // var mid_texture_value = decodeFloatRGBA(mid_texture_RGBA[0], mid_texture_RGBA[1], mid_texture_RGBA[2], mid_texture_RGBA[3]);
      // console.log("mid_texture_value (decoded)", mid_texture_value)
      // var mid_texture_RGBA = pixelData.slice((mid_txture_i-1)*4, (mid_txture_i-1)*4 + 4);
      // var mid_texture_value = decodeFloatRGBA(mid_texture_RGBA[0], mid_texture_RGBA[1], mid_texture_RGBA[2], mid_texture_RGBA[3]);
      // console.log("mid_texture_value @ - 1y_pos (decoded)", mid_texture_value)
      // var mid_texture_RGBA = pixelData.slice((mid_txture_i-1)*4, (mid_txture_i-1)*4 + 4);
      // var mid_texture_value = decodeFloatRGBA(mid_texture_RGBA[0], mid_texture_RGBA[1], mid_texture_RGBA[2], mid_texture_RGBA[3]);
      // console.log("mid_texture_value @ + 1y_pos (decoded)", mid_texture_value)

      var spread = 1.;
      var mid_i   = particleStateResolution * particleStateResolution / 2 + particleStateResolution / 2;
      var mid_i_A = mid_i + spread * particleStateResolution;
      var mid_i_B = mid_i - spread * particleStateResolution;
      var mid_i_L = mid_i - spread * 1;
      var mid_i_R = mid_i + spread * 1;

      var mid_i_RGBA  = pixelData.slice(mid_i*4, mid_i*4 + 4);
      var mid_iA_RGBA = pixelData.slice(mid_i_A*4, mid_i_A*4 + 4);
      var mid_iB_RGBA = pixelData.slice(mid_i_B*4, mid_i_B*4 + 4);
      var mid_iL_RGBA = pixelData.slice(mid_i_L*4, mid_i_L*4 + 4);
      var mid_iR_RGBA = pixelData.slice(mid_i_R*4, mid_i_R*4 + 4);

      var mid_i_val  = decodeFloatRGBA(mid_i_RGBA[0], mid_i_RGBA[1], mid_i_RGBA[2], mid_i_RGBA[3]);
      var mid_iA_val = decodeFloatRGBA(mid_iA_RGBA[0], mid_iA_RGBA[1], mid_iA_RGBA[2], mid_iA_RGBA[3]);
      var mid_iB_val = decodeFloatRGBA(mid_iB_RGBA[0], mid_iB_RGBA[1], mid_iB_RGBA[2], mid_iB_RGBA[3]);
      var mid_iL_val = decodeFloatRGBA(mid_iL_RGBA[0], mid_iL_RGBA[1], mid_iL_RGBA[2], mid_iL_RGBA[3]);
      var mid_iR_val = decodeFloatRGBA(mid_iR_RGBA[0], mid_iR_RGBA[1], mid_iR_RGBA[2], mid_iR_RGBA[3]);

      if (ctx.frame == 1) {
        console.log("At f1, mid_iB data  : ", mid_iB_val);
        console.log("At f1, mid_iL data  : ", mid_iL_val);
        console.log("At f1, mid_i  data  : ", mid_i_val);
        console.log("At f1, mid_iR data  : ", mid_iR_val);
        console.log("At f1, mid_iA data  : ", mid_iA_val);
        
        // var spac = spacing_x;
        // console.log("At f1, mid_iB data  : ", spac * mid_iB_val);
        // console.log("At f1, mid_iL data  : ", spac * mid_iL_val);
        // console.log("At f1, mid_i  data  : ", spac * mid_i_val);
        // console.log("At f1, mid_iR data  : ", spac * mid_iR_val);
        // console.log("At f1, mid_iA data  : ", spac * mid_iA_val);
      }
    }
    // bc doesn't use any textures!

    // debugging
    var error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error("WebGL Error:", error);
    }

    // TODO: I think I need to keep this time-bound, i.e. allocate X ms to
    // process particle positions, and move on. So that the rendering thread is not paused for too long
    if (ctx.colorMode === ColorMode.VELOCITY) {
      readVelocity.updateParticlesPositions(program);
    }

    // if (pendingVectorLines) {
    //   processVectorLinesRequest(program);
    //   pendingVectorLines = null;
    // }

    // swap the particle state textures so the new one becomes the current one
    var temp = readTextures;
    readTextures = writeTextures;
    writeTextures = temp;
  }

  // // WAS: programBC for transferring BC to Value texture data
  // function transferValue(valueUpdatePositionProgram) {
  //   var programBC = updateProgram;
  //   var programVal = valueUpdatePositionProgram;

  //   gl.useProgram(programBC.programBC);
    
  //   // old bindings
  //   util.bindAttribute(gl, ctx.quadBuffer, programBC.a_pos, 2);
  //   ctx.inputs.updateBindings(programBC);
  //   readTextures.bindTextures(gl, programBC); // this old fn hides all the binding
  //   gl.uniform2f(programBC.u_min, ctx.bbox.minX, ctx.bbox.minY);
  //   gl.uniform2f(programBC.u_max, ctx.bbox.maxX, ctx.bbox.maxY);
  
  //   // WAS: For BC-Value Transfer, bind target texture (value) to buffer
  //   gl.useProgram(programVal.program);
  //   util.bindFramebuffer(gl, ctx.framebuffer, programVal.writeTextures.get(0).texture); // WAS: maybe reads?

  //   // WAS: For BC-Value Transfer, switch back to use TransferNode shader
  //   gl.useProgram(programBC.program);
  //   gl.viewport(0, 0, particleStateResolution, particleStateResolution);
  //   gl.drawArrays(gl.TRIANGLES, 0, 6);
  //   // if fails, plan b: move this inside value program & swap roles?

  //   // Draw each coordinate individually (OLD)
  //   // for(var i = 0; i < writeTextures.length; ++i) {
  //   //   var writeInfo = writeTextures.get(i);
  //   //   gl.uniform1i(programBC.u_out_coordinate, i);
  //   //   util.bindFramebuffer(gl, ctx.framebuffer, writeInfo.texture);
  //   //   gl.viewport(0, 0, particleStateResolution, particleStateResolution);
  //   //   gl.drawArrays(gl.TRIANGLES, 0, 6);
  //   // }

  //   // swap the particle state textures so the new one becomes the current one
  //   // var temp = readTextures;
  //   // readTextures = writeTextures;
  //   // writeTextures = temp;
  // }

  // function putVectorLinesRequestIntoQueue(request) {
  //   pendingVectorLines = request;
  // }

  // function processVectorLinesRequest(program) {
  //   // TODO: Move this out
  //   var dimensions = [{
  //     name: 'x',
  //     particleState: pendingVectorLines.x
  //   }, {
  //     name: 'y',
  //     particleState: pendingVectorLines.y
  //   }];

  //   // We create temporary textures and load requested positions in there
  //   var resolutionOfParticlesInRequest = pendingVectorLines.resolution;
  //   var numParticles = resolutionOfParticlesInRequest * resolutionOfParticlesInRequest;

  //   var texturesForRead = textureCollection_WAS(gl, dimensions, resolutionOfParticlesInRequest);
  //   var texturesForWrite = textureCollection_WAS(gl, dimensions, resolutionOfParticlesInRequest);

  //   texturesForRead.bindTextures(gl, program);

  //   // Then we request coordinates out from GPU for each dimension
  //   var writeInfo = texturesForWrite.get(0);
  //   gl.uniform1i(program.u_out_coordinate, 6); // v_x

  //   util.bindFramebuffer(gl, ctx.framebuffer, writeInfo.texture);
  //   gl.viewport(0, 0, resolutionOfParticlesInRequest, resolutionOfParticlesInRequest);
  //   gl.drawArrays(gl.TRIANGLES, 0, 6);

  //   var velocity_x = new Uint8Array(numParticles * 4);
  //   gl.readPixels(0, 0, resolutionOfParticlesInRequest, resolutionOfParticlesInRequest, gl.RGBA, gl.UNSIGNED_BYTE, velocity_x);

  //   gl.uniform1i(program.u_out_coordinate, 7); // v_y
  //   writeInfo = texturesForWrite.get(1);
  //   util.bindFramebuffer(gl, ctx.framebuffer, writeInfo.texture);
  //   gl.viewport(0, 0, resolutionOfParticlesInRequest, resolutionOfParticlesInRequest);
  //   gl.drawArrays(gl.TRIANGLES, 0, 6);

  //   var velocity_y = new Uint8Array(numParticles * 4);
  //   gl.readPixels(0, 0, resolutionOfParticlesInRequest, resolutionOfParticlesInRequest, gl.RGBA, gl.UNSIGNED_BYTE, velocity_y);

  //   texturesForWrite.dispose();
  //   texturesForRead.dispose();

  //   var xStats = makeStatCounter();
  //   var yStats = makeStatCounter();

  //   var decoded_velocity_x = new Float32Array(numParticles);
  //   var decoded_velocity_y = new Float32Array(numParticles);
  //   for(var i = 0; i < velocity_y.length; i+=4) {
  //     var idx = i/4;
  //     var vx = readFloat(velocity_x, i);
  //     var vy = readFloat(velocity_y, i);
  //     decoded_velocity_x[idx] = vx;
  //     decoded_velocity_y[idx] = vy;
  //     xStats.add(vx);
  //     yStats.add(vy);
  //   }

  //   var vectorLineInfo = {
  //     xStats,
  //     yStats,
  //     decoded_velocity_x,
  //     decoded_velocity_y,
  //     resolution: resolutionOfParticlesInRequest
  //   };

  //   bus.fire('vector-line-ready', vectorLineInfo);
  // }
}

function readFloat(buffer, offset) {
    return decodeFloatRGBA(
      buffer[offset + 0],
      buffer[offset + 1],
      buffer[offset + 2],
      buffer[offset + 3]
    );
}
