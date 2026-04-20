import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Modal, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';
import { useTheme } from '../context/Theme';

export default function DashboardScreen({ navigation }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const s = makeStyles(theme);

  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({ total: 0, low: 0, critical: 0 });
  
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

  const fetchItems = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/stock/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setItems(data);
      const low = data.filter(i => i.remaining_quantity <= (i.baseline_daily_usage || 0) * 3).length;
      const critical = data.filter(i => i.remaining_quantity <= (i.baseline_daily_usage || 0)).length;
      setSummary({ total: data.length, low, critical });
    } catch {
      showMessage('Error', 'Failed to load items');
    }
  }, []);

  React.useEffect(() => {
    const unsub = navigation.addListener('focus', fetchItems);
    return unsub;
  }, [navigation, fetchItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const getStatusColor = (item) => {
    const days = item.baseline_daily_usage > 0 ? item.remaining_quantity / item.baseline_daily_usage : 999;
    if (days <= 1) return theme.danger;
    if (days <= 3) return theme.warning;
    return theme.success;
  };

  const getDaysLeft = (item) => {
    if (!item.baseline_daily_usage || item.baseline_daily_usage === 0) return '∞';
    return Math.floor(item.remaining_quantity / item.baseline_daily_usage);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello 👋</Text>
          <Text style={s.headerTitle}>Inventory</Text>
        </View>
        <View style={s.headerRight}>
          {/* Theme toggle */}
          <TouchableOpacity onPress={toggleTheme} style={s.iconBtn}>
            <Text style={{ fontSize: 18 }}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          {/* Profile button */}
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={s.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, { borderTopColor: theme.accent }]}>
          <Text style={s.summaryNum}>{summary.total}</Text>
          <Text style={s.summaryLabel}>Total Items</Text>
        </View>
        <View style={[s.summaryCard, { borderTopColor: theme.warning }]}>
          <Text style={[s.summaryNum, { color: theme.warning }]}>{summary.low}</Text>
          <Text style={s.summaryLabel}>Low Stock</Text>
        </View>
        <View style={[s.summaryCard, { borderTopColor: theme.danger }]}>
          <Text style={[s.summaryNum, { color: theme.danger }]}>{summary.critical}</Text>
          <Text style={s.summaryLabel}>Critical</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={s.actionRow}>
        <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('AddStock')}>
          <Text style={s.actionIcon}>➕</Text>
          <Text style={s.actionLabel}>Add Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('DailyUsage')}>
          <Text style={s.actionIcon}>📝</Text>
          <Text style={s.actionLabel}>Log Usage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('Reports')}>
          <Text style={s.actionIcon}>📊</Text>
          <Text style={s.actionLabel}>Reports</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Stock Items</Text>

      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📦</Text>
            <Text style={s.emptyText}>No items yet</Text>
            <Text style={s.emptySubtext}>Tap "Add Stock" to get started</Text>
          </View>
        )}
        {items.map(item => (
          <TouchableOpacity
            key={item._id}
            style={s.itemCard}
            onPress={() => navigation.navigate('DailyUsage', { itemId: item._id, itemName: item.name })}
          >
            <View style={s.itemLeft}>
              <View style={[s.statusDot, { backgroundColor: getStatusColor(item) }]} />
              <View>
                <Text style={s.itemName}>{item.name}</Text>
                <Text style={s.itemSub}>
                  {item.period === 'weekly' ? '7-day' : item.period === 'monthly' ? '30-day' : `${item.custom_days || '?'}-day`} stock
                </Text>
              </View>
            </View>
            <View style={s.itemRight}>
              <Text style={s.itemQty}>{item.remaining_quantity.toFixed(1)}</Text>
              <Text style={s.itemUnit}>{item.unit}</Text>
              <Text style={[s.daysLeft, { color: getStatusColor(item) }]}>
                {getDaysLeft(item)}d left
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
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
              onPress={() => setShowModal(false)}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
  },
  greeting: { color: t.textMuted, fontSize: 13, marginBottom: 2 },
  headerTitle: { color: t.textPrimary, fontSize: 26, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  iconBtn: {
    width: 40, height: 40, backgroundColor: t.card,
    borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: t.cardBorder,
  },
  profileBtn: {
    width: 40, height: 40, backgroundColor: t.card,
    borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: t.cardBorder,
  },
  profileIcon: { fontSize: 18 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: t.card, borderRadius: 14, padding: 14,
    borderTopWidth: 3, borderWidth: 1, borderColor: t.cardBorder,
  },
  summaryNum: { color: t.textPrimary, fontSize: 24, fontWeight: '800' },
  summaryLabel: { color: t.textMuted, fontSize: 11, marginTop: 2 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1, backgroundColor: t.card, borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: t.cardBorder,
  },
  actionIcon: { fontSize: 22, marginBottom: 4 },
  actionLabel: { color: t.textSecondary, fontSize: 11, fontWeight: '600' },
  sectionTitle: {
    color: t.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5,
    textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 10,
  },
  list: { flex: 1, paddingHorizontal: 20 },
  itemCard: {
    backgroundColor: t.card, borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: t.cardBorder,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  itemName: { color: t.textPrimary, fontSize: 15, fontWeight: '600' },
  itemSub: { color: t.textMuted, fontSize: 12, marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemQty: { color: t.textPrimary, fontSize: 18, fontWeight: '700' },
  itemUnit: { color: t.textMuted, fontSize: 12 },
  daysLeft: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: t.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: t.textMuted, fontSize: 14, marginTop: 6 },

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