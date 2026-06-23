import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Feather, MaterialIcons } from '@expo/vector-icons';

import Dashboard from '../pages/Dashboard';
import Collections from '../pages/Collections';
import BulkPay from '../pages/BulkPay';
import CashAdvance from '../pages/CashAdvance';
import Profile from '../pages/Profile';
import InflationShield from '../pages/InflationShield';
import SupportPage from '../pages/SupportPage';
import Login from '../pages/Login';
import SetPassword from '../pages/SetPassword';
import Transactions from '../pages/Transactions';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#00351d',
        tabBarInactiveTintColor: '#1b1c1a80',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#efeeeb',
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
            <Feather name="arrow-down-circle" size={22} color={color} />
          )
        }}
      />
      <Tab.Screen 
        name="Pay" 
        component={BulkPay} 
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={22} color={color} />
          )
        }}
      />
      <Tab.Screen 
        name="Advance" 
        component={CashAdvance} 
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="trending-up" size={22} color={color} />
          )
        }}
      />
      <Tab.Screen 
        name="More" 
        component={Profile} 
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="grid" size={22} color={color} />
          )
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="SetPassword" component={SetPassword} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="InflationShield" component={InflationShield} />
        <Stack.Screen name="SupportPage" component={SupportPage} />
        <Stack.Screen name="Transactions" component={Transactions} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
