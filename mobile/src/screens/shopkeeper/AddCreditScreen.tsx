import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { appAlert } from '../../contexts/DialogContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { createCustomer, fetchCustomers } from '../../api/customers';
import { createTransaction } from '../../api/transactions';
import ProductSearchInput from '../../components/ProductSearchInput';
import { Button, ErrorText, Input } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { avatarColor, formatRs, getInitials } from '../../utils/format';
import type { Customer, LineItem } from '../../types';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddCredit'>;
type CustomerMode = 'existing' | 'new';

type CreditLine = LineItem & { id: string };

const newLineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function lineTotal(item: Pick<LineItem, 'qty' | 'price'>) {
  return (Number(item.qty) || 0) * (Number(item.price) || 0);
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={adStyles.adCard}>
      <Text style={adStyles.adCardTitle}>{title}</Text>
      {subtitle ? <Text style={adStyles.adCardSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function ProductFormFields({
  draftName,
  setDraftName,
  draftQty,
  setDraftQty,
  draftPrice,
  setDraftPrice,
  draftTotal,
}: {
  draftName: string;
  setDraftName: (v: string) => void;
  draftQty: string;
  setDraftQty: (v: string) => void;
  draftPrice: string;
  setDraftPrice: (v: string) => void;
  draftTotal: number;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ProductSearchInput
        label={t('credit.productName')}
        value={draftName}
        onChangeText={setDraftName}
        onSelectProduct={(product) => setDraftName(product.name)}
      />
      <View style={adStyles.adQtyPriceRow}>
        <View style={adStyles.adQtyCol}>
          <Text style={adStyles.adFieldLabel}>{t('credit.qty')}</Text>
          <TextInput
            value={draftQty}
            onChangeText={setDraftQty}
            keyboardType="numeric"
            style={adStyles.adFieldInput}
            placeholder="1"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={adStyles.adPriceCol}>
          <Text style={adStyles.adFieldLabel}>{t('credit.priceRs')}</Text>
          <TextInput
            value={draftPrice}
            onChangeText={setDraftPrice}
            keyboardType="numeric"
            style={adStyles.adFieldInput}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
      {draftName.trim() && draftPrice.trim() ? (
        <Text style={adStyles.adDraftLineTotal}>
          {t('credit.lineTotal', { amount: formatRs(draftTotal) })}
        </Text>
      ) : null}
    </>
  );
}

function LineItemRow({
  item,
  onRemove,
  onEdit,
}: {
  item: CreditLine;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const total = lineTotal(item);
  return (
    <Pressable onPress={onEdit} style={adStyles.adLineRow}>
      <View style={adStyles.adLineIcon}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Rect x={4} y={6} width={16} height={14} rx={2} stroke="#EA580C" strokeWidth={2} />
        </Svg>
      </View>
      <View style={adStyles.adLineBody}>
        <Text style={adStyles.adLineName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={adStyles.adLineMeta}>
          {t('credit.qtyMeta', { qty: item.qty, price: formatRs(item.price) })}
        </Text>
      </View>
      <View style={adStyles.adLineRight}>
        <Text style={adStyles.adLineAmount}>{formatRs(total)}</Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onRemove();
          }}
          hitSlop={8}
          style={adStyles.adRemoveBtn}
        >
          <Text style={adStyles.adRemoveBtnText}>{t('credit.remove')}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function AddCreditScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const presetCustomerId = route.params?.customerId;
  const presetCustomerName = route.params?.customerName;
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<CustomerMode>('existing');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(!presetCustomerId);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    presetCustomerId
      ? { id: presetCustomerId, name: presetCustomerName || t('common.customer'), balance: 0 }
      : null
  );

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [lines, setLines] = useState<CreditLine[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const [draftPrice, setDraftPrice] = useState('');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lockedCustomer = Boolean(presetCustomerId);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const data = await fetchCustomers({ page: 1, limit: 100 });
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      if (presetCustomerId) {
        const match = data.customers?.find((c) => c.id === presetCustomerId);
        if (match) setSelectedCustomer(match);
      }
    } catch {
      setError(t('credit.loadFailed'));
    } finally {
      setCustomersLoading(false);
    }
  }, [presetCustomerId, t]);

  useEffect(() => {
    if (!lockedCustomer) loadCustomers();
  }, [loadCustomers, lockedCustomer]);

  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customers) ? customers : [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const draftTotal = lineTotal({ qty: Number(draftQty) || 0, price: Number(draftPrice) || 0 });
  const linesTotal = useMemo(
    () => lines.reduce((sum, line) => sum + lineTotal(line), 0),
    [lines]
  );
  const grandTotal = useMemo(() => {
    if (lines.length === 0) {
      return draftTotal;
    }
    return linesTotal;
  }, [lines.length, draftTotal, linesTotal]);

  const openProductModal = (mode: 'add' | 'edit', line?: CreditLine) => {
    setError('');
    if (mode === 'edit' && line) {
      setDraftName(line.name);
      setDraftQty(String(line.qty));
      setDraftPrice(String(line.price));
      setEditingLineId(line.id);
    } else {
      clearDraft();
    }
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setProductModalOpen(false);
    clearDraft();
  };

  const resolveCustomerId = async (): Promise<string> => {
    if (mode === 'existing') {
      if (!selectedCustomer?.id) {
        throw new Error(t('credit.selectCustomerError'));
      }
      return selectedCustomer.id;
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      throw new Error(t('credit.nameRequiredNew'));
    }

    const list = Array.isArray(customers) ? customers : [];
    const existingByName = list.find(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingByName) return existingByName.id;

    if (newPhone.trim()) {
      const existingByPhone = list.find(
        (c) => c.phone?.trim() && c.phone.trim() === newPhone.trim()
      );
      if (existingByPhone) return existingByPhone.id;
    }

    const created = await createCustomer({
      name: trimmedName,
      phone: newPhone.trim() || undefined,
    });
    return created.customer.id;
  };

  const parseDraft = (silent = false): LineItem | null => {
    if (!draftName.trim()) {
      if (!silent) setError(t('credit.enterProductName'));
      return null;
    }
    if (!draftPrice.trim() || Number(draftPrice) <= 0) {
      if (!silent) setError(t('credit.enterValidPrice'));
      return null;
    }
    const qty = Number(draftQty) || 1;
    if (qty <= 0) {
      if (!silent) setError(t('credit.qtyMinOne'));
      return null;
    }
    return {
      name: draftName.trim(),
      qty,
      price: Number(draftPrice),
    };
  };

  const validateDraft = () => parseDraft(false);

  const clearDraft = () => {
    setDraftName('');
    setDraftQty('1');
    setDraftPrice('');
    setEditingLineId(null);
  };

  const handleAddFirstToList = () => {
    setError('');
    const item = validateDraft();
    if (!item) return;
    setLines([{ id: newLineId(), ...item }]);
    clearDraft();
  };

  const handleAddLine = () => {
    setError('');
    const item = validateDraft();
    if (!item) return;

    if (editingLineId) {
      setLines((prev) =>
        prev.map((line) => (line.id === editingLineId ? { ...line, ...item } : line))
      );
    } else {
      setLines((prev) => [...prev, { id: newLineId(), ...item }]);
    }
    closeProductModal();
  };

  const handleEditLine = (line: CreditLine) => {
    openProductModal('edit', line);
  };

  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
    if (editingLineId === id) clearDraft();
  };

  const buildItemsForSave = (): LineItem[] => {
    if (lines.length === 0) {
      const draft = parseDraft(true);
      return draft ? [draft] : [];
    }
    return lines.map(({ name, qty, price }) => ({ name, qty, price }));
  };

  const handleSave = async () => {
    setError('');
    const items = buildItemsForSave();
    if (!items.length) {
      setError(t('credit.addOneProduct'));
      return;
    }

    const total = items.reduce((sum, item) => sum + lineTotal(item), 0);
    if (total <= 0) {
      setError(t('credit.totalMustBePositive'));
      return;
    }

    setLoading(true);
    try {
      const customerId = await resolveCustomerId();
      await createTransaction({
        customerId,
        items,
        note: note.trim() || undefined,
      });
      appAlert(t('common.saved'), t('credit.savedSuccess', { amount: formatRs(total) }));
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('credit.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const customerLabel =
    lockedCustomer || mode === 'existing'
      ? selectedCustomer?.name || presetCustomerName || t('credit.selectCustomer')
      : newName.trim() || t('credit.newCustomer');

  return (
    <View style={adStyles.adScreen}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[adStyles.adHeader, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={adStyles.adBackBtn}>
          <Text style={adStyles.adBackText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={adStyles.adHeaderTitle}>{t('credit.title')}</Text>
        <Text style={adStyles.adHeaderSubtitle}>{t('credit.subtitle')}</Text>
        <View style={adStyles.adHeaderCustomer}>
          <View style={[adStyles.adHeaderAvatar, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={adStyles.adHeaderAvatarText}>{getInitials(customerLabel)}</Text>
          </View>
          <View style={adStyles.adHeaderCustomerBody}>
            <Text style={adStyles.adHeaderCustomerLabel}>{t('credit.customerLabel')}</Text>
            <Text style={adStyles.adHeaderCustomerName} numberOfLines={1}>
              {customerLabel}
            </Text>
          </View>
          {lines.length > 0 ? (
            <View style={adStyles.adHeaderBadge}>
              <Text style={adStyles.adHeaderBadgeText}>
                {t('common.items', { count: lines.length })}
              </Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={adStyles.adFlex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[adStyles.adContent, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {error ? <ErrorText message={error} /> : null}

          {!lockedCustomer ? (
            <SectionCard title={t('credit.customerSection')} subtitle={t('credit.customerSectionSub')}>
              <View style={adStyles.adModeRow}>
                <Pressable
                  onPress={() => setMode('existing')}
                  style={[adStyles.adModeChip, mode === 'existing' && adStyles.adModeChipActive]}
                >
                  <Text style={[adStyles.adModeChipText, mode === 'existing' && adStyles.adModeChipTextActive]}>
                    {t('credit.existing')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('new')}
                  style={[adStyles.adModeChip, mode === 'new' && adStyles.adModeChipActive]}
                >
                  <Text style={[adStyles.adModeChipText, mode === 'new' && adStyles.adModeChipTextActive]}>
                    {t('credit.newCustomerMode')}
                  </Text>
                </Pressable>
              </View>

              {mode === 'existing' ? (
                <>
                  <View style={adStyles.adSearchBox}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Circle cx={11} cy={11} r={7} stroke={colors.textMuted} strokeWidth={2} />
                      <Path
                        d="M20 20 L16.5 16.5"
                        stroke={colors.textMuted}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </Svg>
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder={t('credit.searchPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      style={adStyles.adSearchInput}
                    />
                  </View>
                  {customersLoading ? (
                    <Text style={adStyles.adHint}>{t('credit.loadingCustomers')}</Text>
                  ) : filteredCustomers.length === 0 ? (
                    <Text style={adStyles.adHint}>{t('credit.noCustomersHint')}</Text>
                  ) : (
                    <View style={adStyles.adCustomerList}>
                      {filteredCustomers.slice(0, 8).map((item) => {
                        const selected = selectedCustomer?.id === item.id;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => setSelectedCustomer(item)}
                            style={[adStyles.adCustomerRow, selected && adStyles.adCustomerRowSelected]}
                          >
                            <View
                              style={[adStyles.adAvatar, { backgroundColor: avatarColor(item.name) }]}
                            >
                              <Text style={adStyles.adAvatarText}>{getInitials(item.name)}</Text>
                            </View>
                            <View style={adStyles.adCustomerInfo}>
                              <Text style={adStyles.adCustomerName}>{item.name}</Text>
                              {item.phone ? (
                                <Text style={adStyles.adCustomerMeta}>{item.phone}</Text>
                              ) : null}
                            </View>
                            {selected ? <Text style={adStyles.adCheckMark}>✓</Text> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={adStyles.adHint}>{t('credit.autoCreateHint')}</Text>
                  <Input label={t('credit.customerName')} value={newName} onChangeText={setNewName} />
                  <Input
                    label={t('credit.phoneOptional')}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    keyboardType="phone-pad"
                  />
                </>
              )}
            </SectionCard>
          ) : null}

          {lines.length > 0 ? (
            <SectionCard
              title={t('credit.products')}
              subtitle={t('credit.productsInCredit', { count: lines.length })}
            >
              {lines.map((line) => (
                <LineItemRow
                  key={line.id}
                  item={line}
                  onRemove={() => handleRemoveLine(line.id)}
                  onEdit={() => handleEditLine(line)}
                />
              ))}
              <View style={adStyles.adSubtotalRow}>
                <Text style={adStyles.adSubtotalLabel}>{t('credit.subtotal')}</Text>
                <Text style={adStyles.adSubtotalValue}>{formatRs(linesTotal)}</Text>
              </View>
              <Pressable
                onPress={() => openProductModal('add')}
                style={adStyles.adPlusOnlyBtn}
                accessibilityLabel={t('credit.addAnotherProduct')}
              >
                <Text style={adStyles.adPlusOnlyText}>+</Text>
              </Pressable>
            </SectionCard>
          ) : (
            <SectionCard title={t('credit.product')} subtitle={t('credit.productSub')}>
              <ProductFormFields
                draftName={draftName}
                setDraftName={setDraftName}
                draftQty={draftQty}
                setDraftQty={setDraftQty}
                draftPrice={draftPrice}
                setDraftPrice={setDraftPrice}
                draftTotal={draftTotal}
              />
              {draftName.trim() && draftPrice.trim() && Number(draftPrice) > 0 ? (
                <Pressable
                  onPress={handleAddFirstToList}
                  style={adStyles.adPlusOnlyBtn}
                  accessibilityLabel={t('credit.addProductMore')}
                >
                  <Text style={adStyles.adPlusOnlyText}>+</Text>
                </Pressable>
              ) : null}
            </SectionCard>
          )}

          <SectionCard title={t('credit.notes')} subtitle={t('credit.notesSub')}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('credit.notesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[adStyles.adFieldInput, adStyles.adNoteInput]}
              multiline
            />
          </SectionCard>
        </ScrollView>

        <Modal
          visible={productModalOpen}
          animationType="slide"
          transparent
          onRequestClose={closeProductModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={adStyles.adModalBackdrop}
          >
            <View style={[adStyles.adModalSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={adStyles.adModalHeader}>
                <Text style={adStyles.adModalTitle}>
                  {editingLineId ? t('credit.editProduct') : t('credit.addProduct')}
                </Text>
                <Pressable onPress={closeProductModal} hitSlop={8}>
                  <Text style={adStyles.adModalClose}>✕</Text>
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <ProductFormFields
                  draftName={draftName}
                  setDraftName={setDraftName}
                  draftQty={draftQty}
                  setDraftQty={setDraftQty}
                  draftPrice={draftPrice}
                  setDraftPrice={setDraftPrice}
                  draftTotal={draftTotal}
                />
                <Pressable onPress={handleAddLine} style={adStyles.adAddLineBtn}>
                  <Text style={adStyles.adAddLineBtnText}>
                    {editingLineId ? t('credit.updateProduct') : t('credit.addProduct')}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <View style={[adStyles.adFooter, { paddingBottom: insets.bottom + 12 }]}>
          <View style={adStyles.adFooterTotal}>
            <Text style={adStyles.adFooterTotalLabel}>{t('credit.creditTotal')}</Text>
            <Text style={adStyles.adFooterTotalValue}>{formatRs(grandTotal)}</Text>
            <Text style={adStyles.adFooterHint}>
              {lines.length === 0
                ? t('credit.fillThenSave')
                : t('common.productsCount', { count: lines.length })}
            </Text>
          </View>
          <Button
            title={loading ? t('common.saving') : t('credit.saveCredit')}
            onPress={handleSave}
            loading={loading}
            disabled={grandTotal <= 0}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const adStyles = StyleSheet.create({
  adScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  adFlex: { flex: 1 },
  adHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  adBackBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  adBackText: { color: 'rgba(255,255,255,0.95)', fontSize: ty.bodyLg, fontWeight: '600' },
  adHeaderTitle: { color: '#FFF', fontSize: ty.h1, fontWeight: '800' },
  adHeaderSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: ty.body, marginTop: 4 },
  adHeaderCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 12,
  },
  adHeaderAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adHeaderAvatarText: { color: '#FFF', fontWeight: '800', fontSize: ty.caption },
  adHeaderCustomerBody: { flex: 1 },
  adHeaderCustomerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: ty.sm },
  adHeaderCustomerName: { color: '#FFF', fontSize: ty.md, fontWeight: '700', marginTop: 2 },
  adHeaderBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adHeaderBadgeText: { color: '#FFF', fontSize: ty.sm, fontWeight: '700' },
  adContent: { padding: 16, paddingTop: 14 },
  adCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  adCardTitle: { fontSize: ty.md, fontWeight: '800', color: colors.text },
  adCardSubtitle: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2, marginBottom: 12 },
  adModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
  },
  adModeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  adModeChipActive: { backgroundColor: '#FFF' },
  adModeChipText: { fontSize: ty.caption, fontWeight: '700', color: colors.textMuted },
  adModeChipTextActive: { color: colors.primaryDark },
  adSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  adSearchInput: { flex: 1, fontSize: ty.md, color: colors.text, padding: 0 },
  adCustomerList: { maxHeight: 240 },
  adCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  adCustomerRowSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F3F7EC',
  },
  adAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  adAvatarText: { color: '#FFF', fontWeight: '700', fontSize: ty.caption },
  adCustomerInfo: { flex: 1 },
  adCustomerName: { fontSize: ty.bodyLg, fontWeight: '600', color: colors.text },
  adCustomerMeta: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2 },
  adCheckMark: { color: colors.primary, fontWeight: '800', fontSize: ty.lg },
  adHint: { fontSize: ty.body, color: colors.textMuted, marginBottom: 10, lineHeight: 18 },
  adLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  adLineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adLineBody: { flex: 1 },
  adLineName: { fontSize: ty.bodyLg, fontWeight: '700', color: colors.text },
  adLineMeta: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2 },
  adLineRight: { alignItems: 'flex-end' },
  adLineAmount: { fontSize: ty.bodyLg, fontWeight: '800', color: colors.danger },
  adRemoveBtn: { marginTop: 4 },
  adRemoveBtnText: { fontSize: ty.sm, color: colors.danger, fontWeight: '600' },
  adSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
  },
  adSubtotalLabel: { fontSize: ty.body, fontWeight: '600', color: colors.textMuted },
  adSubtotalValue: { fontSize: ty.lg, fontWeight: '800', color: colors.text },
  adFieldLabel: { fontSize: ty.body, fontWeight: '600', color: colors.text, marginBottom: 6 },
  adQtyPriceRow: { flexDirection: 'row', gap: 10 },
  adQtyCol: { width: 88 },
  adPriceCol: { flex: 1 },
  adFieldInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: ty.md,
    color: colors.text,
  },
  adNoteInput: { minHeight: 72, textAlignVertical: 'top' },
  adDraftLineTotal: {
    fontSize: ty.body,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: 10,
  },
  adPlusOnlyBtn: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  adPlusOnlyText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
    marginTop: -2,
  },
  adAddLineBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  adAddLineBtnText: { color: '#FFF', fontWeight: '700', fontSize: ty.bodyLg },
  adModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  adModalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '85%',
  },
  adModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  adModalTitle: { fontSize: ty.lg, fontWeight: '800', color: colors.text },
  adModalClose: { fontSize: 20, color: colors.textMuted, padding: 4 },
  adFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  adFooterTotal: { marginBottom: 10 },
  adFooterTotalLabel: { fontSize: ty.caption, color: colors.textMuted, fontWeight: '600' },
  adFooterTotalValue: { fontSize: ty.xxl, fontWeight: '800', color: colors.danger, marginTop: 2 },
  adFooterHint: { fontSize: ty.sm, color: colors.textMuted, marginTop: 2 },
});
