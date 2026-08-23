import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { appAlert } from '../../contexts/DialogContext';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
} from '../../api/products';
import { Button, ErrorText, LoadingState } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

import { formatRelativeTime, formatRs } from '../../utils/format';
import type { ShopProduct } from '../../types';
import type { RootStackParamList } from '../../navigation/types';

export default function ProductsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const res = await fetchProducts({
      all: true,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    setProducts(Array.isArray(res.products) ? res.products : []);
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : t('products.loadFailed')))
      .finally(() => setLoading(false));
  }, [load, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.failedToRefresh'));
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    const totalUsage = list.reduce((sum, p) => sum + (p.usageCount || 0), 0);
    const top = [...list].sort((a, b) => b.usageCount - a.usageCount)[0];
    return { count: list.length, totalUsage, topName: top?.name };
  }, [products]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setPrice('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (product: ShopProduct) => {
    setEditing(product);
    setName(product.name);
    setPrice(String(product.lastPrice ?? ''));
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(t('products.nameRequired'));
      return;
    }

    const payload: { name: string; lastPrice?: number } = { name: trimmedName };
    const trimmedPrice = price.trim();
    if (trimmedPrice) {
      const parsedPrice = Number(trimmedPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        setFormError(t('products.invalidPrice'));
        return;
      }
      payload.lastPrice = parsedPrice;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
      } else {
        try {
          await createProduct(payload);
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.toLowerCase().includes('already exists')) {
            setModalOpen(false);
            await load();
            return;
          }
          throw err;
        }
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('products.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (product: ShopProduct) => {
    appAlert(t('products.deleteTitle'), t('products.deleteConfirm', { name: product.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(product.id);
            await load();
          } catch (err) {
            appAlert(
              t('common.error'),
              err instanceof Error ? err.message : t('common.failedToDelete')
            );
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingState />;

  return (
    <View style={prStyles.prScreen}>
      <View style={[prStyles.prHeader, { paddingTop: insets.top + 12 }]}>
        <View style={prStyles.prHeaderTop}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={prStyles.prBack}>{t('common.back')}</Text>
          </Pressable>
          <Pressable style={prStyles.prAddBtn} onPress={openAdd}>
            <Text style={prStyles.prAddBtnText}>{t('products.add')}</Text>
          </Pressable>
        </View>
        <Text style={prStyles.prHeaderTitle}>{t('products.title')}</Text>
        <Text style={prStyles.prHeaderSubtitle}>{t('products.subtitle')}</Text>

        <View style={prStyles.prStatsRow}>
          <View style={prStyles.prStatPill}>
            <Text style={prStyles.prStatValue}>{stats.count}</Text>
            <Text style={prStyles.prStatLabel}>{t('products.productsLabel')}</Text>
          </View>
          <View style={prStyles.prStatPill}>
            <Text style={prStyles.prStatValue}>{stats.totalUsage}</Text>
            <Text style={prStyles.prStatLabel}>{t('products.timesUsed')}</Text>
          </View>
        </View>
      </View>

      <View style={prStyles.prSearchBox}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke={colors.textMuted} strokeWidth={2} />
          <Path d="M20 20 L16.5 16.5" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('products.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={prStyles.prSearchInput}
        />
      </View>

      {error ? <Text style={prStyles.prError}>{error}</Text> : null}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 16 }}
        ListEmptyComponent={<Text style={prStyles.prEmpty}>{t('products.empty')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={prStyles.prRow}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View style={prStyles.prRowIcon}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Rect x={4} y={6} width={16} height={14} rx={2} stroke="#EA580C" strokeWidth={2} />
              </Svg>
            </View>
            <View style={prStyles.prRowBody}>
              <Text style={prStyles.prRowName}>{item.name}</Text>
              <Text style={prStyles.prRowMeta}>
                {t('common.timesUsed', { count: item.usageCount ?? 0 })}
                {item.lastUsedAt ? ` · ${formatRelativeTime(item.lastUsedAt)}` : ''}
              </Text>
            </View>
            <View style={prStyles.prRowPriceCol}>
              <Text style={prStyles.prRowPrice}>
                {item.lastPrice ? formatRs(item.lastPrice) : '—'}
              </Text>
              <Text style={prStyles.prRowHint}>
                {item.lastPrice ? t('common.lastPrice') : t('common.nameOnly')}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={prStyles.prModalBackdrop}>
          <View style={[prStyles.prModalCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={prStyles.prModalTitle}>
              {editing ? t('products.editProduct') : t('products.addProduct')}
            </Text>
            {formError ? <ErrorText message={formError} /> : null}
            <Text style={prStyles.prFieldLabel}>{t('products.productName')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('products.namePlaceholder')}
              style={prStyles.prFieldInput}
              autoFocus
            />
            <Text style={prStyles.prFieldLabel}>{t('products.defaultPrice')}</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder={t('products.pricePlaceholder')}
              keyboardType="numeric"
              style={prStyles.prFieldInput}
            />
            <View style={prStyles.prModalActions}>
              <Button title={t('common.cancel')} variant="outline" onPress={() => setModalOpen(false)} />
              <Button
                title={editing ? t('common.save') : t('products.addProduct')}
                onPress={handleSave}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const prStyles = StyleSheet.create({
  prScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  prHeader: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  prHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  prBack: { color: 'rgba(255,255,255,0.95)', fontSize: ty.bodyLg, fontWeight: '600' },
  prAddBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  prAddBtnText: { color: '#FFF', fontWeight: '700', fontSize: ty.body },
  prHeaderTitle: { color: '#FFF', fontSize: ty.h1, fontWeight: '800' },
  prHeaderSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: ty.body, marginTop: 4 },
  prStatsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  prStatPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  prStatValue: { color: '#FFF', fontSize: ty.lg, fontWeight: '800' },
  prStatLabel: { color: 'rgba(255,255,255,0.85)', fontSize: ty.caption, marginTop: 2 },
  prSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  prSearchInput: { flex: 1, fontSize: ty.bodyLg, color: colors.text, padding: 0 },
  prError: { color: colors.danger, marginHorizontal: 16, marginTop: 8, fontSize: ty.body },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    gap: spacing.sm,
  },
  prRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prRowBody: { flex: 1 },
  prRowName: { fontSize: ty.md, fontWeight: '700', color: colors.text },
  prRowMeta: { fontSize: ty.caption, color: colors.textMuted, marginTop: 4 },
  prRowPriceCol: { alignItems: 'flex-end' },
  prRowPrice: { fontSize: ty.bodyLg, fontWeight: '800', color: colors.primary },
  prRowHint: { fontSize: ty.sm, color: colors.textMuted, marginTop: 2 },
  prEmpty: { textAlign: 'center', color: colors.textMuted, marginTop: 40, lineHeight: 20, fontSize: ty.body },
  prModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  prModalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  prModalTitle: { fontSize: ty.lg, fontWeight: '800', color: colors.text, marginBottom: 12 },
  prFieldLabel: { fontSize: ty.body, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 8 },
  prFieldInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: ty.md,
    color: colors.text,
  },
  prModalActions: { gap: 8, marginTop: 16 },
});
