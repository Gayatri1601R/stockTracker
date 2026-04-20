import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, ActivityIndicator, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';
import { useTheme } from '../context/Theme.js';

export default function DailyUsageScreen({ navigation, route }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { itemId, itemName, isFirstTime } = route.params || {};
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [usageQty, setUsageQty] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todayLogged, setTodayLogged] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    isSuccess: false,
    onConfirm: null
  });

  const showMessage = (title, message, isSuccess = false, onConfirm = null) => {
    setModalConfig({ title, message, isSuccess, onConfirm });
    setShowModal(true);
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (itemId && items.length > 0) {
      const found = items.find(i => i._id === itemId);
      if (found) setSelectedItem(found);
    }
  }, [itemId, items]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/stock/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setItems(data);
    } catch {
      showMessage('Error', 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const checkTodayLogged = async (item) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_BASE}/usage/${item._id}/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTodayLogged(data.logged);
      if (data.logged && data.quantity) {
        setUsageQty(String(data.quantity));
      }
    } catch {}
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setUsageQty('');
    setNotes('');
    checkTodayLogged(item);
  };

  const handleModalClose = () => {
    setShowModal(false);
    if (modalConfig.onConfirm) {
      modalConfig.onConfirm();
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem) {
      showMessage('Select Item', 'Please select an item first');
      return;
    }
    if (!usageQty || isNaN(parseFloat(usageQty)) || parseFloat(usageQty) < 0) {
      showMessage('Invalid Quantity', 'Please enter a valid usage amount');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/usage/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: selectedItem._id,
          quantity_used: parseFloat(usageQty),
          notes: notes.trim(),
          is_first_day: isFirstTime || !selectedItem.baseline_daily_usage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to log usage');

      const isBaseline = isFirstTime || !selectedItem.baseline_daily_usage;
      
      showMessage(
        isBaseline ? '📊 Baseline Set!' : '✅ Usage Logged!',
        isBaseline
          ? `Baseline of ${usageQty} ${selectedItem.unit}/day set for "${selectedItem.name}". Future reports will compare against this.`
          : `Usage of ${usageQty} ${selectedItem.unit} logged for today.`,
        true,
        () => navigation.goBack()
      );
    } catch (e) {
      showMessage('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isBaselineMode = isFirstTime || (selectedItem && !selectedItem.baseline_daily_usage);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>⬅</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>
            {isBaselineMode ? '📊 Set Baseline' : '📝 Log Usage'}
          </Text>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Mode Banner */}
        {isBaselineMode && (
          <View style={styles.baselineBanner}>
            <Text style={styles.bannerTitle}>🎯 First Day Setup</Text>
            <Text style={styles.bannerText}>
              Enter how much you typically use per day. This becomes your baseline for all future reports and depletion tracking.
            </Text>
          </View>
        )}

        {/* Item Selection */}
        {!itemId && (
          <View style={styles.section}>
            <Text style={styles.label}>Select Item</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemScroll}>
              {items.map(item => (
                <TouchableOpacity
                  key={item._id}
                  style={[styles.itemChip, selectedItem?._id === item._id && styles.itemChipActive]}
                  onPress={() => handleSelectItem(item)}
                >
                  <Text style={[styles.itemChipText, selectedItem?._id === item._id && styles.itemChipTextActive]}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemChipQty}>{item.remaining_quantity.toFixed(1)} {item.unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Selected Item Details */}
        {selectedItem && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedRow}>
              <Text style={styles.selectedName}>{selectedItem.name}</Text>
              {todayLogged && !isBaselineMode && (
                <View style={styles.loggedBadge}>
                  <Text style={styles.loggedBadgeText}>✓ Logged today</Text>
                </View>
              )}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{selectedItem.remaining_quantity.toFixed(1)}</Text>
                <Text style={styles.statLabel}>{selectedItem.unit} left</Text>
              </View>
              {selectedItem.baseline_daily_usage && (
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{selectedItem.baseline_daily_usage.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>baseline/day</Text>
                </View>
              )}
              {selectedItem.baseline_daily_usage && (
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: theme.success }]}>
                    {Math.floor(selectedItem.remaining_quantity / selectedItem.baseline_daily_usage)}
                  </Text>
                  <Text style={styles.statLabel}>days est.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Usage Input */}
        <View style={styles.section}>
          <Text style={styles.label}>
            {isBaselineMode ? 'Daily Baseline Amount' : "Today's Usage Amount"}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={isBaselineMode ? 'Typical daily amount' : "Amount used today"}
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              value={usageQty}
              onChangeText={setUsageQty}
            />
            {selectedItem && (
              <View style={styles.unitBadge}>
                <Text style={styles.unitText}>{selectedItem.unit}</Text>
              </View>
            )}
          </View>

          {/* Quick fill buttons */}
          {selectedItem?.baseline_daily_usage && !isBaselineMode && (
            <View style={styles.quickFillRow}>
              <Text style={styles.quickLabel}>Quick fill:</Text>
              {[0.5, 0.75, 1, 1.25, 1.5].map(mult => (
                <TouchableOpacity
                  key={mult}
                  style={styles.quickBtn}
                  onPress={() => setUsageQty((selectedItem.baseline_daily_usage * mult).toFixed(2))}
                >
                  <Text style={styles.quickBtnText}>{mult}×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
            placeholder="Any notes about today's usage..."
            placeholderTextColor={theme.textMuted}
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>
                {isBaselineMode ? 'Set as Baseline →' : 'Log Usage →'}
              </Text>
          }
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Custom Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={[styles.modalTitle, modalConfig.isSuccess && styles.modalSuccessTitle]}>
              {modalConfig.title}
            </Text>
            <Text style={styles.modalMessage}>{modalConfig.message}</Text>
            <TouchableOpacity 
              style={[styles.modalButton, modalConfig.isSuccess ? styles.modalSuccessButton : styles.modalErrorButton]} 
              onPress={handleModalClose}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40,
    backgroundColor: theme.card,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  backArrow: { color: theme.textPrimary, fontSize: 20 },
  headerTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  headerDate: { color: theme.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 2 },
  scroll: { flex: 1, paddingHorizontal: 20 },
  baselineBanner: {
    backgroundColor: theme.infoBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.infoBorder,
  },
  bannerTitle: { color: theme.accent, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  bannerText: { color: theme.infoText, fontSize: 13, lineHeight: 19 },
  section: { marginBottom: 24 },
  label: {
    color: theme.textMuted, fontSize: 13, fontWeight: '600',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  itemScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  itemChip: {
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    minWidth: 90,
  },
  itemChipActive: { backgroundColor: theme.bgTertiary, borderColor: theme.accent },
  itemChipText: { color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
  itemChipTextActive: { color: theme.accent },
  itemChipQty: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  selectedCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedName: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  loggedBadge: {
    backgroundColor: theme.success,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  loggedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 20 },
  stat: {},
  statValue: { color: theme.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: theme.textSecondary, fontSize: 11, marginTop: 1 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    backgroundColor: theme.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.inputBorder,
  },
  unitBadge: {
    backgroundColor: theme.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.inputBorder,
  },
  unitText: { color: theme.textSecondary, fontSize: 14, fontWeight: '600' },
  quickFillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  quickLabel: { color: theme.textSecondary, fontSize: 12 },
  quickBtn: {
    backgroundColor: theme.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  quickBtnText: { color: theme.textPrimary, fontSize: 12, fontWeight: '600' },
  submitBtn: {
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSuccessTitle: {
    color: theme.success,
  },
  modalMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSuccessButton: {
    backgroundColor: theme.success,
  },
  modalErrorButton: {
    backgroundColor: theme.accent,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});