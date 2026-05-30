import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.allenliao.plus1",
  appName: "plus1",
  webDir: "capacitor/www",
  server: {
    url: "https://plus1-livid.vercel.app",
    cleartext: false,
  },
  plugins: {
    Keyboard: {
      resize: "none",
    },
  },
};

export default config;
