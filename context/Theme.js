import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightTheme = {
  mode: 'light',
  bg: '#F4F6FA',
  bgSecondary: '#FFFFFF',
  bgTertiary: '#EDF0F7',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  inputBg: '#F1F5F9',
  inputBorder: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  accent: '#3B82F6',
  accentDark: '#1D4ED8',
  accentText: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  infoText: '#1E40AF',
  statusBar: 'dark-content',
};

export const darkTheme = {
  mode: 'dark',
  bg: '#0F1923',
  bgSecondary: '#1E2A38',
  bgTertiary: '#0F1923',
  card: '#1E2A38',
  cardBorder: '#2D3F55',
  inputBg: '#0F1923',
  inputBorder: '#2D3F55',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  accent: '#3B82F6',
  accentDark: '#1D4ED8',
  accentText: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  infoBg: '#1E3A5F',
  infoBorder: '#2D5A8E',
  infoText: '#93C5FD',
  statusBar: 'light-content',
};

const ThemeContext = createContext({
  theme: darkTheme,
  toggleTheme: () => {},
  isDark: true,
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('theme').then(v => {
      if (v !== null) setIsDark(v === 'dark');
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);