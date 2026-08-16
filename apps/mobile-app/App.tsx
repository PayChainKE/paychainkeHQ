import './global.css';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, TextInput } from 'react-native';
import MobileLayout from './src/components/layout/MobileLayout';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import Sentry from './src/lib/sentry';

// Prevent system text scaling and default font overrides across the entire application
// @ts-ignore
if (Text.defaultProps == null) Text.defaultProps = {};
// @ts-ignore
Text.defaultProps.allowFontScaling = false;
// @ts-ignore
Text.defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' };

// @ts-ignore
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
// @ts-ignore
TextInput.defaultProps.allowFontScaling = false;

function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    DMSerifDisplay_400Regular_Italic,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <MobileLayout>
          <AppNavigator />
        </MobileLayout>
      </SafeAreaProvider>
    </AuthProvider>
  );
}

export default Sentry.wrap(App);
