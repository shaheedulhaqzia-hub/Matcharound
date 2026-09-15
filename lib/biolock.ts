import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const KEY = 'matcharound.biolock';

/** Is the fingerprint/face quick-unlock switched on? */
export async function isBioLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

export async function setBioLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? '1' : '0');
}

/** Does this phone have fingerprint / face unlock set up? */
export async function bioAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

/** Ask the phone for a fingerprint / face check. */
export async function bioAuthenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Matcharound',
    cancelLabel: 'Cancel',
  });
  return result.success;
}
