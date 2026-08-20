import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a complete no-op (see node_modules/react-native-web/src/exports/Alert --
// `static alert() {}`, doesn't even invoke the buttons' onPress) -- confirmations need a real
// browser window.confirm() on web instead, same Platform.OS-branch pattern already used for
// platformStorage.{web,native}.ts.
export function confirmDestructiveAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
