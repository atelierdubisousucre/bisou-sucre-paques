import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';
import PhotoScreen from './src/screens/PhotoScreen';
import TaquinScreen from './src/screens/TaquinScreen';
import { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#FFF0F5' },
            headerTintColor: '#C2185B',
            headerTitleStyle: {
              fontWeight: '800',
              fontSize: 17,
            },
            contentStyle: { backgroundColor: '#FFF0F5' },
            animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Photo"
            component={PhotoScreen}
            options={{ title: '📸 Photo de Pâques' }}
          />
          <Stack.Screen
            name="Taquin"
            component={TaquinScreen}
            options={{ title: '🧩 Taquin de Pâques' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
