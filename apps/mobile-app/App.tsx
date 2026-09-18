import './global.css';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { DMSerifDisplay_400Regular, DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, TextInput } from 'react-native';
import MobileLayout from './src/components/layout/MobileLayout';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { TransactionsProvider } from './src/context/TransactionsContext';
import BrandedLoadingScreen from './src/components/BrandedLoadingScreen';
import Sentry from './src/lib/sentry';

// Default font override across the entire application. Text now scales with
// the device's own OS text-size setting (accessibility -> larger/smaller
// text) instead of being frozen at a fixed size regardless of it — matching
// how a standard, well-behaved mobile app is expected to respond to that
// setting. Capped at 1.3x rather than left uncapped: a lot of this app's
// labels/badges are set very small (8-11px) for tight card layouts, and an
// uncapped multiplier (a phone set to the largest accessibility text size
// can ask for ~2-3x) would overflow those before the scaling itself became
// useful. 1.3x still gives real headroom for anyone who bumped their
// system text size up a notch or two, without blowing out the tightest
// layouts.
// @ts-ignore
if (Text.defaultProps == null) Text.defaultProps = {};
// @ts-ignore
Text.defaultProps.maxFontSizeMultiplier = 1.3;
// @ts-ignore
Text.defaultProps.style = { fontFamily: 'PlusJakartaSans_400Regular' };

// @ts-ignore
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
// @ts-ignore
TextInput.defaultProps.maxFontSizeMultiplier = 1.3;

function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    DMSerifDisplay_400Regular_Italic,
    DMSerifDisplay_400Regular,
  });

  if (!fontsLoaded) {
    return <BrandedLoadingScreen />;
  }

  return (
    <AuthProvider>
      <TransactionsProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <MobileLayout>
            <AppNavigator />
          </MobileLayout>
        </SafeAreaProvider>
      </TransactionsProvider>
    </AuthProvider>
  );
}

export default Sentry.wrap(App);
