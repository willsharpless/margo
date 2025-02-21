/**
 * Wraps a simple boundary condition string into our default shader code.
 * @param {Integer} filterKey 
 * @param {Boolean} wrap 
 */
export default function presetValueFilter(filterKey=0, wrap=true) {
  
  var startCode = `
// we may also filter evolution
`;
  var endCode = `
// to see it,
// [click screen, 'enter']`;

  if (!wrap) {
    startCode = ``;
    endCode = `
`;
  }

  if (filterKey==0) { // custom
    return startCode + `float filter_val(float valNext, float val, float valR, float valA) {

  float filterVal = valNext; // change me!

  return filterVal;
}
` + endCode;

  } else if (filterKey==1 || filterKey==2) { // brs || bas
    return startCode + `float filter_val(float valNext, float val, float valR, float valA) {

  return valNext; // BRS/BAS (no filter)
}
` + endCode;

  } else if (filterKey==3 || filterKey==4) { // brt
    return startCode + `float filter_val(float valNext, float val, float valR, float valA) {

  return min(valNext, val); // BRT/BAT
}
` + endCode;

//   } else if (filterKey==4) { // bat
//     return startCode + `float filter_val(float valNext, float val, float valR, float valA) {

//   return max(valNext, -valA); // BAT
// }
// ` + endCode;

  } else if (filterKey==5) { // brat
    return startCode + `float filter_val(float valNext, float val, float valR, float valA) {

  return max(min(valNext, valR), -valA); // BRAT (set Dual in Shape...)
}
` + endCode;

  } else if (filterKey==6 || filterKey==7) { // clvf || cbvf
    return startCode + `float filter_val(float valNext, float val, float valR, float valA) {
    
  return valNext + 0.5 * val; // CLVF/CBVF
}
` + endCode;

  }
}

// float filterVal = min(valNext, val); // BRT
// float filterVal = max(-valA, min(val, valNext)); // BRAT
