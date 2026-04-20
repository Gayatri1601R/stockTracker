// App.js — React Native Expo Entry Point
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { API_BASE } from './config/api';
import { ThemeProvider, useTheme } from './context/Theme.js';

import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import AddStockScreen from './screens/AddstockScreen';
import DailyUsageScreen from './screens/DailyusageScreen';
import ReportsScreen from './screens/ReportScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { theme } = useTheme();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('token');

    if (!token) {
      setInitialRoute('Login');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/stock/items`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 200) {
        setInitialRoute('Dashboard');
      } else {
        await AsyncStorage.removeItem('token');
        setInitialRoute('Login');
      }
    } catch (error) {
      await AsyncStorage.removeItem('token');
      setInitialRoute('Login');
    }
  };

  checkAuth();
}, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="AddStock" component={AddStockScreen} />
        <Stack.Screen name="DailyUsage" component={DailyUsageScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}