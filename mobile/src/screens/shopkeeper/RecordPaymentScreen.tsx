import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { createPayment } from '../../api/transactions';
import { appAlert } from '../../contexts/DialogContext';
import { Button, ErrorText, Input, Screen, Subtitle, Title } from '../../components/ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import type { RootStackParamList } from '../../navigation/types';

const METHODS = [
  { value: 'Cash', labelKey: 'payments.methods.cash' },
  { value: 'eSewa', labelKey: 'payments.methods.esewa' },
  { value: 'Khalti', labelKey: 'payments.methods.khalti' },
  { value: 'Bank Transfer', labelKey: 'payments.methods.bankTransfer' },
  { value: 'Other', labelKey: 'payments.methods.other' },
] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'RecordPayment'>;

export default function RecordPaymentScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { customerId, customerName } = route.params;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      setError(t('payments.validAmount'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createPayment({
        customerId,
        amount: Number(amount),
        method,
        note: note.trim() || undefined,
      });
      appAlert(t('common.saved'), t('payments.savedSuccess'));
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.failedToSave'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title>{t('payments.title')}</Title>
        <Subtitle>{customerName || t('common.customer')}</Subtitle>
        {error ? <ErrorText message={error} /> : null}
        <Input label={t('payments.amount')} value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <Text style={rpStyles.rpLabel}>{t('payments.method')}</Text>
        <View style={rpStyles.rpMethodRow}>
          {METHODS.map((m) => (
            <Text
              key={m.value}
              onPress={() => setMethod(m.value)}
              style={[rpStyles.rpMethodChip, method === m.value && rpStyles.rpMethodChipActive]}
            >
              {t(m.labelKey)}
            </Text>
          ))}
        </View>
        <Input label={t('payments.notes')} value={note} onChangeText={setNote} />
        <Button title={t('payments.savePayment')} onPress={handleSave} loading={loading} />
      </ScrollView>
    </Screen>
  );
}

const rpStyles = StyleSheet.create({
  rpLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  rpMethodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  rpMethodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    overflow: 'hidden',
  },
  rpMethodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary, color: '#fff' },
});
