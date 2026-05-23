module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 moved its worklet transform out of the reanimated package
    // and into react-native-worklets. This plugin must stay last in the list.
    plugins: ['react-native-worklets/plugin'],
  };
};
