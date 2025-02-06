/**
 * Wraps a simple boundary condition string into our default shader code.
 * @param {String} valCode 
 * @param {Boolean} custom 
 * @param {Boolean} brs 
 * @param {Boolean} bas 
 * @param {Boolean} brt 
 * @param {Boolean} bat 
 * @param {Boolean} brat 
 * @param {Boolean} clvf 
 * @param {Boolean} cbvf 
 */
export default function wrapValueFilter(valCode, custom=true, brs=false, bas=false, brt=false, bat=false, brat=false, clvf=false, cbvf=false) {
  
  var startCode = `

// we may also manually filter evolution
float filter_value(float newVal, float oldVal, float reachBCVal, float avoidBCVal) {
`;
  var endCode = `

// to see it,
// [click screen, 'shift' + 'enter']`;

  if (custom) {
    return startCode + `
  ${valCode}

  return filterVal;
}` + endCode;

  } else if (brs || bas) {
    return startCode + `
  return newVal; // BRS/BAS (no filter)
}` + endCode;

  } else if (brt) {
    return startCode + `
  return min(newVal, reachBCVal); // BRT
}` + endCode;

  } else if (bat) {
    return startCode + `
  return max(newVal, -avoidBCVal); // BAT
}` + endCode;

  } else if (brat) {
    return startCode + `
  return max(min(newVal, reachBCVal), -avoidBCVal); // BRAT
}` + endCode;

  } else if (clvf || cbvf) {
    return startCode + `
  return newVal + 0.5 * oldVal; // CLVF/CBVF
}` + endCode;

  }
}

// float filterVal = min(newVal, oldVal); // BRT
// float filterVal = max(-avoidBCVal, min(oldVal, newVal)); // BRAT
