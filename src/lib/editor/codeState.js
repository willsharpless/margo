import bus from '../bus';
import appState from '../appState';
import getParsedVectorFieldFunction from './getParsedVectorFieldFunction';
import wrapHamiltonian from '../wrapHamiltonian';
import presetValueFilter from '../presetValueFilter';

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
  
  // Need get_velocity for hamiltonian (FIXME names are backward due to artifact)
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
    setPresetHamiltonianCode,
    setPresetFilterCode,

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

  function setPresetHamiltonianCode(hamiltonianKey) {
    if (texture_type != 2) {
      return
    }
    return;
    // FIXME
    // return setCode(currentVectorFieldCode.replace(/float get_hamiltonian\([\s\S]*?\}\s*\n?/, presetValueFilter(hamiltonianKey, false)));
  } 

  function setPresetFilterCode(filterKey) {
    if (texture_type != 2) {
      return
    }
    var modifiedCode = currentVectorFieldCode.replace(/float filter_value\([\s\S]*?\}\s*\n?/, presetValueFilter(filterKey, false));
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

    // WAS: Value program also needs get_velocity
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