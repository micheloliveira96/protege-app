import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pt.protege.app',
  appName: 'PROTEGE',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
