import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/layout';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typeScale } from '../theme/typography';
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
    borderRadius: radius.card,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  ccRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  ccAvatar: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: layout.touchTarget / 2,
    backgroundColor: '#E8EFE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  ccAvatarText: { ...typeScale.body, color: colors.primaryDark, fontFamily: typeScale.cardTitle.fontFamily },
  ccInfo: { flex: 1 },
  ccName: { ...typeScale.body, fontFamily: typeScale.cardTitle.fontFamily, color: colors.text },
  ccDue: { ...typeScale.bodySmall, color: colors.textMuted, marginTop: spacing.xxs / 2 },
  ccDueActive: { color: colors.danger, fontFamily: typeScale.label.fontFamily },
  ccActions: { flexDirection: 'row', gap: spacing.xs },
  ccChip: {
    flex: 1,
    minHeight: layout.buttonHeight,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  ccChipPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  ccChipText: { ...typeScale.button, color: colors.text },
  ccChipTextPrimary: { color: '#fff' },
});
