import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';
import { useTheme } from '../context/Theme';
import { Feather } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    isSuccess: false
  });

  const showMessage = (title, message, isSuccess = false) => {
    setModalConfig({ title, message, isSuccess });
    setShowModal(true);
  };

  const handleAuth = async () => {
    if (!email || !password) {
      showMessage('Error', 'Please fill all fields');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showMessage('Error', 'Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Auth failed');
      await AsyncStorage.setItem('token', data.access_token);
      navigation.replace('Dashboard');
    } catch (e) {
      showMessage('Authentication Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Password strength calculation
  const getStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 6)  return { bars: 1, label: 'Too short', color: theme.danger };
    if (password.length < 9)  return { bars: 2, label: 'Weak',      color: theme.warning };
    if (password.length < 12) return { bars: 3, label: 'Medium',    color: theme.warning };
    return                           { bars: 4, label: 'Strong',     color: theme.success };
  };
  const strength = getStrength();

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      <View style={s.header}>
        <Text style={s.logo}>📦</Text>
        <Text style={s.appName}>StockTrackr</Text>
        <Text style={s.tagline}>Smart inventory for your business</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{isRegister ? 'Create Account' : 'Sign In'}</Text>

        {/* Email input */}
        <TextInput
          style={s.input}
          placeholder="Email address"
          placeholderTextColor={theme.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        {/* Password input with show/hide toggle */}
        <View style={s.passwordContainer}>
          <TextInput
            style={s.passwordInput}
            placeholder="Password"
            placeholderTextColor={theme.textMuted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={s.eyeButton}
            onPress={() => setShowPassword(v => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Password strength bars — only shown while registering */}
        {isRegister && strength && (
          <View style={s.strengthRow}>
            {[1, 2, 3, 4].map(i => (
              <View
                key={i}
                style={[
                  s.strengthBar,
                  { backgroundColor: i <= strength.bars ? strength.color : theme.cardBorder },
                ]}
              />
            ))}
            <Text style={[s.strengthLabel, { color: strength.color }]}>
              {strength.label}
            </Text>
          </View>
        )}

        <TouchableOpacity style={s.primaryBtn} onPress={handleAuth} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>{isRegister ? 'Register' : 'Login'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => {
          setIsRegister(!isRegister);
          setPassword(''); // Clear password when switching modes
        }} style={s.toggleRow}>
          <Text style={s.toggleText}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={s.toggleLink}>{isRegister ? 'Login' : 'Register'}</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalIconContainer}>
              <Text style={s.modalIcon}>
                {modalConfig.isSuccess ? '✅' : '❌'}
              </Text>
            </View>
            <Text style={[s.modalTitle, modalConfig.isSuccess && s.modalSuccessTitle]}>
              {modalConfig.title}
            </Text>
            <Text style={s.modalMessage}>{modalConfig.message}</Text>
            <TouchableOpacity 
              style={[s.modalButton, modalConfig.isSuccess ? s.modalSuccessButton : s.modalErrorButton]} 
              onPress={() => setShowModal(false)}
            >
              <Text style={s.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: t.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: t.textMuted,
    marginTop: 6,
  },
  card: {
    backgroundColor: t.card,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: t.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: t.mode === 'light' ? 0.08 : 0,
    shadowRadius: 12,
    elevation: t.mode === 'light' ? 4 : 0,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: t.textPrimary,
    marginBottom: 24,
  },
  input: {
    backgroundColor: t.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: t.textPrimary,
    borderWidth: 1,
    borderColor: t.inputBorder,
    marginBottom: 14,
  },

  // Password row — input + eye button as one pill
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.inputBorder,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: t.textPrimary,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeIcon: {
    fontSize: 18,
  },

  // Strength indicator
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: -6,
    marginBottom: 14,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 56,
    marginLeft: 4,
  },

  primaryBtn: {
    backgroundColor: t.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    color: t.textMuted,
    fontSize: 14,
  },
  toggleLink: {
    color: t.accent,
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: t.card,
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: t.cardBorder,
    alignItems: 'center',
  },
  modalIconContainer: {
    marginBottom: 12,
  },
  modalIcon: {
    fontSize: 48,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: t.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSuccessTitle: {
    color: t.success,
  },
  modalMessage: {
    fontSize: 16,
    color: t.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  modalSuccessButton: {
    backgroundColor: t.success,
  },
  modalErrorButton: {
    backgroundColor: t.accent,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});