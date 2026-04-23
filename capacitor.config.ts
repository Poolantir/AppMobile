import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.poolantir.app',
  appName: 'Poolantir',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0f172a',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
