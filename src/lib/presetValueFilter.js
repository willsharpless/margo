/**
 * Wraps a simple boundary condition string into our default shader code.
 * @param {Boolean} custom 
 * @param {Boolean} brs 
 * @param {Boolean} bas 
 * @param {Boolean} brt 
 * @param {Boolean} bat 
 * @param {Boolean} brat 
 * @param {Boolean} clvf 
 * @param {Boolean} cbvf 
 */
export default function presetValueFilter(filterKey=0, wrap=true) {
  
  var startCode = `
// we may also filter evolution
`;
  var endCode = `
// to see it,
// [click screen, 'shift' + 'enter']`;

  if (!wrap) {
    startCode = ``;
    endCode = `
`;
  }

  if (filterKey==0) { // custom
    return startCode + `float filter_value(float newVal, float oldVal, float reachBCVal, float avoidBCVal) {

  float filterVal = newVal; // change me!

  return filterVal;
}
` + endCode;

  } else if (filterKey==1 || filterKey==2) { // brs || bas
    return startCode + `float filter_value(float newVal, float oldVal, float reachBCVal, float avoidBCVal) {

  return newVal; // BRS/BAS (no filter)
}
` + endCode;

  } else if (filterKey==3) { // brt
    return startCode + `float filter_value(float newVal, float oldVal, float reachBCVal, float avoidBCVal) {

  return min(newVal, reachBCVal); // BRT
}
` + endCode;

  } else if (filterKey==4) { // bat
    return startCode + `float filter_value(float newVal, float oldVal, float reachBCVal, float avoidBCVal) {

  return max(newVal, -avoidBCVal); // BAT
}
` + endCode;

  } else if (filterKey==5) { // brat
    return startCode + `float filter_value(float newVal, float oldVal, float reachBCVal, float avoidBCVal) {

  return max(min(newVal, reachBCVal), -avoidBCVal); // BRAT
}
` + endCode;

  } else if (filterKey==6 || filterKey==7) { // clvf || cbvf
    return startCode + `float filter_value(float newVal, float oldVal, float reachBCVal, float avoidBCVal) {
    
  return newVal + 0.5 * oldVal; // CLVF/CBVF
}
` + endCode;

  }
}

// float filterVal = min(newVal, oldVal); // BRT
// float filterVal = max(-avoidBCVal, min(oldVal, newVal)); // BRAT
