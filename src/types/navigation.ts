import { NativeStackNavigationProp } from '@react-navigation/native-stack';
export type RootStackParamList = {
  Home: undefined;
  Photo: undefined;
  Taquin: undefined;
};
export type HomeNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
