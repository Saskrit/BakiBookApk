import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography as ty } from '../theme/typography';

type Variant = 'incomplete' | 'rejected' | 'pending';

type Props = {
  visible: boolean;
  variant: Variant;
  onComplete: () => void;
  onDismiss: () => void;
};

export default function ShopSetupPrompt({ visible, variant, onComplete, onDismiss }: Props) {
  const { t } = useTranslation();

  const title =
    variant === 'pending'
      ? t('shopSetup.pendingTitle')
      : variant === 'rejected'
        ? t('shopSetup.rejectedTitle')
        : t('shopSetup.incompleteTitle');

  const body =
    variant === 'pending'
      ? t('shopSetup.pendingBody')
      : variant === 'rejected'
        ? t('shopSetup.rejectedBody')
        : t('shopSetup.incompleteBody');

  const primaryLabel =
    variant === 'pending' ? t('shopSetup.viewProfile') : t('shopSetup.completeProfile');

  const iconBg = variant === 'pending' ? '#DBEAFE' : variant === 'rejected' ? '#FEE2E2' : '#FEF3C7';
  const iconStroke =
    variant === 'pending' ? '#2563EB' : variant === 'rejected' ? colors.danger : colors.warning;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke={iconStroke} strokeWidth={2} />
              <Path
                d="M12 8 V13 M12 16 H12.01"
                stroke={iconStroke}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          {variant !== 'pending' ? (
            <View style={styles.checklist}>
              <Text style={styles.checkItem}>• {t('shopSetup.needName')}</Text>
              <Text style={styles.checkItem}>• {t('shopSetup.needLocation')}</Text>
              <Text style={styles.checkItem}>• {t('shopSetup.needPhoto')}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onComplete}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={styles.laterBtn}>
            <Text style={styles.laterBtnText}>
              {variant === 'pending' ? t('common.ok') : t('shopSetup.later')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 51, 25, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.container,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  checklist: {
    alignSelf: 'stretch',
    backgroundColor: '#F8FAF4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
    gap: 4,
  },
  checkItem: {
    fontSize: ty.body,
    color: colors.text,
    fontWeight: '600',
    lineHeight: 20,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  laterBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  laterBtnText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
  pressed: { opacity: 0.85 },
});
