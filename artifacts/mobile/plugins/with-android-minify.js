const { withGradleProperties } = require("expo/config-plugins");

const PROPERTY_KEY = "android.enableMinifyInReleaseBuilds";

module.exports = function withAndroidMinify(config) {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults.filter(
      (property) => property.type !== "property" || property.key !== PROPERTY_KEY,
    );

    properties.push({
      type: "property",
      key: PROPERTY_KEY,
      value: "true",
    });

    config.modResults = properties;
    return config;
  });
};
