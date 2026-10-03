// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

// getDefaultConfig picks up tsconfig's baseUrl/paths automatically
// (Metro's package-exports + tsconfig-paths support), so the "@/*" alias
// used throughout this app works with no further config here.
module.exports = getDefaultConfig(__dirname);
