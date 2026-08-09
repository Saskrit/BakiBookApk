import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path, Rect } from 'react-native-svg';
import { appAlert } from '../../contexts/DialogContext';
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
} from '../../api/expenses';
import { Button, ErrorText, LoadingState } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { formatDate, formatRs } from '../../utils/format';
import { EXPENSE_CATEGORIES, type ShopExpense } from '../../types';
import type { RootStackParamList } from '../../navigation/types';

const CATEGORY_COLORS: Record<string, string> = {
  Stock: '#EA580C',
  Rent: '#2563EB',
  Utilities: '#0891B2',
  Transport: '#7C3AED',
  Salary: '#059669',
  Marketing: '#DB2777',
  Maintenance: '#CA8A04',
  Other: '#64748B',
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string, locale: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

function toDateInput(value?: string) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

export default function ExpensesScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<ShopExpense[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([...EXPENSE_CATEGORIES]);
  const [month, setMonth] = useState(currentMonthKey());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShopExpense | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(toDateInput());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const locale = i18n.language === 'ne' ? 'ne-NP' : 'en-NP';
  const monthDisplay = monthLabel(month, locale);

  const load = useCallback(async () => {
    const res = await fetchExpenses({
      month,
      ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    });
    setExpenses(Array.isArray(res.expenses) ? res.expenses : []);
    setMonthTotal(Number(res.total) || 0);
    if (res.categories?.length) setCategories(res.categories);
  }, [month, categoryFilter]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : t('expenses.loadFailed')))
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

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expenses) {
      map.set(expense.category, (map.get(expense.category) || 0) + expense.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const shiftMonth = (delta: number) => {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1 + delta, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setAmount('');
    setCategory(EXPENSE_CATEGORIES[0]);
    setNote('');
    setExpenseDate(toDateInput());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (expense: ShopExpense) => {
    setEditing(expense);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setCategory(expense.category || EXPENSE_CATEGORIES[0]);
    setNote(expense.note || '');
    setExpenseDate(toDateInput(expense.expenseDate));
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setFormError(t('expenses.titleRequired'));
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setFormError(t('expenses.validAmount'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        title: title.trim(),
        amount: parsedAmount,
        category,
        note: note.trim(),
        expenseDate: new Date(expenseDate).toISOString(),
      };
      if (editing) {
        await updateExpense(editing.id, payload);
      } else {
        await createExpense(payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (expense: ShopExpense) => {
    appAlert(t('expenses.deleteTitle'), t('expenses.deleteConfirm', { title: expense.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(expense.id);
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

  const listHeader = (
    <View style={exStyles.exListHeader}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={exStyles.exFilterRow}
      >
        <Pressable
          style={[exStyles.exFilterChip, categoryFilter === 'all' && exStyles.exFilterChipActive]}
          onPress={() => setCategoryFilter('all')}
        >
          <Text style={[exStyles.exFilterText, categoryFilter === 'all' && exStyles.exFilterTextActive]}>
            {t('common.all')}
          </Text>
        </Pressable>
        {categories.map((cat) => (
          <Pressable
            key={cat}
            style={[exStyles.exFilterChip, categoryFilter === cat && exStyles.exFilterChipActive]}
            onPress={() => setCategoryFilter(cat)}
          >
            <Text style={[exStyles.exFilterText, categoryFilter === cat && exStyles.exFilterTextActive]}>
              {t(`expenses.categories.${cat}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {categoryBreakdown.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={exStyles.exBreakdownRow}
        >
          {categoryBreakdown.map(([cat, total]) => (
            <View key={cat} style={exStyles.exBreakdownPill}>
              <View
                style={[exStyles.exBreakdownDot, { backgroundColor: CATEGORY_COLORS[cat] || '#64748B' }]}
              />
              <Text style={exStyles.exBreakdownCat}>{t(`expenses.categories.${cat}`)}</Text>
              <Text style={exStyles.exBreakdownAmt}>{formatRs(total)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {error ? <Text style={exStyles.exError}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={exStyles.exScreen}>
      <View style={[exStyles.exHeader, { paddingTop: insets.top + 12 }]}>
        <View style={exStyles.exHeaderTop}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={exStyles.exBack}>{t('common.back')}</Text>
          </Pressable>
          <Pressable style={exStyles.exAddBtn} onPress={openAdd}>
            <Text style={exStyles.exAddBtnText}>{t('expenses.add')}</Text>
          </Pressable>
        </View>
        <Text style={exStyles.exHeaderTitle}>{t('expenses.title')}</Text>
        <Text style={exStyles.exHeaderSubtitle}>{t('expenses.subtitle')}</Text>

        <View style={exStyles.exMonthRow}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={exStyles.exMonthBtn}>
            <Text style={exStyles.exMonthArrow}>‹</Text>
          </Pressable>
          <Text style={exStyles.exMonthLabel}>{monthDisplay}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={8} style={exStyles.exMonthBtn}>
            <Text style={exStyles.exMonthArrow}>›</Text>
          </Pressable>
        </View>

        <View style={exStyles.exTotalCard}>
          <Text style={exStyles.exTotalLabel}>{t('expenses.totalThisMonth')}</Text>
          <Text style={exStyles.exTotalValue}>{formatRs(monthTotal)}</Text>
        </View>
      </View>

      <FlatList
        style={exStyles.exList}
        data={expenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[
          exStyles.exListContent,
          expenses.length === 0 && exStyles.exListContentEmpty,
          { paddingBottom: insets.bottom + 16 },
        ]}
        ListEmptyComponent={
          <View style={exStyles.exEmptyBox}>
            <Text style={exStyles.exEmptyTitle}>{t('expenses.emptyTitle')}</Text>
            <Text style={exStyles.exEmpty}>
              {t('expenses.emptyBody', { month: monthDisplay.toLowerCase() })}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={exStyles.exRow}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          >
            <View
              style={[
                exStyles.exRowIcon,
                { backgroundColor: `${CATEGORY_COLORS[item.category] || '#64748B'}18` },
              ]}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Rect
                  x={5}
                  y={4}
                  width={14}
                  height={16}
                  rx={2}
                  stroke={CATEGORY_COLORS[item.category] || '#64748B'}
                  strokeWidth={2}
                />
                <Path
                  d="M9 10 H15 M9 14 H13"
                  stroke={CATEGORY_COLORS[item.category] || '#64748B'}
                  strokeWidth={2}
                />
              </Svg>
            </View>
            <View style={exStyles.exRowBody}>
              <Text style={exStyles.exRowName} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={exStyles.exRowMeta} numberOfLines={1}>
                {t(`expenses.categories.${item.category}`)}
                {item.expenseDate ? ` · ${formatDate(item.expenseDate)}` : ''}
              </Text>
              {item.note ? (
                <Text style={exStyles.exRowNote} numberOfLines={2}>
                  {item.note}
                </Text>
              ) : null}
            </View>
            <Text style={exStyles.exRowAmount}>{formatRs(item.amount)}</Text>
          </Pressable>
        )}
      />

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={exStyles.exModalBackdrop}
        >
          <Pressable style={exStyles.exModalDismiss} onPress={() => setModalOpen(false)} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[exStyles.exModalScroll, { paddingBottom: insets.bottom + 16 }]}
          >
            <View style={exStyles.exModalCard}>
              <View style={exStyles.exModalHandle} />
              <Text style={exStyles.exModalTitle}>
                {editing ? t('expenses.editExpense') : t('expenses.addExpense')}
              </Text>
              {formError ? <ErrorText message={formError} /> : null}

              <Text style={exStyles.exFieldLabel}>{t('expenses.titleLabel')}</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('expenses.titlePlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={exStyles.exFieldInput}
                autoFocus
              />

              <Text style={exStyles.exFieldLabel}>{t('expenses.amountRs')}</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
                style={exStyles.exFieldInput}
              />

              <Text style={exStyles.exFieldLabel}>{t('expenses.category')}</Text>
              <View style={exStyles.exCategoryGrid}>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[exStyles.exCategoryChip, category === cat && exStyles.exCategoryChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        exStyles.exCategoryChipText,
                        category === cat && exStyles.exCategoryChipTextActive,
                      ]}
                    >
                      {t(`expenses.categories.${cat}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={exStyles.exFieldLabel}>{t('expenses.date')}</Text>
              <TextInput
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder={t('expenses.datePlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={exStyles.exFieldInput}
              />

              <Text style={exStyles.exFieldLabel}>{t('expenses.noteOptional')}</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('expenses.notePlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[exStyles.exFieldInput, exStyles.exNoteInput]}
                multiline
              />

              <View style={exStyles.exModalActions}>
                <Button title={t('common.cancel')} variant="outline" onPress={() => setModalOpen(false)} />
                <Button
                  title={editing ? t('common.save') : t('expenses.addExpense')}
                  onPress={handleSave}
                  loading={saving}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const exStyles = StyleSheet.create({
  exScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  exHeader: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  exHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exBack: { color: 'rgba(255,255,255,0.95)', fontSize: ty.bodyLg, fontWeight: '600' },
  exAddBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exAddBtnText: { color: '#FFF', fontWeight: '700', fontSize: ty.body },
  exHeaderTitle: { color: '#FFF', fontSize: ty.h1, fontWeight: '800' },
  exHeaderSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: ty.body, marginTop: 4 },
  exMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 14,
  },
  exMonthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exMonthArrow: { color: '#FFF', fontSize: 22, fontWeight: '400', lineHeight: 24 },
  exMonthLabel: { color: '#FFF', fontSize: ty.bodyLg, fontWeight: '700', minWidth: 140, textAlign: 'center' },
  exTotalCard: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  exTotalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: ty.caption },
  exTotalValue: { color: '#FFF', fontSize: ty.xxl, fontWeight: '800', marginTop: 4 },
  exList: { flex: 1 },
  exListContent: { paddingHorizontal: 16, paddingTop: 4 },
  exListContentEmpty: { flexGrow: 1 },
  exListHeader: { paddingBottom: 8 },
  exFilterRow: { paddingVertical: 12, gap: 8, paddingRight: 16 },
  exFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  exFilterChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  exFilterText: { fontSize: ty.caption, fontWeight: '600', color: colors.textMuted },
  exFilterTextActive: { color: '#FFF' },
  exBreakdownRow: { gap: 8, paddingBottom: 8, paddingRight: 16 },
  exBreakdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  exBreakdownDot: { width: 8, height: 8, borderRadius: 4 },
  exBreakdownCat: { fontSize: ty.sm, color: colors.textMuted, fontWeight: '600' },
  exBreakdownAmt: { fontSize: ty.sm, color: colors.text, fontWeight: '700' },
  exError: { color: colors.danger, marginBottom: 8, fontSize: ty.body },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    gap: 12,
  },
  exRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exRowBody: { flex: 1, minWidth: 0 },
  exRowName: { fontSize: ty.md, fontWeight: '700', color: colors.text },
  exRowMeta: { fontSize: ty.caption, color: colors.textMuted, marginTop: 4 },
  exRowNote: { fontSize: ty.sm, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  exRowAmount: {
    fontSize: ty.bodyLg,
    fontWeight: '800',
    color: '#2563EB',
    marginLeft: 8,
    flexShrink: 0,
  },
  exEmptyBox: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 },
  exEmptyTitle: { fontSize: ty.md, fontWeight: '700', color: colors.text, marginBottom: 8 },
  exEmpty: { textAlign: 'center', color: colors.textMuted, lineHeight: 20, fontSize: ty.body },
  exModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  exModalDismiss: { flex: 1 },
  exModalScroll: { flexGrow: 0 },
  exModalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 12,
  },
  exModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  exModalTitle: { fontSize: ty.lg, fontWeight: '800', color: colors.text, marginBottom: 12 },
  exFieldLabel: { fontSize: ty.body, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 8 },
  exFieldInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: ty.md,
    color: colors.text,
  },
  exNoteInput: { minHeight: 72, textAlignVertical: 'top' },
  exCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  exCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: colors.border,
  },
  exCategoryChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  exCategoryChipText: { fontSize: ty.caption, fontWeight: '600', color: colors.textMuted },
  exCategoryChipTextActive: { color: '#FFF' },
  exModalActions: { gap: 8, marginTop: 16 },
});
