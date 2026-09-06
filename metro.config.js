const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const cblEntry = path.resolve(__dirname, 'node_modules/cbl-reactnative/src/index.tsx');

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'cbl-reactnative') {
    return { type: 'sourceFile', filePath: cblEntry };
  }
  if (typeof upstream === 'function') {
    return upstream(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
