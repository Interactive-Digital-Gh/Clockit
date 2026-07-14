const { withEntitlementsPlist } = require('@expo/config-plugins');

// Personal/free Apple developer teams can't sign apps requesting the Push
// Notifications capability, which expo-notifications adds unconditionally.
// Strip it so local device builds work on a free Apple ID; re-enable by
// removing this plugin once the project has a paid Apple Developer account.
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
