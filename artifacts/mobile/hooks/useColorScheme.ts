/**
 * Re-exports useColorScheme from react-native with a non-null guarantee.
 * Returns 'light' as the default when the device reports null.
 */
import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' {
  return useRNColorScheme() ?? 'light';
}
