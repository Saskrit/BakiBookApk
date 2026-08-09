import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import type { DialogButton } from '../contexts/DialogContext';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
  onDismiss: () => void;
  onPress: (button: DialogButton) => void;
};

function DialogIcon({ tone }: { tone: 'default' | 'danger' | 'success' | 'info' }) {
  const stroke =
    tone === 'danger'
      ? colors.danger
      : tone === 'success'
        ? colors.primary
        : tone === 'info'
          ? colors.warning
          : colors.primary;

  const bg =
    tone === 'danger'
      ? '#FEE2E2'
      : tone === 'success'
        ? '#DCFCE7'
        : tone === 'info'
          ? '#FEF3C7'
          : '#EEF2E6';

  return (
    <View style={[adlgStyles.adlgIconWrap, { backgroundColor: bg }]}>
      {tone === 'danger' ? (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M6 7 H18 L17 19 H7 Z" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M10 7 V5 C10 4.45 10.45 4 11 4 H13 C13.55 4 14 4.45 14 5 V7" stroke={stroke} strokeWidth={2} />
          <Path d="M10 11 V16 M14 11 V16" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      ) : tone === 'success' ? (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2} />
          <Path d="M8 12 L11 15 L16 9" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2} />
          <Path d="M12 8 V13 M12 16 H12.01" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      )}
    </View>
  );
}

function detectTone(title: string, buttons: DialogButton[]): 'default' | 'danger' | 'success' | 'info' {
  if (buttons.some((b) => b.style === 'destructive')) return 'danger';
  const lower = `${title} ${buttons.map((b) => b.text).join(' ')}`.toLowerCase();
  if (lower.includes('saved') || lower.includes('success') || lower.includes('sent') || lower.includes('linked')) {
    return 'success';
  }
  if (lower.includes('error') || lower.includes('failed')) return 'danger';
  if (lower.includes('coming soon') || lower.includes('verify')) return 'info';
  return 'default';
}

function useLayout(buttons: DialogButton[]): 'row' | 'stack' {
  if (buttons.length <= 2 && buttons.some((b) => b.style === 'cancel')) {
    return 'row';
  }
  return 'stack';
}

export default function AppDialog({ visible, title, message, buttons, onDismiss, onPress }: Props) {
  const tone = detectTone(title, buttons);
  const layout = buttons.length === 1 ? 'single' : useLayout(buttons);
  const ordered =
    layout === 'row'
      ? [...buttons].sort((a, b) => {
          if (a.style === 'cancel') return -1;
          if (b.style === 'cancel') return 1;
          return 0;
        })
      : buttons.filter((b) => b.style !== 'cancel').concat(buttons.filter((b) => b.style === 'cancel'));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={adlgStyles.adlgOverlay} onPress={onDismiss}>
        <Pressable style={adlgStyles.adlgCard} onPress={(e) => e.stopPropagation()}>
          <DialogIcon tone={tone} />
          <Text style={adlgStyles.adlgTitle}>{title}</Text>
          {message ? <Text style={adlgStyles.adlgMessage}>{message}</Text> : null}

          {layout === 'single' ? (
            <Pressable
              onPress={() => onPress(buttons[0])}
              style={({ pressed }) => [adlgStyles.adlgSingleBtn, pressed && adlgStyles.adlgBtnPressed]}
            >
              <Text style={adlgStyles.adlgSingleBtnText}>{buttons[0].text}</Text>
            </Pressable>
          ) : layout === 'row' ? (
            <View style={adlgStyles.adlgRowActions}>
              {ordered.map((button) => (
                <Pressable
                  key={button.text}
                  onPress={() => onPress(button)}
                  style={({ pressed }) => [
                    adlgStyles.adlgRowBtn,
                    button.style === 'cancel' && adlgStyles.adlgRowBtnCancel,
                    button.style === 'destructive' && adlgStyles.adlgRowBtnDanger,
                    !button.style || button.style === 'default' ? adlgStyles.adlgRowBtnPrimary : null,
                    pressed && adlgStyles.adlgBtnPressed,
                  ]}
                >
                  <Text
                    style={[
                      adlgStyles.adlgRowBtnText,
                      button.style === 'cancel' && adlgStyles.adlgRowBtnTextCancel,
                      button.style === 'destructive' && adlgStyles.adlgRowBtnTextDanger,
                      (!button.style || button.style === 'default') && adlgStyles.adlgRowBtnTextPrimary,
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={adlgStyles.adlgStackActions}>
              {ordered.map((button, index) => (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => onPress(button)}
                  style={({ pressed }) => [
                    adlgStyles.adlgStackBtn,
                    index > 0 && adlgStyles.adlgStackBtnBorder,
                    button.style === 'cancel' && adlgStyles.adlgStackBtnCancel,
                    button.style === 'destructive' && adlgStyles.adlgStackBtnDanger,
                    pressed && adlgStyles.adlgBtnPressed,
                  ]}
                >
                  <Text
                    style={[
                      adlgStyles.adlgStackBtnText,
                      button.style === 'cancel' && adlgStyles.adlgStackBtnTextCancel,
                      button.style === 'destructive' && adlgStyles.adlgStackBtnTextDanger,
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const adlgStyles = StyleSheet.create({
  adlgOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 51, 25, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  adlgCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#2D3319',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  adlgIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  adlgTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  adlgMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  adlgRowActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  adlgRowBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adlgRowBtnCancel: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: colors.border,
  },
  adlgRowBtnPrimary: {
    backgroundColor: colors.primary,
  },
  adlgRowBtnDanger: {
    backgroundColor: colors.danger,
  },
  adlgRowBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  adlgRowBtnTextCancel: {
    color: colors.textMuted,
  },
  adlgRowBtnTextPrimary: {
    color: '#FFFFFF',
  },
  adlgRowBtnTextDanger: {
    color: '#FFFFFF',
  },
  adlgStackActions: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  adlgStackBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  adlgStackBtnBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  adlgStackBtnCancel: {
    backgroundColor: '#FFFFFF',
  },
  adlgStackBtnDanger: {},
  adlgStackBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  adlgStackBtnTextCancel: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  adlgStackBtnTextDanger: {
    color: colors.danger,
    fontWeight: '700',
  },
  adlgBtnPressed: {
    opacity: 0.82,
  },
  adlgSingleBtn: {
    width: '100%',
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  adlgSingleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
