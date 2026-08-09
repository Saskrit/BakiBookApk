import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { formatRs, getInitials } from '../utils/format';
import type { Customer } from '../types';

export function CustomerCard({
  customer,
  onView,
  onCredit,
  onPayment,
}: {
  customer: Customer;
  onView: () => void;
  onCredit: () => void;
  onPayment: () => void;
}) {
  return (
    <View style={ccStyles.ccCard}>
      <View style={ccStyles.ccRow}>
        <View style={ccStyles.ccAvatar}>
          <Text style={ccStyles.ccAvatarText}>{getInitials(customer.name)}</Text>
        </View>
        <View style={ccStyles.ccInfo}>
          <Text style={ccStyles.ccName}>{customer.name}</Text>
          <Text style={[ccStyles.ccDue, customer.balance > 0 && ccStyles.ccDueActive]}>
            Due: {formatRs(customer.balance)}
          </Text>
        </View>
      </View>
      <View style={ccStyles.ccActions}>
        <ActionChip label="View" onPress={onView} />
        <ActionChip label="Credit" onPress={onCredit} primary />
        <ActionChip label="Payment" onPress={onPayment} />
      </View>
    </View>
  );
}

function ActionChip({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[ccStyles.ccChip, primary && ccStyles.ccChipPrimary]}
    >
      <Text style={[ccStyles.ccChipText, primary && ccStyles.ccChipTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const ccStyles = StyleSheet.create({
  ccCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  ccRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  ccAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8EFE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ccAvatarText: { color: colors.primaryDark, fontWeight: '700', fontSize: 16 },
  ccInfo: { flex: 1 },
  ccName: { fontSize: 16, fontWeight: '700', color: colors.text },
  ccDue: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  ccDueActive: { color: colors.danger, fontWeight: '600' },
  ccActions: { flexDirection: 'row', gap: 8 },
  ccChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  ccChipPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  ccChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  ccChipTextPrimary: { color: '#fff' },
});
