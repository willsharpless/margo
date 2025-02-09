import bus from '../bus';
import appState from '../appState';
import getParsedVectorFieldFunction from './getParsedVectorFieldFunction';
import presetHamiltonian from '../presetHamiltonian';
import presetValueFilter from '../presetValueFilter';
import presetBoundaryCondition from '../presetBoundaryCondition';

/**
 * A text editor state for the vector field equation. Manages vector field
 * program compilation and error reporting state.
 *
 * @param {Object} drawProgram 
 * @param {Int} texture_type gives the type: 0 = particle field, 1 = bc texture, 2 = value texture
 */
export default function createGeneralEditorState(drawProgram, texture_type) {
  bus.on('glsl-parser-ready', parseCode);
  var currentVectorFieldVersion = 0;

  // What is the current code?
  var currentVectorFieldCode = appState.getCode(texture_type);
  // console.log("PROGRAM", texture_type, "INIT currentVectorFieldCode\n\n", currentVectorFieldCode)
  
  // Need get_vel for hamiltonian (FIXME names are backward due to artifact)
  if (texture_type > 0) {
    var currentVectorFieldCodeForValueCode = appState.getCode(0);
    // console.log("PROGRAM", texture_type, "INIT combined\n\n", currentVectorFieldCodeForValueCode + "\n\n" + currentVectorFieldCode)
  }

  // For delayed parsing result verification (e.g. when vue is loaded it
  // can request us to see if there were any errors)
  var parserResult;

  loadCodeFromAppState();

  var api = {
    getCode,
    setCode,
    dispose,
    setPresetBoundaryCondition,
    setPresetBoundaryConditionDual,
    setPresetHamiltonianCode,
    setPresetFilterCode,
    setDefaultCode,

    // These properties are for UI only
    code: currentVectorFieldCode,
    error: '',
    errorDetail: '',
    isFloatError: false 
  };

  return api;

  function dispose() {
    bus.off('glsl-parser-ready', parseCode);
  }

  function getCode() {
    return appState.getCode(texture_type);
  }

  // if (!this.setDual) {
  //   this.vectorField.setPresetBoundaryCondition(this.selectedPresetShape, this.selectedBody, 
  //                                               this.selectedCenter, this.selectedRadius)
  // } else {
  //   this.vectorField.setPresetBoundaryConditionDual(this.selectedPresetShapeReach, this.selectedBodyReach,
  //                                               this.selectedCenterReach, this.selectedRadiusReach,
  //                                               this.selectedPresetShapeAvoid, this.selectedBodyAvoid,
  //                                               this.selectedCenterAvoid, this.selectedRadiusAvoid, 
  //                                               true);
  // }

  function setPresetBoundaryCondition(boundaryKey, flip, center, radius) {
    if (texture_type != 1) {
      return
    }      
    // console.log("center", typeof(center), center.map(num => num.toFixed(1)));
    // console.log("radius", typeof(radius), radius.toFixed(1));
    // console.log("flip", flip)
    var bcCode = presetBoundaryCondition(boundaryKey, false, false, false,
                                          center, radius, flip,
                                          false);
    console.log("bcCode", bcCode);                                        
    return setCode(currentVectorFieldCode.replace(/float get_bc\([\s\S]*?\}\s*\n?/, 
                                          presetBoundaryCondition(boundaryKey, false, false, false,
                                                            center, radius, flip,
                                                            false)));
  } 

  function setPresetBoundaryConditionDual(boundaryKeyReach, flipReach,
                                          centerReach, radiusReach,
                                          boundaryKeyAvoid, flipAvoid,
                                          centerAvoid, radiusAvoid, firstpass) {
    if (texture_type != 1) {
      return
    }

    var reachCode = presetBoundaryCondition(boundaryKeyReach, true, false, false,
                                            centerReach, radiusReach, flipReach,
                                            false);

    var avoidCode = presetBoundaryCondition(boundaryKeyAvoid, false, true, false,
                                            centerAvoid, radiusAvoid, flipAvoid,
                                            false);
                                            
    var bcCode    = presetBoundaryCondition(0, false, false, true,
                                            centerReach, radiusReach, flipReach,
                                            false);  
                                            
    // console.log("reachCode", reachCode);                                        
    // console.log("avoidCode", avoidCode);                                        
    // console.log("bcCode", bcCode);                                        
    // console.log("firstpass", firstpass);

    if (!firstpass) {

      // console.log("replaced reachCode", currentVectorFieldCode.replace(/float get_bc_reach\([\s\S]*?\}\s*\n?/, reachCode));                                        
      // console.log("replaced avoidCode", currentVectorFieldCode.replace(/float get_bc_reach\([\s\S]*?\}\s*\n?/, reachCode)
      // .replace(/float get_bc_avoid\([\s\S]*?\}\s*\n?/, avoidCode));                                        
      // console.log("replaced bcCode", bcCode);                                        
      // console.log("firstpass", firstpass);

      return setCode(currentVectorFieldCode.replace(/float get_bc_reach\([\s\S]*?\}\s*\n?/, reachCode)
                                           .replace(/float get_bc_avoid\([\s\S]*?\}\s*\n?/, avoidCode)
                                           .replace(/float get_bc\([\s\S]*?\}\s*\n?/, bcCode));  
    } else {
      return setCode(currentVectorFieldCode.replace(/float get_bc\([\s\S]*?\}\s*\n?/, reachCode + avoidCode + bcCode));
    }                                            
  } 

  function setPresetHamiltonianCode(auto,  
                                    control, controlMaxes, controlShape, controlReach,
                                    disturbance, disturbanceMaxes, disturbanceShape, disturbanceReach) {
    if (texture_type != 2) {
      return
    }
    console.log("center", typeof(controlMaxes), controlMaxes.map(num => num.toFixed(1)));
    return setCode(currentVectorFieldCode.replace(/float get_ham\([\s\S]*?\}\s*\n?/, 
                                                  presetHamiltonian(auto, 
                                                                    control, controlMaxes, controlShape, controlReach,
                                                                    disturbance, disturbanceMaxes, disturbanceShape, disturbanceReach,
                                                                    false
    )));
  } 

  function setPresetFilterCode(filterKey) {
    if (texture_type != 2) {
      return
    }
    var modifiedCode = currentVectorFieldCode.replace(/float filter_val\([\s\S]*?\}\s*\n?/, presetValueFilter(filterKey, false));
    return setCode(modifiedCode);
  } 

  function setCode(vectorFieldCode) {

    console.log("PROGRAM", texture_type, "- CODE SET:\n", vectorFieldCode)

    // WAS: when is this useful? trySetNewCode always parses?
    if (vectorFieldCode === currentVectorFieldCode && texture_type != 2) {
      // If field hasn't changed, let's make sure that there was no previous
      // error
      if (parserResult && parserResult.error) {
        console.log("error from same code") 
        // And if there was error, let's revalidate code:
        parseCode();
      }
      return;
    } 

    trySetNewCode(vectorFieldCode).then((result) => {
      if (result.cancelled) return;

      if (result && result.error) {
        updateErrorInfo(result.error);
        return result;
      }

      currentVectorFieldCode = vectorFieldCode;
      api.code = vectorFieldCode;
      appState.saveCode(vectorFieldCode, texture_type);
    });
  }

  function setDefaultCode() {

    var defaultCode = appState.getDefaultCode(texture_type);
    trySetNewCode(defaultCode);

    currentVectorFieldCode = defaultCode;
    api.code = defaultCode;
    appState.saveCode(defaultCode, texture_type);
  }

  function updateErrorInfo(parserResult) {
    if (parserResult && parserResult.error) {
      api.error = parserResult.error;
      api.errorDetail = parserResult.errorDetail;
      api.isFloatError = parserResult.isFloatError;
      // console.log("PROGRAM", texture_type, "ERROR:", parserResult.errorDetail)
    } else {
      api.error = '';
      api.errorDetail = '';
      api.isFloatError = false;
    }
  }

  function loadCodeFromAppState() {
    let persistedCode = appState.getCode(texture_type);
    if (persistedCode) {
      trySetNewCode(persistedCode).then(result => {
        if (!result.error) return; // This means we set correctly;
        // If we get here - something went wrong. see the console
        console.error('Failed to restore previous vector field: ', result.error);
        // Let's use default vector field
        trySetNewCode(appState.getDefaultCode(texture_type));
      });
    } else {
      // we want a default vector field
      trySetNewCode(appState.getDefaultCode(texture_type));
    }
  }

  function parseCode(customCode) {
    return getParsedVectorFieldFunction(customCode || currentVectorFieldCode)
      .then(currentResult => {
        parserResult = currentResult
        updateErrorInfo(parserResult.error);
        return parserResult;
      });    
  }

  function trySetNewCode(vectorFieldCode) {

    // WAS: Value program also needs get_vel
    if (texture_type > 0) {
      vectorFieldCode = appState.getCode(0) + "\n\n" + vectorFieldCode
      // console.log("PROGRAM", texture_type, "CODE IN trySetNewCode\n", vectorFieldCode)
    }

    currentVectorFieldVersion += 1;
    var capturedVersion = currentVectorFieldVersion;
    // step 1 - run through parser
    return parseCode(vectorFieldCode).then(parserResult => {
      if (capturedVersion !== currentVectorFieldVersion) {
        parserResult.cancelled = true;
        // a newer request was issued. Ignore these results.
        return parserResult;
      }

      if (parserResult.error) {
        // console.log("PARSER ERROR", parserResult.error)
        // console.log("PARSER CODE\n", vectorFieldCode)
        return parserResult;
      }
      // step 2 - run through real webgl
      try {
        if (texture_type == 0) {
          drawProgram.updateCode(parserResult.code);
          // console.log("parserResult.code", parserResult.code)
        } else if (texture_type == 1) {
          // console.log("parserResult.code\n\n", parserResult.code)
          drawProgram.updateCode(parserResult.code); // TODO also dynamic update
        } else if (texture_type == 2) {
          drawProgram.updateCode(parserResult.code);
        }
        return parserResult;
      } catch (e) {
        return {
          error: {
            error: e.message
          }
        }
      }
    });
  }
}