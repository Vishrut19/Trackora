import { ConfigContext, ExpoConfig } from "expo/config";

// Read the static config from app.json
const appJson = require("./app.json");

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    ...appJson.expo,
    plugins: [
      ...(appJson.expo?.plugins ?? []),
      "@react-native-community/datetimepicker",
    ],
    android: {
      ...appJson.expo.android,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
        },
      },
    },
  };
};
