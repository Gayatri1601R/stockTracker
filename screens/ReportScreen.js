import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/api';
import { useTheme } from '../context/Theme.js';

export default function ReportsScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [reportType, setReportType] = useState('weekly');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  
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

  useEffect(() => {
    fetchReports();
  }, [reportType]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        showMessage('Error', 'Not authenticated. Please login again.');
        navigation.replace('Login');
        return;
      }
      
      const res = await fetch(`${API_BASE}/reports?period=${reportType}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.status === 401) {
        showMessage('Session Expired', 'Please login again.');
        await AsyncStorage.removeItem('token');
        navigation.replace('Login');
        return;
      }
      
      const data = await res.json();
      setReports(data.items || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.log('Fetch reports error:', error);
      showMessage('Error', 'Failed to load reports. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const getConsumptionStatus = (item) => {
    if (!item.baseline_usage) return { color: '#64748B', label: 'No baseline' };
    const ratio = item.total_consumed / item.baseline_usage;
    if (ratio > 1.2) return { color: '#EF4444', label: '🔴 Over baseline' };
    if (ratio > 0.9) return { color: '#10B981', label: '🟢 On track' };
    if (ratio > 0.6) return { color: '#F59E0B', label: '🟡 Under used' };
    return { color: '#64748B', label: 'Low usage' };
  };

  const getProgressWidth = (consumed, baseline) => {
    if (!baseline || baseline === 0) return 0;
    return Math.min((consumed / baseline) * 100, 150); // allow over 100%
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>⬅</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📊 Consumption Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period Toggle */}
      <View style={styles.toggleContainer}>
        {['weekly', 'monthly'].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.toggleBtn, reportType === t && styles.toggleBtnActive]}
            onPress={() => setReportType(t)}
          >
            <Text style={[styles.toggleText, reportType === t && styles.toggleTextActive]}>
              {t === 'weekly' ? '📅 This Week' : '🗓️ This Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Banner */}
      {summary && (
        <View style={styles.summaryBanner}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{summary.total_items}</Text>
            <Text style={styles.summaryLbl}>Items tracked</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{summary.on_track}</Text>
            <Text style={styles.summaryLbl}>On track</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#EF4444' }]}>{summary.over_baseline}</Text>
            <Text style={styles.summaryLbl}>Over baseline</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#F59E0B' }]}>{summary.low_stock}</Text>
            <Text style={styles.summaryLbl}>Low stock</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {reports.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📉</Text>
              <Text style={styles.emptyText}>No data yet</Text>
              <Text style={styles.emptySubtext}>Start logging daily usage to see reports</Text>
            </View>
          )}

          {reports.map(item => {
            const status = getConsumptionStatus(item);
            const progressPct = getProgressWidth(item.total_consumed, item.baseline_usage);
            const daysLeft = item.baseline_daily_usage > 0
              ? Math.floor(item.remaining_quantity / item.baseline_daily_usage)
              : null;

            return (
              <View key={item._id} style={styles.reportCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
                  </View>
                  <View style={styles.remainingBox}>
                    <Text style={styles.remainingVal}>{item.remaining_quantity.toFixed(1)}</Text>
                    <Text style={styles.remainingUnit}>{item.unit} left</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Consumed vs Baseline</Text>
                    <Text style={styles.progressPct}>{progressPct.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(progressPct, 100)}%`,
                        backgroundColor: progressPct > 100 ? '#EF4444' : progressPct > 80 ? '#F59E0B' : '#10B981'
                      }
                    ]} />
                    {/* Baseline marker at 100% */}
                    <View style={styles.baselineMarker} />
                  </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridVal}>{item.total_consumed.toFixed(1)}</Text>
                    <Text style={styles.gridLabel}>{item.unit} consumed</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridVal}>{item.baseline_usage?.toFixed(1) ?? '—'}</Text>
                    <Text style={styles.gridLabel}>{item.unit} baseline</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridVal}>{item.avg_daily?.toFixed(2) ?? '—'}</Text>
                    <Text style={styles.gridLabel}>{item.unit}/day avg</Text>
                  </View>
                  {daysLeft !== null && (
                    <View style={styles.gridItem}>
                      <Text style={[
                        styles.gridVal,
                        { color: daysLeft <= 1 ? '#EF4444' : daysLeft <= 3 ? '#F59E0B' : '#10B981' }
                      ]}>
                        {daysLeft}d
                      </Text>
                      <Text style={styles.gridLabel}>days left</Text>
                    </View>
                  )}
                </View>

                {/* Difference from baseline */}
                {item.baseline_usage > 0 && (
                  <View style={[
                    styles.diffRow,
                    { backgroundColor: item.total_consumed > item.baseline_usage ? `${theme.danger}20` : `${theme.success}20` }
                  ]}>
                    <Text style={{ color: item.total_consumed > item.baseline_usage ? '#FCA5A5' : '#6EE7B7', fontSize: 13 }}>
                      {item.total_consumed > item.baseline_usage ? '⬆️ ' : '⬇️ '}
                      {Math.abs(item.total_consumed - item.baseline_usage).toFixed(2)} {item.unit}
                      {item.total_consumed > item.baseline_usage ? ' over baseline' : ' under baseline'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Custom Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalIcon}>
                {modalConfig.isSuccess ? '✅' : '❌'}
              </Text>
            </View>
            <Text style={[styles.modalTitle, modalConfig.isSuccess && styles.modalSuccessTitle]}>
              {modalConfig.title}
            </Text>
            <Text style={styles.modalMessage}>{modalConfig.message}</Text>
            <TouchableOpacity 
              style={[styles.modalButton, modalConfig.isSuccess ? styles.modalSuccessButton : styles.modalErrorButton]} 
              onPress={() => setShowModal(false)}
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
  headerTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: '700' },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: { backgroundColor: theme.accent },
  toggleText: { color: theme.textSecondary, fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  summaryBanner: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: theme.textPrimary, fontSize: 20, fontWeight: '800' },
  summaryLbl: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
  divider: { width: 1, backgroundColor: theme.cardBorder, marginVertical: 4 },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: theme.textSecondary, fontSize: 14 },
  scroll: { flex: 1, paddingHorizontal: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: theme.textSecondary, fontSize: 14, marginTop: 6, textAlign: 'center' },
  reportCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  itemName: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  statusLabel: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  remainingBox: { alignItems: 'flex-end' },
  remainingVal: { color: theme.textPrimary, fontSize: 22, fontWeight: '800' },
  remainingUnit: { color: theme.textSecondary, fontSize: 11 },
  progressSection: { marginBottom: 14 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: theme.textSecondary, fontSize: 12 },
  progressPct: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },
  progressTrack: {
    height: 6,
    backgroundColor: theme.bgSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  baselineMarker: {
    position: 'absolute',
    right: 0,
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: theme.textSecondary,
    borderRadius: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  gridItem: {
    backgroundColor: theme.bgSecondary,
    borderRadius: 10,
    padding: 10,
    minWidth: 70,
    flex: 1,
  },
  gridVal: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  gridLabel: { color: theme.textSecondary, fontSize: 10, marginTop: 2 },
  diffRow: {
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },

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
    width: '100%',
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