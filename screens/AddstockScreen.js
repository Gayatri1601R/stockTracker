import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, ActivityIndicator, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';
import { useTheme } from '../context/Theme';

const UNIT_OPTIONS = ['kg', 'L', 'pcs', 'boxes', 'bags', 'bottles', 'packets'];

// Quick-pick presets shown when Custom is selected
const CUSTOM_PRESETS = [2, 3, 5, 10, 14, 21, 45, 60, 90];

export default function AddStockScreen({ navigation }) {
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [period, setPeriod] = useState('weekly');   // 'weekly' | 'monthly' | 'custom'
  const [customDays, setCustomDays] = useState('');
  const [loading, setLoading] = useState(false);
  
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

  // Returns the effective day count for the live preview
  const getEffectiveDays = () => {
    if (period === 'weekly') return 7;
    if (period === 'monthly') return 30;
    const d = parseInt(customDays, 10);
    return isNaN(d) ? 0 : d;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !quantity) {
      showMessage('Missing Fields', 'Please enter item name and quantity');
      return;
    }
    if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      showMessage('Invalid Quantity', 'Please enter a valid positive number');
      return;
    }
    if (period === 'custom') {
      const d = parseInt(customDays, 10);
      if (!customDays || isNaN(d) || d < 1 || d > 365) {
        showMessage('Invalid Days', 'Custom period must be between 1 and 365 days');
        return;
      }
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/stock/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          purchased_quantity: parseFloat(quantity),
          unit,
          period,
          // Only sent when period === 'custom'; backend ignores it otherwise
          custom_days: period === 'custom' ? parseInt(customDays, 10) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add item');

      showMessage(
        '✅ Item Added',
        `"${name}" added successfully.\nNow set the daily usage baseline on first day.`,
        true,
        () => navigation.navigate('DailyUsage', {
          itemId: data._id,
          itemName: data.name,
          isFirstTime: true,
        })
      );
    } catch (e) {
      showMessage('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    if (modalConfig.onConfirm) {
      modalConfig.onConfirm();
    }
  };

  const days = getEffectiveDays();
  const dailyEst = days > 0 && quantity
    ? (parseFloat(quantity) / days).toFixed(2)
    : null;

  const periodLabel = () => {
    if (period === 'weekly') return '7 days (weekly)';
    if (period === 'monthly') return '30 days (monthly)';
    return days > 0 ? `${days} days (custom)` : 'custom';
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>⬅</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add New Stock</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Info Banner */}
        <View style={s.infoBanner}>
          <Text style={s.infoIcon}>💡</Text>
          <Text style={s.infoText}>
            After adding, you'll set the baseline daily usage for the first day.
            This becomes the reference for all future reports.
          </Text>
        </View>

        {/* Item Name */}
        <View style={s.section}>
          <Text style={s.label}>Item Name</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Rice, Cooking Oil, Sugar..."
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Quantity */}
        <View style={s.section}>
          <Text style={s.label}>Total Quantity Purchased</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. 50"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            value={quantity}
            onChangeText={setQuantity}
          />
        </View>

        {/* Unit Selection */}
        <View style={s.section}>
          <Text style={s.label}>Unit</Text>
          <View style={s.chipRow}>
            {UNIT_OPTIONS.map(u => (
              <TouchableOpacity
                key={u}
                style={[s.chip, unit === u && s.chipActive]}
                onPress={() => setUnit(u)}
              >
                <Text style={[s.chipText, unit === u && s.chipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Period Selection — Weekly / Monthly / Custom */}
        <View style={s.section}>
          <Text style={s.label}>Stock Duration</Text>
          <Text style={s.sublabel}>How long is this stock meant to last?</Text>

          <View style={s.periodRow}>
            {/* Weekly */}
            <TouchableOpacity
              style={[s.periodCard, period === 'weekly' && s.periodCardActive]}
              onPress={() => setPeriod('weekly')}
              activeOpacity={0.8}
            >
              {period === 'weekly' && (
                <View style={s.periodCheck}>
                  <Text style={s.periodCheckText}>✓</Text>
                </View>
              )}
              <Text style={s.periodIcon}>📅</Text>
              <Text style={[s.periodLabel, period === 'weekly' && s.periodLabelActive]}>
                Weekly
              </Text>
              <Text style={[s.periodSub, period === 'weekly' && s.periodSubActive]}>
                7 days
              </Text>
            </TouchableOpacity>

            {/* Monthly */}
            <TouchableOpacity
              style={[s.periodCard, period === 'monthly' && s.periodCardActive]}
              onPress={() => setPeriod('monthly')}
              activeOpacity={0.8}
            >
              {period === 'monthly' && (
                <View style={s.periodCheck}>
                  <Text style={s.periodCheckText}>✓</Text>
                </View>
              )}
              <Text style={s.periodIcon}>🗓️</Text>
              <Text style={[s.periodLabel, period === 'monthly' && s.periodLabelActive]}>
                Monthly
              </Text>
              <Text style={[s.periodSub, period === 'monthly' && s.periodSubActive]}>
                30 days
              </Text>
            </TouchableOpacity>

            {/* Custom */}
            <TouchableOpacity
              style={[s.periodCard, period === 'custom' && s.periodCardActive]}
              onPress={() => setPeriod('custom')}
              activeOpacity={0.8}
            >
              {period === 'custom' && (
                <View style={s.periodCheck}>
                  <Text style={s.periodCheckText}>✓</Text>
                </View>
              )}
              <Text style={s.periodIcon}>⚙️</Text>
              <Text style={[s.periodLabel, period === 'custom' && s.periodLabelActive]}>
                Custom
              </Text>
              <Text style={[s.periodSub, period === 'custom' && s.periodSubActive]}>
                You choose
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom days input — visible only when Custom is selected */}
          {period === 'custom' && (
            <View style={s.customBox}>
              <Text style={s.customBoxLabel}>Number of days</Text>

              {/* Input + "days" badge */}
              <View style={s.customInputRow}>
                <TextInput
                  style={[s.input, s.customInput]}
                  placeholder="e.g. 3, 5, 10, 14…"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  value={customDays}
                  onChangeText={setCustomDays}
                />
                <View style={s.daysBadge}>
                  <Text style={s.daysBadgeText}>days</Text>
                </View>
              </View>

              {/* Quick-pick preset buttons */}
              <View style={s.presetRow}>
                <Text style={s.presetRowLabel}>Quick pick: </Text>
                <View style={s.presetChips}>
                  {CUSTOM_PRESETS.map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        s.presetChip,
                        customDays === String(d) && s.presetChipActive,
                      ]}
                      onPress={() => setCustomDays(String(d))}
                    >
                      <Text style={[
                        s.presetChipText,
                        customDays === String(d) && s.presetChipTextActive,
                      ]}>
                        {d}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Live Preview Card */}
        {name.trim() && quantity && days > 0 && (
          <View style={s.previewCard}>
            <Text style={s.previewTitle}>📋 Preview</Text>
            <Text style={s.previewText}>
              <Text style={s.previewBold}>{name}</Text>
              {' '}— {quantity} {unit} for {periodLabel()}
            </Text>
            {dailyEst && (
              <Text style={s.previewSub}>≈ {dailyEst} {unit}/day available</Text>
            )}
          </View>
        )}

        <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitText}>Add Stock Item →</Text>
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
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={[s.modalTitle, modalConfig.isSuccess && s.modalSuccessTitle]}>
              {modalConfig.title}
            </Text>
            <Text style={s.modalMessage}>{modalConfig.message}</Text>
            <TouchableOpacity 
              style={[s.modalButton, modalConfig.isSuccess ? s.modalSuccessButton : s.modalErrorButton]} 
              onPress={handleModalClose}
            >
              <Text style={s.modalButtonText}>OK</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40,
    backgroundColor: t.card,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  backArrow: { color: t.textPrimary, fontSize: 20 },
  headerTitle: { color: t.textPrimary, fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: 20 },

  infoBanner: {
    backgroundColor: t.infoBg,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: t.infoBorder,
  },
  infoIcon: { fontSize: 18 },
  infoText: { color: t.infoText, fontSize: 13, flex: 1, lineHeight: 19 },

  section: { marginBottom: 24 },
  label: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sublabel: { color: t.textMuted, fontSize: 12, marginBottom: 10, marginTop: -4 },

  input: {
    backgroundColor: t.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: t.textPrimary,
    borderWidth: 1,
    borderColor: t.inputBorder,
  },

  // Unit chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  chipActive: { backgroundColor: t.accentDark, borderColor: t.accent },
  chipText: { color: t.textMuted, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  // Period cards — three across
  periodRow: { flexDirection: 'row', gap: 8 },
  periodCard: {
    flex: 1,
    backgroundColor: t.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: t.cardBorder,
    position: 'relative',
  },
  periodCardActive: { borderColor: t.accent, backgroundColor: t.infoBg },
  periodIcon: { fontSize: 22, marginBottom: 6 },
  periodLabel: { color: t.textMuted, fontSize: 13, fontWeight: '600' },
  periodLabelActive: { color: t.textPrimary },
  periodSub: { color: t.textMuted, fontSize: 11, marginTop: 2 },
  periodSubActive: { color: t.infoText },
  periodCheck: {
    position: 'absolute',
    top: 6, right: 6,
    backgroundColor: t.accent,
    width: 16, height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCheckText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Custom days section
  customBox: {
    marginTop: 14,
    backgroundColor: t.bgTertiary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  customBoxLabel: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  customInput: { flex: 1 },
  daysBadge: {
    backgroundColor: t.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  daysBadgeText: { color: t.textSecondary, fontSize: 14, fontWeight: '600' },

  // Quick-pick presets
  presetRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  presetRowLabel: { color: t.textMuted, fontSize: 12 },
  presetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  presetChipActive: { backgroundColor: t.accent, borderColor: t.accent },
  presetChipText: { color: t.textMuted, fontSize: 12, fontWeight: '600' },
  presetChipTextActive: { color: '#fff' },

  // Preview card
  previewCard: {
    backgroundColor: t.mode === 'dark' ? '#1E3B2E' : '#F0FDF4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: t.mode === 'dark' ? '#166534' : '#86EFAC',
  },
  previewTitle: {
    color: t.mode === 'dark' ? '#86EFAC' : '#15803D',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  previewText: {
    color: t.mode === 'dark' ? '#D1FAE5' : '#14532D',
    fontSize: 14,
    lineHeight: 21,
  },
  previewBold: { fontWeight: '700' },
  previewSub: {
    color: t.mode === 'dark' ? '#6EE7B7' : '#16A34A',
    fontSize: 12,
    marginTop: 4,
  },

  submitBtn: {
    backgroundColor: t.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
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
  modalButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
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