import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isGitHubPages = process.env.EXPO_PUBLIC_BASE_URL === '/bisou-sucre-paques';

  return {
    ...config,
    name: 'Joyeuses Pâques - Bisou Sucré',
    slug: 'bisou-sucre-paques',
    web: {
      ...config.web,
      bundler: 'metro',
      favicon: './assets/logo_rond.png',
      // baseUrl uniquement pour le build GitHub Pages
      ...(isGitHubPages ? { baseUrl: '/bisou-sucre-paques' } : {}),
    },
  };
};
