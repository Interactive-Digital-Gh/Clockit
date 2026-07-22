const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Expo's precompiled XCFrameworks for expo-modules-core/expo-location got out
// of ABI sync in this project, crashing at launch with "Symbol not found:
// ...ExpoModulesCore...AnyModule..." (dyld can't find a Swift symbol
// ExpoLocation's prebuilt binary expects). Building expo-modules-core from
// source instead avoids the mismatch. A config plugin (not a manual Podfile
// edit) so it survives `expo prebuild --clean`, which regenerates the Podfile.
module.exports = function withoutPrecompiledExpoModules(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      const target = "ENV['EXPO_USE_PRECOMPILED_MODULES'] ||= '1'";
      if (contents.includes(target)) {
        contents = contents.replace(target, "ENV['EXPO_USE_PRECOMPILED_MODULES'] = '0'");
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
};
