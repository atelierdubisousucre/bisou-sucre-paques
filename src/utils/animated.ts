import { Platform } from 'react-native';
// useNativeDriver non supporté sur web
export const ND = Platform.OS !== 'web';
