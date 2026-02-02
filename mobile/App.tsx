import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { WebSocketProvider } from './src/contexts/WebSocketContext';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import MapScreen from './src/screens/MapScreen';
import HuntScreen from './src/screens/HuntScreen';
import HintsScreen from './src/screens/HintsScreen';
import HintDetailScreen from './src/screens/HintDetailScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RulesScreen from './src/screens/RulesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator for main app
const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Map':
              iconName = focused ? 'map' : 'map-outline';
              break;
            case 'Hunt':
              iconName = focused ? 'camera' : 'camera-outline';
              break;
            case 'Updates':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Chat':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'More':
              iconName = focused ? 'menu' : 'menu-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1E40AF',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#1E40AF',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: 'Map',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Hunt"
        component={HuntScreen}
        options={{
          title: 'Hunt',
          headerTitle: 'Fox Hunt',
        }}
      />
      <Tab.Screen
        name="Updates"
        component={HintsStack}
        options={{
          title: 'Updates',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: 'Chat',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          title: 'More',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
};

// Hints Stack Navigator
const HintsStackNavigator = createNativeStackNavigator();

const HintsStack: React.FC = () => {
  return (
    <HintsStackNavigator.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1E40AF',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <HintsStackNavigator.Screen
        name="HintsList"
        component={HintsScreen}
        options={{
          title: 'Updates & Hints',
        }}
      />
      <HintsStackNavigator.Screen
        name="HintDetail"
        component={HintDetailScreen}
        options={{
          title: 'Details',
          headerShown: false,
        }}
      />
    </HintsStackNavigator.Navigator>
  );
};

// More Stack Navigator (Settings, Rules, etc.)
const MoreStackNavigator = createNativeStackNavigator();

const MoreStack: React.FC = () => {
  return (
    <MoreStackNavigator.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1E40AF',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <MoreStackNavigator.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      <MoreStackNavigator.Screen
        name="Rules"
        component={RulesScreen}
        options={{
          title: 'Game Rules',
        }}
      />
    </MoreStackNavigator.Navigator>
  );
};

// Loading screen
const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <View style={styles.loadingContent}>
      <Ionicons name="location" size={64} color="#1E40AF" />
      <Text style={styles.loadingTitle}>Jotihunt</Text>
      <ActivityIndicator size="large" color="#1E40AF" style={styles.spinner} />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  </View>
);

// Main navigator with auth handling
const AppNavigator: React.FC = () => {
  const { state } = useAuth();

  if (state.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {state.isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Main App component with providers
const App: React.FC = () => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </WebSocketProvider>
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginTop: 16,
  },
  spinner: {
    marginTop: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
});

export default App;
