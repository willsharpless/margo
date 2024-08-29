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
  var numParticles;

  var currentVectorField = '';
  var updatePositionProgram = makeUpdatePositionProgram_WAS(ctx);
  var audioProgram;

  var drawProgram;
  initPrograms();

  return {
    updateParticlesCount,
    updateParticlesPositions,
    drawParticles,
    updateCode,
    updateColorMode,
    convertCursor2bcParams
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

  function updateParticlesPositions() {
    if (!currentVectorField) return;

    ctx.frame += 1
    ctx.frameSeed = Math.random();

    // TODO: Remove this.
    if (audioProgram) audioProgram.updateTextures();

    updatePositionProgram.updateParticlesPositions();
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

  function drawParticles() {
    if (!currentVectorField) return;

    var program = drawProgram;
    gl.useProgram(program.program);
  
    util.bindAttribute(gl, particleIndexBuffer, program.a_index, 1);
    
    updatePositionProgram.prepareToDraw(program);
    ctx.inputs.updateBindings(program);
  
    gl.uniform1f(program.u_h, ctx.integrationTimeStep);
    gl.uniform1f(program.frame, ctx.frame);
    gl.uniform1f(program.u_particles_res, particleStateResolution);
    var bbox = ctx.bbox;
    gl.uniform2f(program.u_min, bbox.minX, bbox.minY);
    gl.uniform2f(program.u_max, bbox.maxX, bbox.maxY);

    // gl.uniform1i(program.texture_type, 0);
    gl.uniform1i(program.texture_type, texture_type);
    gl.uniform1f(program.thresh, ctx.thresh);
    
    if (texture_type == 1) { // Boundary Condition Texture (value defined by implicit location)

      var bc = ctx.bc;
      gl.uniform1f(program.bc_cx, bc.cx);
      gl.uniform1f(program.bc_cy, bc.cy);
      gl.uniform1f(program.bc_qx, bc.qx);
      gl.uniform1f(program.bc_qy, bc.qy);
      gl.uniform1i(program.bc_shape, bc.shape); // TODO: Make string  

    } else if (texture_type == 2) { // Value Texture (value encoded in texture RGBA data)

      // TODO: bind things?
    
    } else {

      // TODO

    }

    var cursor = ctx.cursor;
    gl.uniform4f(program.cursor, cursor.clickX, cursor.clickY, cursor.hoverX, cursor.hoverY);
    gl.drawArrays(gl.POINTS, 0, numParticles); 
    // TODO: draw triangles between the points (shade)
  }
}