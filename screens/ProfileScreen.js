import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, ActivityIndicator, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { API_BASE } from '../config/api';
import { useTheme } from '../context/Theme';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen({ navigation }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const s = makeStyles(theme);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updatingPwd, setUpdatingPwd] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  
  // Modal states
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const showMessage = (title, text, success = false) => {
    setMessageTitle(title);
    setMessageText(text);
    setIsSuccess(success);
    setShowMessageModal(true);
  };

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('No token found, redirecting to login');
        navigation.replace('Login');
        return;
      }
      
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.status === 401) {
        await AsyncStorage.removeItem('token');
        navigation.replace('Login');
        return;
      }
      
      const data = await res.json();
      setUser(data);
    } catch (error) {
      console.log('Fetch profile error:', error);
      showMessage('Error', 'Failed to load profile');
    } finally { setLoading(false); }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('Missing Fields', 'Please fill all password fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showMessage('Mismatch', 'New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      showMessage('Too Short', 'New password must be at least 6 characters');
      return;
    }
    
    setUpdatingPwd(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        showMessage('Error', 'Not authenticated');
        return;
      }
      
      console.log('Sending password update request...');
      
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          current_password: currentPassword, 
          new_password: newPassword 
        }),
      });
      
      const data = await response.json();
      console.log('Password update response:', response.status, data);
      
      if (!response.ok) {
        if (data.detail === 'Current password is incorrect') {
          showMessage('Error', 'Current password is incorrect');
        } else {
          showMessage('Error', data.detail || 'Update failed');
        }
        return;
      }
      
      showMessage('Success', 'Password updated successfully', true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error) {
      console.log('Password update error:', error);
      showMessage('Error', 'Network error. Please try again.');
    } finally { 
      setUpdatingPwd(false); 
    }
  };

  const performLogout = async () => {
    console.log('🔵 Logout function started');
    setLoggingOut(true);
    setShowLogoutModal(false);
    
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('🔵 Token found:', token ? 'Yes' : 'No');
      
      if (token) {
        console.log('🔵 Attempting to call logout API');
        fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        }).catch(err => console.log('Logout API error:', err));
      }
    } catch (error) {
      console.log('🔴 Logout error:', error.message);
    }
    
    await AsyncStorage.removeItem('token');
    console.log('🔵 Token cleared');
    
    setTimeout(() => {
      console.log('🔵 Navigating to Login');
      navigation.replace('Login');
    }, 100);
  };

  const handleLogout = () => {
    console.log('🔵 handleLogout called - showing modal');
    setShowLogoutModal(true);
  };

  const strengthLevel = () => {
    if (newPassword.length === 0) return null;
    if (newPassword.length < 6) return { bars: 1, label: 'Too short', color: theme.danger };
    if (newPassword.length < 9) return { bars: 2, label: 'Weak', color: theme.warning };
    if (newPassword.length < 12) return { bars: 3, label: 'Medium', color: theme.warning };
    return { bars: 4, label: 'Strong', color: theme.success };
  };
  const strength = strengthLevel();

  if (loading) return (
    <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={theme.accent} size="large" />
    </View>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + Info */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {user?.email?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={s.userName}>{user?.email || 'User'}</Text>
          <Text style={s.userSince}>
            Member since {user?.created_at
              ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
              : '—'}
          </Text>
        </View>

        {/* Profile Details Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Account Details</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoValue}>{user?.email}</Text>
          </View>
          <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={s.infoLabel}>Account ID</Text>
            <Text style={[s.infoValue, { fontSize: 11, fontFamily: 'monospace' }]}>
              {user?._id?.slice(-8).toUpperCase() || '—'}
            </Text>
          </View>
        </View>

        {/* Theme Toggle Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Appearance</Text>
          <View style={s.themeRow}>
            <View>
              <Text style={s.themeLabel}>Theme</Text>
              <Text style={s.themeSub}>{isDark ? 'Dark mode is on' : 'Light mode is on'}</Text>
            </View>
            <TouchableOpacity style={s.themeToggle} onPress={toggleTheme} activeOpacity={0.8}>
              <View style={[s.themeTrack, { backgroundColor: isDark ? theme.accent : theme.cardBorder }]}>
                <View style={[s.themeThumb, { transform: [{ translateX: isDark ? 22 : 2 }] }]} />
              </View>
              <Text style={{ fontSize: 16, marginLeft: 8 }}>{isDark ? '🌙' : '☀️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Change Password Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Change Password</Text>

          {/* Current Password Field */}
          <View style={{ marginBottom: 14 }}>
            <Text style={s.fieldLabel}>Current password</Text>
            <View style={s.passwordContainer}>
              <TextInput
                style={s.passwordInput}
                placeholder="Enter current password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name={showCurrent ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password Field */}
          <View style={{ marginBottom: 14 }}>
            <Text style={s.fieldLabel}>New password</Text>
            <View style={s.passwordContainer}>
              <TextInput
                style={s.passwordInput}
                placeholder="Enter new password (min 6 characters)"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name={showNew ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* New password strength */}
          {strength && (
            <View style={s.strengthRow}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={[s.strengthBar, { backgroundColor: i <= strength.bars ? strength.color : theme.cardBorder }]} />
              ))}
              <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}

          {/* Confirm Password Field */}
          <View style={{ marginBottom: 14 }}>
            <Text style={s.fieldLabel}>Confirm new password</Text>
            <View style={s.passwordContainer}>
              <TextInput
                style={s.passwordInput}
                placeholder="Confirm new password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name={showConfirm ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Match indicator */}
          {confirmPassword.length > 0 && newPassword.length > 0 && (
            <Text style={[s.matchText, { color: newPassword === confirmPassword ? theme.success : theme.danger }]}>
              {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
            </Text>
          )}

          <TouchableOpacity style={s.updateBtn} onPress={handleUpdatePassword} disabled={updatingPwd}>
            {updatingPwd
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.updateBtnText}>Update Password</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut ? (
            <ActivityIndicator color={theme.danger} />
          ) : (
            <Text style={s.logoutText}>🚪  Logout</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Custom Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>Logout</Text>
            <Text style={s.modalMessage}>Are you sure you want to logout?</Text>
            <View style={s.modalButtons}>
              <TouchableOpacity 
                style={[s.modalButton, s.modalCancelButton]} 
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.modalButton, s.modalLogoutButton]} 
                onPress={performLogout}
              >
                <Text style={s.modalLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Message Modal */}
      <Modal
        visible={showMessageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={[s.modalTitle, isSuccess && s.modalSuccessTitle]}>{messageTitle}</Text>
            <Text style={s.modalMessage}>{messageText}</Text>
            <TouchableOpacity 
              style={[s.modalButton, s.modalConfirmButton]} 
              onPress={() => setShowMessageModal(false)}
            >
              <Text style={s.modalConfirmText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, backgroundColor: t.card, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.cardBorder,
  },
  backArrow: { color: t.textPrimary, fontSize: 18 },
  headerTitle: { color: t.textPrimary, fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  userName: { color: t.textPrimary, fontSize: 18, fontWeight: '700' },
  userSince: { color: t.textMuted, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: t.card, borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: t.cardBorder,
  },
  cardTitle: { color: t.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.cardBorder,
  },
  infoLabel: { color: t.textMuted, fontSize: 14 },
  infoValue: { color: t.textPrimary, fontSize: 14, fontWeight: '600' },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeLabel: { color: t.textPrimary, fontSize: 15, fontWeight: '600' },
  themeSub: { color: t.textMuted, fontSize: 12, marginTop: 2 },
  themeToggle: { flexDirection: 'row', alignItems: 'center' },
  themeTrack: {
    width: 46, height: 26, borderRadius: 13,
    justifyContent: 'center', padding: 2,
  },
  themeThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
  },
  fieldLabel: { color: t.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: t.inputBg, borderRadius: 12,
    borderWidth: 1, borderColor: t.inputBorder,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: t.textPrimary,
  },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 13 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -8, marginBottom: 14 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 11, minWidth: 56, marginLeft: 8 },
  matchText: { fontSize: 12, fontWeight: '600', marginBottom: 14, marginTop: -6 },
  updateBtn: { backgroundColor: t.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  updateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: t.card, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: t.danger + '60',
    marginBottom: 16,
  },
  logoutText: { color: t.danger, fontSize: 15, fontWeight: '700' },
  
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
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: t.cardBorder,
  },
  modalLogoutButton: {
    backgroundColor: t.danger,
  },
  modalConfirmButton: {
    backgroundColor: t.accent,
  },
  modalCancelText: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalLogoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});