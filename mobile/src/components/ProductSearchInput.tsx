import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { createProduct, fetchProducts } from '../api/products';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

import { formatRs } from '../utils/format';
import type { ShopProduct } from '../types';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onSelectProduct: (product: ShopProduct) => void;
  /** When false, search uses the typed name locally (no server catalog add). Default true for backwards compat. */
  enableCatalogAdd?: boolean;
};

function SearchIcon({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M20 20 L16.5 16.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function ProductSearchInput({
  label,
  value,
  onChangeText,
  onSelectProduct,
  enableCatalogAdd = false,
}: Props) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [searched, setSearched] = useState(false);

  const loadProducts = useCallback(async (search: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const data = await fetchProducts({
        search: search.trim() || undefined,
        limit: 20,
      });
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const timer = setTimeout(() => loadProducts(query), 300);
    return () => clearTimeout(timer);
  }, [query, modalOpen, loadProducts]);

  const openSearch = () => {
    setQuery(value);
    setSearched(false);
    setProducts([]);
    setAddError('');
    setModalOpen(true);
  };

  const handleUseTypedName = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onChangeText(trimmed);
    setModalOpen(false);
  };

  const handleAddNew = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (!enableCatalogAdd) {
      handleUseTypedName();
      return;
    }

    setAdding(true);
    setAddError('');
    try {
      const res = await createProduct({ name: trimmed });
      handleSelect(res.product);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('products.addProductFailed');
      if (msg.toLowerCase().includes('already exists')) {
        onChangeText(trimmed);
        setModalOpen(false);
        return;
      }
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleSelect = (product: ShopProduct) => {
    onSelectProduct(product);
    onChangeText(product.name);
    setModalOpen(false);
  };

  return (
    <View style={psiStyles.psiWrap}>
      <Text style={psiStyles.psiLabel}>{label}</Text>
      <View style={psiStyles.psiInputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={t('products.enterProductName', {
            defaultValue: 'Enter product name',
          })}
          placeholderTextColor={colors.textMuted}
          style={psiStyles.psiInput}
          autoCorrect={false}
        />
        <Pressable
          onPress={openSearch}
          style={psiStyles.psiSearchBtn}
          accessibilityLabel={t('products.searchProducts', { defaultValue: 'Search products' })}
        >
          <SearchIcon color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={psiStyles.psiHint}>
        {t('products.productHint', {
          defaultValue: 'Type a name or tap search to pick from your catalog',
        })}
      </Text>

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={psiStyles.psiModalBackdrop}>
          <View style={psiStyles.psiModalCard}>
            <View style={psiStyles.psiModalHeader}>
              <Text style={psiStyles.psiModalTitle}>{t('products.searchProductsTitle')}</Text>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
                <Text style={psiStyles.psiModalClose}>✕</Text>
              </Pressable>
            </View>

            <View style={psiStyles.psiModalSearchRow}>
              <SearchIcon />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('products.searchByProductName')}
                placeholderTextColor={colors.textMuted}
                style={psiStyles.psiModalSearchInput}
                autoFocus
                autoCorrect={false}
              />
            </View>

            {loading ? (
              <View style={psiStyles.psiCenterRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={psiStyles.psiLoadingText}>{t('products.searching')}</Text>
              </View>
            ) : searched && products.length === 0 ? (
              <View style={psiStyles.psiEmptyBox}>
                <Text style={psiStyles.psiEmptyTitle}>{t('products.noProductsFound')}</Text>
                <Text style={psiStyles.psiEmptyText}>
                  {query.trim()
                    ? t('products.noMatchFor', { name: query.trim() })
                    : t('products.noSavedProducts')}
                </Text>
                {query.trim() ? (
                  <>
                    {addError ? <Text style={psiStyles.psiAddError}>{addError}</Text> : null}
                    <Pressable
                      onPress={handleAddNew}
                      disabled={adding}
                      style={[psiStyles.psiAddNewBtn, adding && psiStyles.psiAddNewBtnDisabled]}
                    >
                      <Text style={psiStyles.psiAddNewBtnText}>
                        {adding
                          ? t('products.adding')
                          : enableCatalogAdd
                            ? t('products.addToCatalog', { name: query.trim() })
                            : t('products.useProductName', { name: query.trim() })}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" style={psiStyles.psiResults}>
                {products.map((product) => (
                  <Pressable
                    key={product.id}
                    onPress={() => handleSelect(product)}
                    style={psiStyles.psiResultRow}
                  >
                    <View style={psiStyles.psiResultBody}>
                      <Text style={psiStyles.psiResultName}>{product.name}</Text>
                      <Text style={psiStyles.psiResultMeta}>
                        {t('products.usedTimes', { count: product.usageCount ?? 0 })}
                      </Text>
                    </View>
                    <Text style={psiStyles.psiResultPrice}>{formatRs(product.lastPrice ?? 0)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const psiStyles = StyleSheet.create({
  psiWrap: { marginBottom: spacing.md },
  psiLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  psiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  psiInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  psiSearchBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  psiHint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  psiModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  psiModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  psiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  psiModalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  psiModalClose: { fontSize: 20, color: colors.textMuted, padding: 4 },
  psiModalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  psiModalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  psiCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  psiLoadingText: { fontSize: 14, color: colors.textMuted },
  psiEmptyBox: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  psiEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  psiEmptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  psiAddError: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 10,
  },
  psiAddNewBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    marginTop: 4,
  },
  psiAddNewBtnDisabled: { opacity: 0.7 },
  psiAddNewBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  psiResults: {
    paddingHorizontal: 20,
  },
  psiResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  psiResultBody: { flex: 1, paddingRight: 12 },
  psiResultName: { fontSize: 15, fontWeight: '600', color: colors.text },
  psiResultMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  psiResultPrice: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
