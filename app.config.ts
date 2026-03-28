import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Joyeuses Paques - Bisou Sucre',
  slug: 'bisou-sucre-paques',
  web: {
    ...config.web,
    bundler: 'metro',
    favicon: './assets/logo_rond.png',
    // baseUrl activé UNIQUEMENT pour le build GitHub Pages
    ...(process.env.GITHUB_PAGES === 'true' ? { baseUrl: '/bisou-sucre-paques' } : {}),
  },
});
