import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.enlightened',
  appName: 'enlightened',
  webDir: 'www',
  server: {
    androidScheme: 'http',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
