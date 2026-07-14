import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useApp } from '../context/AppContext';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AccountDetailsScreen from '../screens/AccountDetailsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SecurityScreen from '../screens/SecurityScreen';
import WorkplaceScreen from '../screens/WorkplaceScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import ScannerScreen from '../screens/ScannerScreen';
import SuccessScreen from '../screens/SuccessScreen';
import LockScreen from '../screens/LockScreen';
import TabBar from '../components/TabBar';
import { COLORS } from '../constants/colors';

export type RootStackParamList = {
  Login: undefined;
  SignUp: { googleName: string; googleEmail: string };
  Main: undefined;
  Scanner: undefined;
  Success: { clockInTime: string };
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  AccountDetails: undefined;
  Notifications: undefined;
  Security: undefined;
  Workplace: undefined;
  HelpSupport: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="AccountDetails" component={AccountDetailsScreen} options={{ animation: 'slide_from_right' }} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
      <ProfileStack.Screen name="Security" component={SecurityScreen} options={{ animation: 'slide_from_right' }} />
      <ProfileStack.Screen name="Workplace" component={WorkplaceScreen} options={{ animation: 'slide_from_right' }} />
      <ProfileStack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ animation: 'slide_from_right' }} />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading, locked } = useApp();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  // Profile loaded but biometric gate not yet passed
  if (user && locked) {
    return <LockScreen />;
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <RootStack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
          <RootStack.Screen name="SignUp" component={SignUpScreen} options={{ animation: 'slide_from_right' }} />
        </>
      ) : (
        <>
          <RootStack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />
          {/* Not a native modal: camera previews render black inside
              fullScreenModal containers on the New Architecture. */}
          <RootStack.Screen name="Scanner" component={ScannerScreen} options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
          <RootStack.Screen name="Success" component={SuccessScreen} options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </>
      )}
    </RootStack.Navigator>
  );
}
