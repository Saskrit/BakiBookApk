import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  acceptPaymentSubmission,
  fetchShopkeeperSubmissions,
  rejectPaymentSubmission,
  reportPaymentSubmission,
  type PaymentSubmission,
} from '../../api/paymentSubmissions';
import ScreenHeader from '../../components/ScreenHeader';
import { Button, LoadingState } from '../../components/ui';
import { appAlert } from '../../contexts/DialogContext';
import { useSocket } from '../../contexts/SocketContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { formatRs } from '../../utils/format';
import { normalizeImageUrlSync } from '../../utils/normalizeImageUrl';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentSubmissions'>;
type TabKey = 'pending' | 'all';
type NoteMode = 'reject' | 'report' | null;

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#FFF4E5', fg: '#B26A00' },
  accepted: { bg: '#E8F7EE', fg: '#1F7A43' },
  rejected: { bg: '#FDECEC', fg: '#B42318' },
  reported: { bg: '#F3E8FF', fg: '#7C3AED' },
};

export default function PaymentSubmissionsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { socket } = useSocket();
  const [tab, setTab] = useState<TabKey>(route.params?.initialTab === 'all' ? 'all' : 'pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState('');
  const [rows, setRows] = useState<PaymentSubmission[]>([]);
  const [detail, setDetail] = useState<PaymentSubmission | null>(null);
  const [noteMode, setNoteMode] = useState<NoteMode>(null);
  const [noteText, setNoteText] = useState('');
  const [viewerUrl, setViewerUrl] = useState('');

  const load = useCallback(async () => {
    const data = await fetchShopkeeperSubmissions({
      status: tab === 'pending' ? 'pending' : undefined,
      page: 1,
      limit: 50,
    });
    setRows(data.submissions || []);
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, [load])
  );

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      load().catch(() => {});
    };
    socket.on('payment-submission:count', refresh);
    socket.on('payment-submission:updated', refresh);
    return () => {
      socket.off('payment-submission:count', refresh);
      socket.off('payment-submission:updated', refresh);
    };
  }, [socket, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const openNote = (mode: Exclude<NoteMode, null>, submission: PaymentSubmission) => {
    setDetail(submission);
    setNoteMode(mode);
    setNoteText('');
  };

  const handleAccept = (submission: PaymentSubmission) => {
    appAlert(
      t('paySubmissions.acceptTitle'),
      t('paySubmissions.acceptBody', {
        amount: formatRs(submission.amount),
        name: submission.customerName || t('paySubmissions.customer'),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('paySubmissions.accept'),
          onPress: async () => {
            setActing(submission.id);
            try {
              await acceptPaymentSubmission(submission.id);
              setDetail(null);
              await load();
              appAlert(t('paySubmissions.acceptedTitle'), t('paySubmissions.acceptedBody'));
            } catch (err) {
              appAlert(t('common.error'), err instanceof Error ? err.message : t('paySubmissions.actionFailed'));
            } finally {
              setActing('');
            }
          },
        },
      ]
    );
  };

  const submitNote = async () => {
    if (!detail || !noteMode) return;
    const note = noteText.trim();
    if (!note) {
      appAlert(t('common.error'), t('paySubmissions.reasonRequired'));
      return;
    }

    setActing(detail.id);
    try {
      if (noteMode === 'reject') {
        await rejectPaymentSubmission(detail.id, note);
      } else {
        await reportPaymentSubmission(detail.id, note);
      }
      setNoteMode(null);
      setDetail(null);
      setNoteText('');
      await load();
    } catch (err) {
      appAlert(t('common.error'), err instanceof Error ? err.message : t('paySubmissions.actionFailed'));
    } finally {
      setActing('');
    }
  };

  const renderItem = ({ item }: { item: PaymentSubmission }) => {
    const tone = STATUS_TONE[item.status] || STATUS_TONE.pending;
    const shot = normalizeImageUrlSync(item.screenshotUrl);
    const busy = acting === item.id;

    return (
      <Pressable
        style={styles.card}
        onPress={() => setDetail({ ...item, screenshotUrl: shot || item.screenshotUrl })}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTopText}>
            <Text style={styles.customer}>{item.customerName || t('paySubmissions.customer')}</Text>
            <Text style={styles.meta}>
              {[item.payLabel || item.itemName || item.payType, item.method, item.date, item.time]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.badgeText, { color: tone.fg }]}>
              {t(`paySubmissions.status.${item.status}`, { defaultValue: item.status })}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardBodyMain}>
            <Text style={styles.amount}>{formatRs(item.amount)}</Text>
            {item.note ? (
              <Text style={styles.note} numberOfLines={2}>
                {t('paySubmissions.customerNote')}: {item.note}
              </Text>
            ) : null}
          </View>
          {shot ? (
            <Pressable onPress={() => setViewerUrl(shot)}>
              <Image source={{ uri: shot }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
            </Pressable>
          ) : null}
        </View>

        {item.status === 'pending' ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, styles.acceptBtn]}
              disabled={busy}
              onPress={() => handleAccept(item)}
            >
              <Text style={styles.actionBtnTextLight}>{t('paySubmissions.accept')}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.outlineBtn]}
              disabled={busy}
              onPress={() => openNote('reject', item)}
            >
              <Text style={styles.actionBtnTextDark}>{t('paySubmissions.reject')}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.reportBtn]}
              disabled={busy}
              onPress={() => openNote('report', item)}
            >
              <Text style={styles.actionBtnTextReport}>{t('paySubmissions.report')}</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <ScreenHeader
          title={t('paySubmissions.title')}
          subtitle={t('paySubmissions.subtitle')}
          onBack={() => navigation.goBack()}
          style={styles.headerInner}
          bottom={
            <View style={styles.tabs}>
              {(['pending', 'all'] as TabKey[]).map((key) => (
                <Pressable
                  key={key}
                  style={[styles.tab, tab === key && styles.tabActive]}
                  onPress={() => setTab(key)}
                >
                  <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                    {key === 'pending' ? t('paySubmissions.tabPending') : t('paySubmissions.tabAll')}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
        />
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'pending' ? t('paySubmissions.emptyPending') : t('paySubmissions.emptyAll')}
            </Text>
          }
          renderItem={renderItem}
        />
      )}

      <Modal visible={!!detail && !noteMode} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{detail?.customerName}</Text>
              <Text style={styles.modalAmount}>{formatRs(detail?.amount || 0)}</Text>
              <Text style={styles.modalMeta}>
                {[detail?.method, detail?.payLabel, detail?.date, detail?.time].filter(Boolean).join(' · ')}
              </Text>
              {detail?.note ? (
                <Text style={styles.modalNote}>
                  {t('paySubmissions.customerNote')}: {detail.note}
                </Text>
              ) : null}
              {detail?.reviewNote ? (
                <Text style={styles.modalNote}>
                  {t('paySubmissions.reviewNote')}: {detail.reviewNote}
                </Text>
              ) : null}
              {detail?.screenshotUrl ? (
                <Pressable onPress={() => setViewerUrl(normalizeImageUrlSync(detail.screenshotUrl))}>
                  <Image
                    source={{ uri: normalizeImageUrlSync(detail.screenshotUrl) }}
                    style={styles.detailImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                  <Text style={styles.viewShot}>{t('paySubmissions.viewScreenshot')}</Text>
                </Pressable>
              ) : null}
            </ScrollView>

            {detail?.status === 'pending' ? (
              <View style={styles.modalActions}>
                <Button
                  title={t('paySubmissions.accept')}
                  loading={acting === detail.id}
                  disabled={Boolean(acting)}
                  onPress={() => handleAccept(detail)}
                />
                <Button
                  title={t('paySubmissions.reject')}
                  variant="outline"
                  disabled={Boolean(acting)}
                  onPress={() => openNote('reject', detail)}
                />
                <Button
                  title={t('paySubmissions.report')}
                  variant="danger"
                  disabled={Boolean(acting)}
                  onPress={() => openNote('report', detail)}
                />
              </View>
            ) : (
              <Button title={t('common.close')} variant="outline" onPress={() => setDetail(null)} />
            )}
            {detail?.status === 'pending' ? (
              <Pressable style={styles.closeLink} onPress={() => setDetail(null)}>
                <Text style={styles.closeLinkText}>{t('common.close')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={!!noteMode} transparent animationType="fade" onRequestClose={() => setNoteMode(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.noteCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>
              {noteMode === 'reject' ? t('paySubmissions.rejectTitle') : t('paySubmissions.reportTitle')}
            </Text>
            <Text style={styles.modalMeta}>
              {noteMode === 'reject' ? t('paySubmissions.rejectHint') : t('paySubmissions.reportHint')}
            </Text>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={
                noteMode === 'reject'
                  ? t('paySubmissions.rejectPlaceholder')
                  : t('paySubmissions.reportPlaceholder')
              }
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
            />
            <View style={styles.noteActions}>
              <Button title={t('common.cancel')} variant="outline" onPress={() => setNoteMode(null)} />
              <Button
                title={noteMode === 'reject' ? t('paySubmissions.reject') : t('paySubmissions.report')}
                variant={noteMode === 'reject' ? 'outline' : 'danger'}
                loading={Boolean(acting)}
                onPress={submitNote}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl('')}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl('')}>
          <Image source={{ uri: viewerUrl }} style={styles.viewerImage} contentFit="contain" />
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerInner: { paddingBottom: 0 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: { fontWeight: '700', color: colors.textMuted, fontSize: 13 },
  tabTextActive: { color: '#FFFFFF' },
  list: { padding: spacing.md },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 48 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardTopText: { flex: 1, minWidth: 0 },
  customer: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, color: colors.textMuted, fontSize: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardBody: { flexDirection: 'row', gap: 12, marginTop: 12, alignItems: 'flex-start' },
  cardBodyMain: { flex: 1, minWidth: 0 },
  amount: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  note: { marginTop: 6, color: colors.textMuted, fontSize: 13 },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.border },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  acceptBtn: { backgroundColor: colors.primary },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: '#FFFFFF' },
  reportBtn: { borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionBtnTextLight: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  actionBtnTextDark: { color: colors.primaryDark, fontWeight: '700', fontSize: 12 },
  actionBtnTextReport: { color: '#B91C1C', fontWeight: '700', fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalAmount: { marginTop: 6, fontSize: 24, fontWeight: '800', color: colors.primaryDark },
  modalMeta: { marginTop: 6, color: colors.textMuted, fontSize: 13 },
  modalNote: { marginTop: 10, color: colors.text, fontSize: 13, lineHeight: 18 },
  detailImage: {
    marginTop: 14,
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  viewShot: { marginTop: 8, textAlign: 'center', color: colors.primary, fontWeight: '700' },
  modalActions: { gap: 8, marginTop: 16 },
  closeLink: { marginTop: 10, alignItems: 'center' },
  closeLinkText: { color: colors.textMuted, fontWeight: '600' },
  noteInput: {
    marginTop: 12,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 12,
    textAlignVertical: 'top',
    color: colors.text,
  },
  noteActions: { marginTop: 14, gap: 8 },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    padding: 16,
  },
  viewerImage: { width: '100%', height: '80%' },
});
