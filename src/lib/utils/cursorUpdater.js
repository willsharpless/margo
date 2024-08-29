/**
 * This module allows to pass mouse coordinates down to the shader. Coordinates
 * will be available as `vec4 cursor` variable, where `xy` are the last
 * click position, and `zw` are the last hover position.
 * 
 * Note: On Touch devices hover is the same click.
 * 
 * Hopefully this will enables easier exploration
 */
export default function createCursorUpdater(ctx) {
  var {canvasRect, bbox} = ctx;

  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('mousedown', onMouseClick, true);
  window.addEventListener('touchstart', onTouchStart, true);
  // window.addEventListener('click', onMouseClick2, true); // FIXME WAS, would like to drag screen around without obejct dissapearing
  // window.addEventListener('keydown', onKeyDown, true);

  return {
    dispose
  }

  function dispose() {
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mousedown', onMouseClick, true);
    window.removeEventListener('touchstart', onTouchStart, true);
    window.removeEventListener('touchmove', onTouchMove, true);
    // window.removeEventListener('click', onMouseClick2, true); // FIXME WAS
    // window.removeEventListener('keydown', onKeyDown, true);
  }

  function onTouchStart(e) {
    var firstTouch = e.touches[0];
    if (!firstTouch) return;

    setClick(firstTouch.clientX, firstTouch.clientY);
    setHover(firstTouch.clientX, firstTouch.clientY);
  }

  function onTouchMove(e) {
    var firstTouch = e.touches[0];
    if (!firstTouch) return;
    setHover(firstTouch.clientX, firstTouch.clientY);
  }

  function onMouseMove(e) { setHover(e.clientX, e.clientY); }

  function onMouseClick(e) { setClick(e.clientX, e.clientY); }

  function onMouseClick2(e) { setClick2(e.clientX, e.clientY); }

  function setHover(clientX, clientY) {
    ctx.cursor.hoverX = getSceneXFromClientX(clientX);
    ctx.cursor.hoverY = getSceneYFromClientY(clientY);
  }

  function setClick(clientX, clientY) {
    if (ctx.bc_drawing_mode) {
      ctx.drawing_click_sum += 1;
    }
    ctx.cursor.clickX = getSceneXFromClientX(clientX);
    ctx.cursor.clickY = getSceneYFromClientY(clientY);
  }

  function setClick2(clientX, clientY) { // FIXME WAS, would like to drag screen around without obejct dissapearing
    ctx.cursor.clickX = getSceneXFromClientX(clientX);
    ctx.cursor.clickY = getSceneYFromClientY(clientY);
  }

  function getSceneXFromClientX(clientX) {
    var dx = (clientX - canvasRect.left)/canvasRect.width;
    return (bbox.maxX - bbox.minX) * dx + bbox.minX;
  }

  function getSceneYFromClientY(clientY) {
    var dy = 1. - ((clientY - canvasRect.top)/canvasRect.height);
    return (bbox.minY - bbox.maxY) * dy + bbox.maxY;
  }
}