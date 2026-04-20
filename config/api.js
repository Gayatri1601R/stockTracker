import { Platform } from 'react-native';

const defaultApiBase = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBase;
