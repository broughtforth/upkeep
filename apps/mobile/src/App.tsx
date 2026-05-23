import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import { theme } from './theme';
import { CleaningStackParamList } from './navigation';
import { HomeScreen } from './screens/HomeScreen';
import { CleaningFlowScreen } from './screens/CleaningFlowScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { getCurrentUserId, setCurrentUserId } from './lib/storage';
import { SessionProvider } from './lib/session';

const CleaningStack = createNativeStackNavigator<CleaningStackParamList>();

const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: theme.colors.background },
} as const;

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // null = still loading; '' = no user picked yet; string = picked.
  const [currentUserId, setCurrentUserIdState] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getCurrentUserId();
      if (!cancelled) setCurrentUserIdState(id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fontsLoaded || currentUserId === undefined) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  const signOut = async () => {
    await setCurrentUserId(null);
    setCurrentUserIdState('');
  };

  if (!currentUserId) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen
          onPicked={async () => {
            const id = await getCurrentUserId();
            setCurrentUserIdState(id);
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SessionProvider value={{ currentUserId, signOut }}>
        <NavigationContainer>
          <StatusBar style="dark" />
          <CleaningStack.Navigator screenOptions={stackScreenOptions}>
            <CleaningStack.Screen name="Home" component={HomeScreen} />
            <CleaningStack.Screen
              name="CleaningFlow"
              component={CleaningFlowScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }}
            />
          </CleaningStack.Navigator>
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
