const { withInfoPlist } = require('expo/config-plugins');
module.exports = (config, { release, backgroundLocation }) =>
  withInfoPlist(config, (result) => {
    // No biometric authentication is implemented in YellowShifts.
    delete result.modResults.NSFaceIDUsageDescription;
    if (release) {
      delete result.modResults.NSLocalNetworkUsageDescription;
      delete result.modResults.NSBonjourServices;
      result.modResults.NSAppTransportSecurity = { NSAllowsArbitraryLoads: false };
    }
    if (!backgroundLocation) {
      const modes = (result.modResults.UIBackgroundModes || []).filter(
        (mode) => mode !== 'location' && mode !== 'fetch'
      );
      if (modes.length) result.modResults.UIBackgroundModes = modes;
      else delete result.modResults.UIBackgroundModes;
    }
    return result;
  });
