import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import { theme } from './theme';
import {
  CleaningStackParamList,
  RootTabParamList,
  TeamStackParamList,
} from './navigation';
import { HomeScreen } from './screens/HomeScreen';
import { CleaningFlowScreen } from './screens/CleaningFlowScreen';
import { TeamScreen } from './screens/TeamScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { getCurrentUserId } from './lib/storage';

const CleaningStack = createNativeStackNavigator<CleaningStackParamList>();
const TeamStack = createNativeStackNavigator<TeamStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: theme.colors.background },
} as const;

function CleaningStackNavigator() {
  return (
    <CleaningStack.Navigator screenOptions={stackScreenOptions}>
      <CleaningStack.Screen name="Home" component={HomeScreen} />
      <CleaningStack.Screen
        name="CleaningFlow"
        component={CleaningFlowScreen}
        options={{ animation: 'slide_from_right', gestureEnabled: true }}
      />
    </CleaningStack.Navigator>
  );
}

function TeamStackNavigator() {
  return (
    <TeamStack.Navigator screenOptions={stackScreenOptions}>
      <TeamStack.Screen name="Team" component={TeamScreen} />
    </TeamStack.Navigator>
  );
}

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
      <NavigationContainer>
        <StatusBar style="dark" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.muted,
            tabBarStyle: {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.line,
              borderTopWidth: 0.5,
            },
            tabBarLabelStyle: {
              fontFamily: theme.fonts.semibold,
              fontSize: 11,
              letterSpacing: 0.2,
            },
            tabBarItemStyle: { paddingVertical: 4 },
          }}
        >
          <Tab.Screen
            name="CleaningTab"
            component={CleaningStackNavigator}
            options={{
              tabBarLabel: 'Cleaning',
              tabBarIcon: ({ color, size }) => (
                <Feather name="check-square" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="TeamTab"
            component={TeamStackNavigator}
            options={{
              tabBarLabel: 'Team',
              tabBarIcon: ({ color, size }) => (
                <Feather name="users" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
