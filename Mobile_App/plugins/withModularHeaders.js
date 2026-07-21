const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// @react-native-google-signin/google-signin pulls in AppCheckCore, which
// depends on GoogleUtilities/RecaptchaInterop — Swift pods CocoaPods refuses
// to link statically unless modular headers are enabled. Without this,
// `pod install` fails with "cannot yet be integrated as static libraries".
// A config plugin (not a manual Podfile edit) so the fix survives
// `expo prebuild --clean`, which regenerates the Podfile from scratch.
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('use_modular_headers!')) {
        contents = contents.replace(/^(platform :ios.*)$/m, '$1\nuse_modular_headers!');
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
};
