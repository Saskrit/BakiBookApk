import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  CompositeNavigationProp,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { connectQr, fetchMyQr, previewQr, type QrPreviewTarget } from '../../api/qr';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { customerColors as cc } from '../../theme/customerColors';
import { colors } from '../../theme/colors';
import type {
  CustomerTabParamList,
  RootStackParamList,
  ShopkeeperTabParamList,
} from '../../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<ShopkeeperTabParamList & CustomerTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type TabKey = 'scan' | 'myqr';

type PreviewState = {
  target: QrPreviewTarget;
  token: string;
  canConnect: boolean;
  alreadyLinked: boolean;
  message?: string;
  customerId?: string | null;
};

export default function QRScannerScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'QRScanner'>>();
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';
  const accent = isCustomer ? cc.peachDark : colors.primary;

  const [tab, setTab] = useState<TabKey>(route.params?.initialTab === 'myqr' ? 'myqr' : 'scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [myQr, setMyQr] = useState<{
    payload: string;
    qrCode: string;
    label: string;
    subtitle?: string;
  } | null>(null);
  const [myQrLoading, setMyQrLoading] = useState(false);
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  useEffect(() => {
    if (route.params?.initialTab === 'myqr' || route.params?.initialTab === 'scan') {
      setTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const loadMyQr = useCallback(async () => {
    setMyQrLoading(true);
    try {
      const res = await fetchMyQr();
      setMyQr(res.qr);
    } catch (err) {
      appAlert(
        t('common.error'),
        err instanceof Error ? err.message : t('qr.loadFailed')
      );
    } finally {
      setMyQrLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab === 'myqr') void loadMyQr();
  }, [tab, loadMyQr]);

  useEffect(() => {
    if (tab === 'scan' && !permission?.granted) {
      requestPermission();
    }
  }, [tab, permission, requestPermission]);

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || scanning) return;
    setScanned(true);
    setScanning(true);
    setError('');
    try {
      const res = await previewQr(data);
      if (res.target.kind === 'ledger-customer') {
        navigation.navigate('CustomerProfile', {
          customerId: res.target.customerId,
        });
        setScanned(false);
        return;
      }
      setPreview({
        target: res.target,
        token: res.token || data,
        canConnect: res.canConnect,
        alreadyLinked: res.alreadyLinked,
        message: res.message,
        customerId: res.customerId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('qr.notFound'));
      setScanned(false);
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async () => {
    if (!preview?.token) return;
    setConnecting(true);
    try {
      const res = await connectQr(preview.token);
      setPreview(null);
      appAlert(
        t('qr.connectedTitle'),
        res.message || t('qr.connectedBody'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              if (isCustomer && res.shop?.customerId) {
                navigation.navigate('ShopDetail', {
                  customerId: res.shop.customerId,
                  shopName: res.shop.shopName,
                });
              } else if (!isCustomer && res.customer?.id) {
                navigation.navigate('CustomerProfile', {
                  customerId: res.customer.id,
                });
              }
            },
          },
        ]
      );
    } catch (err) {
      appAlert(
        t('common.error'),
        err instanceof Error ? err.message : t('qr.connectFailed')
      );
    } finally {
      setConnecting(false);
      setScanned(false);
    }
  };

  const closePreview = () => {
    setPreview(null);
    setScanned(false);
  };

  const openAlreadyLinked = () => {
    if (!preview) return;
    const customerId = preview.customerId;
    setPreview(null);
    setScanned(false);
    if (isCustomer && customerId) {
      navigation.navigate('ShopDetail', { customerId });
    } else if (!isCustomer && customerId) {
      navigation.navigate('CustomerProfile', { customerId });
    }
  };

  const shareMyQr = async () => {
    if (!myQr) return;
    try {
      await Share.share({
        message: t('qr.shareMessage', {
          name: myQr.label,
          code: myQr.qrCode,
          payload: myQr.payload,
        }),
      });
    } catch {
      /* cancelled */
    }
  };

  const writeQrPng = () =>
    new Promise<string>((resolve, reject) => {
      if (!myQr || !qrRef.current) {
        reject(new Error(t('qr.saveFailed')));
        return;
      }
      qrRef.current.toDataURL(async (data) => {
        try {
          const path = `${FileSystem.cacheDirectory}bakibook-qr-${myQr.qrCode}.png`;
          await FileSystem.writeAsStringAsync(path, data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          resolve(path);
        } catch (err) {
          reject(err);
        }
      });
    });

  /** Save/download via system share sheet (no native media-library rebuild required). */
  const downloadMyQr = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        await shareMyQr();
        return;
      }
      const path = await writeQrPng();
      await Sharing.shareAsync(path, {
        mimeType: 'image/png',
        dialogTitle: t('qr.shareTitle'),
      });
      appAlert(t('qr.savedTitle'), t('qr.savedViaShare'));
    } catch (err) {
      appAlert(
        t('common.error'),
        err instanceof Error ? err.message : t('qr.saveFailed')
      );
    }
  };

  const shareQrImage = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        await shareMyQr();
        return;
      }
      const path = await writeQrPng();
      await Sharing.shareAsync(path, {
        mimeType: 'image/png',
        dialogTitle: t('qr.shareTitle'),
      });
    } catch {
      await shareMyQr();
    }
  };

  const previewTitle =
    preview?.target.kind === 'shopkeeper'
      ? preview.target.shopName
      : preview?.target.kind === 'customer'
        ? preview.target.name
        : preview?.target.kind === 'ledger-customer'
          ? preview.target.name
          : '';

  const previewMeta =
    preview?.target.kind === 'shopkeeper'
      ? [preview.target.location, preview.target.phone].filter(Boolean).join(' · ')
      : preview?.target.kind === 'customer'
        ? [preview.target.email, preview.target.phone].filter(Boolean).join(' · ')
        : '';

  return (
    <View style={[qrStyles.qrScreen, { paddingTop: insets.top, backgroundColor: isCustomer ? '#F7F8FC' : colors.background }]}>
      <View style={qrStyles.qrHeader}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
          hitSlop={8}
          style={qrStyles.qrBackBtn}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 6 L9 12 L15 18"
              stroke="#1E293B"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <Text style={qrStyles.qrHeaderTitle}>{t('qr.screenTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={qrStyles.qrTabRow}>
        <Pressable
          style={[qrStyles.qrTab, tab === 'scan' && { borderBottomColor: accent }]}
          onPress={() => setTab('scan')}
        >
          <Text style={[qrStyles.qrTabText, tab === 'scan' && { color: accent }]}>
            {t('qr.scanTab')}
          </Text>
        </Pressable>
        <Pressable
          style={[qrStyles.qrTab, tab === 'myqr' && { borderBottomColor: accent }]}
          onPress={() => setTab('myqr')}
        >
          <Text style={[qrStyles.qrTabText, tab === 'myqr' && { color: accent }]}>
            {t('qr.myQrTab')}
          </Text>
        </Pressable>
      </View>

      {tab === 'scan' ? (
        <View style={qrStyles.qrScanPane}>
          {!permission ? (
            <View style={qrStyles.qrCenter}>
              <Text>{t('qr.requestingPermission')}</Text>
            </View>
          ) : !permission.granted ? (
            <View style={qrStyles.qrCenterCard}>
              <Text style={qrStyles.qrHelp}>{t('qr.cameraRequired')}</Text>
              <Pressable
                style={[qrStyles.qrPrimaryBtn, { backgroundColor: accent }]}
                onPress={requestPermission}
              >
                <Text style={qrStyles.qrPrimaryBtnText}>{t('qr.allowCamera')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView
                style={qrStyles.qrCamera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanned || preview ? undefined : handleScan}
              />
              <View style={qrStyles.qrScanFrame} />
              <View style={[qrStyles.qrOverlay, { paddingBottom: insets.bottom + 16 }]}>
                <Text style={qrStyles.qrInstruction}>
                  {isCustomer ? t('qr.scanShopHint') : t('qr.scanCustomerHint')}
                </Text>
                {scanning ? <ActivityIndicator color={accent} style={{ marginTop: 8 }} /> : null}
                {error ? <Text style={qrStyles.qrError}>{error}</Text> : null}
                {scanned && !preview ? (
                  <Pressable
                    style={[qrStyles.qrOutlineBtn, { borderColor: accent }]}
                    onPress={() => {
                      setScanned(false);
                      setError('');
                    }}
                  >
                    <Text style={[qrStyles.qrOutlineBtnText, { color: accent }]}>
                      {t('qr.scanAgain')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={[qrStyles.qrMyQrPane, { paddingBottom: insets.bottom + 24 }]}>
          {myQrLoading || !myQr ? (
            <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
          ) : (
            <>
              <Text style={qrStyles.qrMyQrTitle}>{myQr.label}</Text>
              <Text style={qrStyles.qrMyQrSub}>{myQr.subtitle}</Text>
              <View style={qrStyles.qrQrCard}>
                <QRCode
                  value={myQr.payload}
                  size={220}
                  color="#1E293B"
                  backgroundColor="#FFFFFF"
                  getRef={(ref) => {
                    qrRef.current = ref;
                  }}
                />
              </View>
              <Text style={qrStyles.qrCodeLabel}>{myQr.qrCode}</Text>
              <Text style={qrStyles.qrMyQrHint}>
                {isCustomer ? t('qr.myQrCustomerHint') : t('qr.myQrShopHint')}
              </Text>
              <View style={qrStyles.qrMyQrActions}>
                <Pressable
                  style={[qrStyles.qrActionBtn, { backgroundColor: isCustomer ? '#DBEAFE' : '#E8F0D8' }]}
                  onPress={downloadMyQr}
                >
                  <Text style={[qrStyles.qrActionBtnText, { color: isCustomer ? '#1D4ED8' : colors.primaryDark }]}>
                    {t('qr.download')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[qrStyles.qrActionBtn, { backgroundColor: isCustomer ? '#FFEDD5' : colors.primary }]}
                  onPress={shareQrImage}
                >
                  <Text
                    style={[
                      qrStyles.qrActionBtnText,
                      { color: isCustomer ? '#C2410C' : '#FFF' },
                    ]}
                  >
                    {t('qr.share')}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={closePreview}>
        <View style={qrStyles.qrModalBackdrop}>
          <View style={qrStyles.qrModalCard}>
            <Text style={qrStyles.qrModalEyebrow}>
              {preview?.target.kind === 'shopkeeper'
                ? t('qr.shopFound')
                : t('qr.customerFound')}
            </Text>
            <Text style={qrStyles.qrModalTitle}>{previewTitle}</Text>
            {previewMeta ? <Text style={qrStyles.qrModalMeta}>{previewMeta}</Text> : null}
            <Text style={qrStyles.qrModalMsg}>
              {preview?.alreadyLinked
                ? t('qr.alreadyLinked')
                : preview?.message || t('qr.confirmConnect')}
            </Text>
            <View style={qrStyles.qrModalActions}>
              <Pressable style={qrStyles.qrModalCancel} onPress={closePreview}>
                <Text style={qrStyles.qrModalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              {preview?.alreadyLinked ? (
                <Pressable
                  style={[qrStyles.qrModalConfirm, { backgroundColor: accent }]}
                  onPress={openAlreadyLinked}
                >
                  <Text style={qrStyles.qrModalConfirmText}>{t('qr.viewAccount')}</Text>
                </Pressable>
              ) : preview?.canConnect ? (
                <Pressable
                  style={[qrStyles.qrModalConfirm, { backgroundColor: accent }]}
                  onPress={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={qrStyles.qrModalConfirmText}>{t('qr.connect')}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const qrStyles = StyleSheet.create({
  qrScreen: { flex: 1 },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qrBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  qrTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  qrTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  qrTabText: { fontSize: 14, fontWeight: '800', color: '#94A3B8' },
  qrScanPane: { flex: 1 },
  qrCamera: { flex: 1 },
  qrScanFrame: {
    position: 'absolute',
    top: '22%',
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  qrOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  qrInstruction: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  qrError: { color: '#C45C5C', textAlign: 'center', marginTop: 8, fontWeight: '600' },
  qrCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qrCenterCard: {
    margin: 24,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrHelp: { marginBottom: 14, color: '#334155', textAlign: 'center', fontWeight: '600' },
  qrPrimaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  qrPrimaryBtnText: { color: '#FFF', fontWeight: '800' },
  qrOutlineBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  qrOutlineBtnText: { fontWeight: '800' },
  qrMyQrPane: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  qrMyQrTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  qrMyQrSub: { marginTop: 4, fontSize: 13, color: '#64748B', fontWeight: '600' },
  qrQrCard: {
    marginTop: 20,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  qrCodeLabel: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  qrMyQrHint: {
    marginTop: 10,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  qrMyQrActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  qrActionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  qrActionBtnText: { fontWeight: '800', fontSize: 14 },
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  qrModalCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
  },
  qrModalEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  qrModalTitle: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  qrModalMeta: { marginTop: 4, fontSize: 13, color: '#64748B', fontWeight: '600' },
  qrModalMsg: {
    marginTop: 14,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    fontWeight: '600',
  },
  qrModalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  qrModalCancel: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  qrModalCancelText: { fontWeight: '800', color: '#64748B' },
  qrModalConfirm: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  qrModalConfirmText: { fontWeight: '800', color: '#FFF' },
});
