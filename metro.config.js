const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// The scraper service is a separate Node package with its own node_modules;
// keep Metro from crawling or bundling it.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const serverDir = escapeRegExp(path.join(__dirname, 'server'));
config.resolver.blockList = [].concat(
  config.resolver.blockList ?? [],
  new RegExp(`^${serverDir}[\\\\/].*`),
);

module.exports = withNativeWind(config, { input: './src/global.css' });
