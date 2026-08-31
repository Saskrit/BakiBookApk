import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import {
  fetchCustomerBackup,
  fetchShopBackup,
  restoreShopBackup,
  type ShopBackupPayload,
  type CustomerBackupPayload,
  type RestoreBackupStats,
} from '../../api/backup';
import { Button, ErrorText, LoadingState } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography as ty } from '../../theme/typography';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  downloadDriveBackup,
  getLastBackupMeta,
  getStoredDriveEmail,
  isDriveConnected,
  listDriveBackups,
  parseBackupJson,
  uploadBackupToDrive,
  type DriveBackupFile,
} from '../../utils/googleDrive';
import { isGoogleSignInAvailable } from '../../utils/googleSignIn';

function formatDateTime(iso: string | null | undefined, locale: string) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale === 'ne-NP' ? 'ne-NP' : 'en-NP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupRestoreScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const locale = i18n.language === 'ne' ? 'ne-NP' : 'en-NP';
  const isCustomer = user?.role === 'customer';
  const isShopkeeper = user?.role === 'shopkeeper';
  const isOwner = isShopkeeper && user?.canEditShop !== false;
  const canBackup = isCustomer || isOwner;
  const driveReady = isGoogleSignInAvailable();
  const accountEmail = user?.email?.trim() || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [cloudBackups, setCloudBackups] = useState<DriveBackupFile[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showRestorePicker, setShowRestorePicker] = useState(false);
  const [loadingRestoreList, setLoadingRestoreList] = useState(false);
  const [error, setError] = useState('');

  const shopOwnerId = user?.shopOwnerId || user?.id || '';

  const loadMeta = useCallback(async () => {
    const [isConnected, email, last] = await Promise.all([
      isDriveConnected(accountEmail),
      getStoredDriveEmail(),
      getLastBackupMeta(),
    ]);
    const matchesAccount = Boolean(email && accountEmail && email.toLowerCase() === accountEmail.toLowerCase());
    setConnected(isConnected && matchesAccount);
    setDriveEmail(matchesAccount ? email : null);
    setLastBackupAt(last.at);
  }, [accountEmail]);

  useEffect(() => {
    loadMeta()
      .catch((err) => setError(err instanceof Error ? err.message : t('backupRestore.loadFailed')))
      .finally(() => setLoading(false));
  }, [loadMeta, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadMeta();
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.failedToRefresh'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnect = async () => {
    if (!canBackup || !accountEmail || !driveReady) return;
    setConnecting(true);
    setError('');
    try {
      const email = await connectGoogleDrive(accountEmail);
      setDriveEmail(email);
      setConnected(true);
      appAlert(t('backupRestore.connectedTitle'), t('backupRestore.connectedBody', { email }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('backupRestore.connectFailed');
      setError(message);
      if (err instanceof Error && err.message !== t('auth.googleCancelled')) {
        appAlert(t('common.error'), message);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    appAlert(t('backupRestore.disconnectTitle'), t('backupRestore.disconnectBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backupRestore.disconnect'),
        style: 'destructive',
        onPress: async () => {
          setDisconnecting(true);
          try {
            await disconnectGoogleDrive();
            setConnected(false);
            setDriveEmail(null);
            setCloudBackups([]);
            setError('');
          } catch (err) {
            appAlert(
              t('common.error'),
              err instanceof Error ? err.message : t('backupRestore.disconnectFailed')
            );
          } finally {
            setDisconnecting(false);
          }
        },
      },
    ]);
  };

  const handleBackup = async () => {
    if (!canBackup || !accountEmail || !connected) return;
    setBackingUp(true);
    setError('');
    try {
      const { backup } = isCustomer ? await fetchCustomerBackup() : await fetchShopBackup();
      const json = JSON.stringify(backup);
      const labelName = isCustomer
        ? (backup as CustomerBackupPayload).profile?.fullName || user?.fullName || 'customer'
        : (backup as ShopBackupPayload).summary.shopName ||
          (backup as ShopBackupPayload).shop.shopName ||
          user?.shopName ||
          'shop';
      const ownerKey = isCustomer
        ? (backup as CustomerBackupPayload).userId
        : (backup as ShopBackupPayload).shopOwnerId;
      const result = await uploadBackupToDrive(json, {
        shopName: labelName,
        shopOwnerId: ownerKey,
        exportedAt: backup.exportedAt,
        accountEmail,
      });
      setLastBackupAt(backup.exportedAt);
      const email = await getStoredDriveEmail();
      setDriveEmail(email);
      setConnected(true);
      appAlert(t('backupRestore.backupDoneTitle'), t('backupRestore.backupDoneBody', { name: result.fileName }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('backupRestore.backupFailed');
      setError(message);
      appAlert(t('common.error'), message);
    } finally {
      setBackingUp(false);
    }
  };

  const openRestorePicker = async () => {
    if (isCustomer) {
      appAlert(t('backupRestore.customerRestoreTitle'), t('backupRestore.customerRestoreBody'));
      return;
    }
    if (!isOwner || !accountEmail) return;

    setShowRestorePicker(true);
    setLoadingRestoreList(true);
    setError('');
    try {
      const files = await listDriveBackups(accountEmail);
      setCloudBackups(files);
    } catch (err) {
      setShowRestorePicker(false);
      appAlert(t('common.error'), err instanceof Error ? err.message : t('backupRestore.downloadFailed'));
    } finally {
      setLoadingRestoreList(false);
    }
  };

  const confirmRestore = (file: DriveBackupFile, backup: ShopBackupPayload) => {
    const sameShop = !backup.shopOwnerId || backup.shopOwnerId === shopOwnerId;
    const body = sameShop
      ? t('backupRestore.restoreConfirmBody', {
          date: formatDateTime(backup.exportedAt, locale),
          customers: backup.summary.customerCount,
        })
      : t('backupRestore.restoreDifferentShopBody', {
          shop: backup.summary.shopName || backup.shop.shopName || '—',
        });

    appAlert(t('backupRestore.restoreConfirmTitle'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backupRestore.restoreAction'),
        style: 'destructive',
        onPress: () => void runRestore(file.id, backup),
      },
    ]);
  };

  const runRestore = async (fileId: string, knownBackup?: ShopBackupPayload) => {
    setRestoringId(fileId);
    setError('');
    try {
      const raw = knownBackup ? JSON.stringify(knownBackup) : await downloadDriveBackup(fileId, accountEmail);
      const backup = knownBackup || (parseBackupJson(raw) as ShopBackupPayload);
      const { stats } = await restoreShopBackup(backup, 'merge');
      await refreshUser();
      setShowRestorePicker(false);
      appAlert(t('backupRestore.restoreDoneTitle'), formatRestoreStats(stats, t));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('backupRestore.restoreFailed');
      setError(message);
      appAlert(t('common.error'), message);
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreTap = async (file: DriveBackupFile) => {
    setRestoringId(file.id);
    try {
      const raw = await downloadDriveBackup(file.id, accountEmail);
      const backup = parseBackupJson(raw) as ShopBackupPayload;
      if ((backup as { backupType?: string }).backupType === 'customer') {
        appAlert(t('common.error'), t('backupRestore.wrongBackupType'));
        return;
      }
      confirmRestore(file, backup);
    } catch (err) {
      appAlert(t('common.error'), err instanceof Error ? err.message : t('backupRestore.downloadFailed'));
    } finally {
      setRestoringId(null);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <View style={brStyles.screen}>
      <View style={[brStyles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={brStyles.backBtn}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 6 L9 12 L15 18" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={brStyles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={brStyles.headerTitle}>{t('backupRestore.title')}</Text>
      </View>

      <ScrollView
        style={brStyles.body}
        contentContainerStyle={[brStyles.bodyContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {!canBackup ? (
          <View style={brStyles.noticeCard}>
            <Text style={brStyles.noticeTitle}>{t('backupRestore.ownerOnlyTitle')}</Text>
            <Text style={brStyles.noticeBody}>{t('backupRestore.ownerOnlyBody')}</Text>
          </View>
        ) : null}

        {!driveReady ? (
          <View style={[brStyles.noticeCard, brStyles.noticeWarn]}>
            <Text style={brStyles.noticeTitle}>{t('backupRestore.googleNotConfigured')}</Text>
            <Text style={brStyles.noticeBody}>{t('backupRestore.googleBuildHint')}</Text>
          </View>
        ) : null}

        {canBackup && driveReady ? (
          <View style={brStyles.card}>
            <View style={brStyles.driveRow}>
              <View style={brStyles.driveBadge}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M8 18 L4 12 L8 6 L16 6 L20 12 L16 18 Z"
                    stroke="#2563EB"
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                  />
                  <Path d="M4 12 H20" stroke="#2563EB" strokeWidth={1.8} />
                </Svg>
              </View>
              <View style={brStyles.driveCopy}>
                <Text style={brStyles.driveTitle}>{t('backupRestore.driveTitle')}</Text>
                <Text style={[brStyles.driveStatus, connected ? brStyles.statusConnected : brStyles.statusIdle]}>
                  {connected ? t('backupRestore.connected') : t('backupRestore.notConnected')}
                </Text>
              </View>
            </View>

            {!connected ? (
              <>
                <Text style={brStyles.connectHint}>
                  {t('backupRestore.connectHint', { email: accountEmail })}
                </Text>
                <Button
                  title={connecting ? t('backupRestore.connecting') : t('backupRestore.connectGoogleDrive')}
                  onPress={() => void handleConnect()}
                  loading={connecting}
                  large
                />
              </>
            ) : (
              <>
                <Text style={brStyles.emailText}>{driveEmail || accountEmail}</Text>

                <View style={brStyles.lastBackupBlock}>
                  <Text style={brStyles.lastBackupLabel}>{t('backupRestore.lastBackup')}</Text>
                  <Text style={brStyles.lastBackupValue}>
                    {lastBackupAt ? formatDateTime(lastBackupAt, locale) : t('backupRestore.never')}
                  </Text>
                </View>

                <View style={brStyles.actionStack}>
                  <Button
                    title={backingUp ? t('backupRestore.backingUp') : t('backupRestore.backupNow')}
                    onPress={() => void handleBackup()}
                    loading={backingUp}
                    large
                  />
                  <Button
                    title={t('backupRestore.restoreBackup')}
                    variant="outline"
                    onPress={() => void openRestorePicker()}
                    disabled={backingUp || disconnecting}
                    large
                  />
                  <Button
                    title={disconnecting ? t('common.loading') : t('backupRestore.disconnect')}
                    variant="danger"
                    onPress={handleDisconnect}
                    loading={disconnecting}
                    disabled={backingUp}
                    large
                  />
                </View>
              </>
            )}
          </View>
        ) : null}

        {error ? <ErrorText message={error} /> : null}
      </ScrollView>

      <Modal
        visible={showRestorePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRestorePicker(false)}
      >
        <View style={brStyles.modalOverlay}>
          <View style={[brStyles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={brStyles.modalHeader}>
              <Text style={brStyles.modalTitle}>{t('backupRestore.restoreBackup')}</Text>
              <Pressable onPress={() => setShowRestorePicker(false)} hitSlop={8}>
                <Text style={brStyles.modalClose}>{t('common.cancel')}</Text>
              </Pressable>
            </View>

            {loadingRestoreList ? (
              <View style={brStyles.modalLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : cloudBackups.length === 0 ? (
              <Text style={brStyles.emptyText}>{t('backupRestore.noCloudBackups')}</Text>
            ) : (
              <ScrollView style={brStyles.modalList}>
                {cloudBackups.map((file) => {
                  const busy = restoringId === file.id;
                  return (
                    <Pressable
                      key={file.id}
                      style={brStyles.backupRow}
                      onPress={() => void handleRestoreTap(file)}
                      disabled={Boolean(restoringId)}
                    >
                      <View style={brStyles.backupMeta}>
                        <Text style={brStyles.backupName} numberOfLines={2}>
                          {file.name}
                        </Text>
                        <Text style={brStyles.backupDate}>
                          {formatDateTime(file.modifiedTime, locale)}
                          {file.size ? ` · ${formatFileSize(file.size)}` : ''}
                        </Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={brStyles.restoreLink}>{t('backupRestore.restore')}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatRestoreStats(stats: RestoreBackupStats, t: (key: string, opts?: Record<string, unknown>) => string) {
  return [
    t('backupRestore.restoreStatsCustomers', {
      added: stats.customersAdded,
      skipped: stats.customersSkipped,
    }),
    t('backupRestore.restoreStatsCredits', {
      added: stats.transactionsAdded,
      skipped: stats.transactionsSkipped,
    }),
    t('backupRestore.restoreStatsPayments', {
      added: stats.paymentsAdded,
      skipped: stats.paymentsSkipped,
    }),
  ].join('\n');
}

const brStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F5F7' },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF2',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  backText: { color: colors.text, fontSize: ty.body, fontWeight: '600' },
  headerTitle: { fontSize: ty.h1, fontWeight: '800', color: colors.text },
  body: { flex: 1 },
  bodyContent: { padding: spacing.md, gap: spacing.md },
  noticeCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  noticeWarn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  noticeTitle: { fontWeight: '700', color: colors.text, fontSize: ty.bodyLg },
  noticeBody: { marginTop: 6, color: colors.textMuted, fontSize: ty.body, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    gap: spacing.md,
  },
  driveRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driveBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driveCopy: { flex: 1 },
  driveTitle: { fontWeight: '800', fontSize: ty.h2, color: colors.text },
  driveStatus: { marginTop: 4, fontSize: ty.body, fontWeight: '600' },
  statusConnected: { color: '#16A34A' },
  statusIdle: { color: colors.textMuted },
  connectHint: {
    fontSize: ty.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  emailText: {
    fontSize: ty.bodyLg,
    fontWeight: '700',
    color: colors.text,
  },
  lastBackupBlock: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    gap: 4,
  },
  lastBackupLabel: {
    fontSize: ty.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  lastBackupValue: { fontSize: ty.bodyLg, fontWeight: '700', color: colors.text },
  actionStack: { gap: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: ty.h2, fontWeight: '800', color: colors.text },
  modalClose: { fontSize: ty.body, fontWeight: '700', color: colors.primary },
  modalLoading: { paddingVertical: 40, alignItems: 'center' },
  modalList: { maxHeight: 420 },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: ty.body,
    paddingVertical: 32,
    paddingHorizontal: spacing.md,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backupMeta: { flex: 1 },
  backupName: { fontSize: ty.body, fontWeight: '600', color: colors.text },
  backupDate: { marginTop: 2, fontSize: ty.caption, color: colors.textMuted },
  restoreLink: { fontSize: ty.body, fontWeight: '700', color: colors.primaryDark },
});
