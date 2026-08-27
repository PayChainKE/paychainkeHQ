import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import Dashboard from '../pages/Dashboard';
import Collections from '../pages/Collections';
import BulkPay from '../pages/BulkPay';
import CashAdvance from '../pages/CashAdvance';
import Profile from '../pages/Profile';
import SendMoney from '../pages/SendMoney';
import RequestMoney from '../pages/RequestMoney';
import SupportPage from '../pages/SupportPage';
import Notifications from '../pages/Notifications';
import Login from '../pages/Login';
import Transactions from '../pages/Transactions';
import Onboarding from '../pages/Onboarding';
import PinSetup from '../pages/PinSetup';
import PinEntry from '../pages/PinEntry';
import BiometricSetup from '../pages/BiometricSetup';
import TourTarget from '../components/TourTarget';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#00351d',
        tabBarInactiveTintColor: '#0c201080',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#eff4ef',
          elevation: 10,
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -5 },
        },
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_600SemiBold',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          paddingBottom: 4,
        }
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={Dashboard} 
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={22} color={color} />
          )
        }}
      />
      <Tab.Screen
        name="Collections"
        component={Collections}
        options={{
          tabBarIcon: ({ color }) => (
            <TourTarget id="tab-collections"><Feather name="arrow-down-circle" size={22} color={color} /></TourTarget>
          )
        }}
      />
      <Tab.Screen
        name="Pay"
        component={BulkPay}
        options={{
          tabBarIcon: ({ color }) => (
            <TourTarget id="tab-pay"><Feather name="users" size={22} color={color} /></TourTarget>
          )
        }}
      />
      <Tab.Screen
        name="Advance"
        component={CashAdvance}
        options={{
          tabBarIcon: ({ color }) => (
            <TourTarget id="tab-advance"><Feather name="trending-up" size={22} color={color} /></TourTarget>
          )
        }}
      />
      <Tab.Screen
        name="More"
        component={Profile}
        options={{
          tabBarIcon: ({ color }) => (
            <TourTarget id="tab-more"><Feather name="grid" size={22} color={color} /></TourTarget>
          )
        }}
      />
      <Tab.Screen
        name="SendMoney"
        component={SendMoney}
        options={{ tabBarButton: () => null, tabBarItemStyle: { flex: 0, width: 0, padding: 0 } }}
      />
      <Tab.Screen
        name="RequestMoney"
        component={RequestMoney}
        options={{ tabBarButton: () => null, tabBarItemStyle: { flex: 0, width: 0, padding: 0 } }}
      />
      <Tab.Screen
        name="Transactions"
        component={Transactions}
        options={{ tabBarButton: () => null, tabBarItemStyle: { flex: 0, width: 0, padding: 0 } }}
      />
      <Tab.Screen
        name="SupportPage"
        component={SupportPage}
        options={{ tabBarButton: () => null, tabBarItemStyle: { flex: 0, width: 0, padding: 0 } }}
      />
      <Tab.Screen
        name="Notifications"
        component={Notifications}
        options={{ tabBarButton: () => null, tabBarItemStyle: { flex: 0, width: 0, padding: 0 } }}
      />
    </Tab.Navigator>
  );
}

import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function AppNavigator() {
  const { isAuthenticated, isLoading, hasCompletedOnboarding, appPin, isPinUnlocked, hasSetBiometrics } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' }}>
        <ActivityIndicator size="large" color="#0b4d2e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasCompletedOnboarding ? (
          <>
            <Stack.Screen name="Onboarding" component={Onboarding} />
            <Stack.Screen name="Login" component={Login} />
          </>
        ) : !isAuthenticated ? (
          <Stack.Screen name="Login" component={Login} />
        ) : !appPin ? (
          <Stack.Screen name="PinSetup" component={PinSetup} />
        ) : !hasSetBiometrics ? (
          <Stack.Screen name="BiometricSetup" component={BiometricSetup} />
        ) : !isPinUnlocked ? (
          <Stack.Screen name="PinEntry" component={PinEntry} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
