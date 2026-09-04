import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a total no-op (see its source: `static
// alert() {}`) — a real device shows a native dialog, but the web preview
// silently swallows it, e.g. an "Incorrect PIN" alert on PinEntry doing
// nothing visible at all. Falls back to window.alert on web so errors are
// never silent while testing there.
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
