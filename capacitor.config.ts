import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || 'https://cestapp.insforge.site';

const config: CapacitorConfig = {
  appId: 'site.insforge.cestapp',
  appName: 'Cesta++',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: false,
  },
};

export default config;
