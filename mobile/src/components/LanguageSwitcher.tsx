import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import type { AppLanguage } from '../types';

type Props = {
  accent?: string;
  textColor?: string;
  mutedColor?: string;
  backgroundColor?: string;
};

export default function LanguageSwitcher({
  accent = '#6A7E3F',
  textColor = '#2D3319',
  mutedColor = '#6B7280',
  backgroundColor = '#FFFFFF',
}: Props) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  const Option = ({ code, label }: { code: AppLanguage; label: string }) => {
    const active = language === code;
    return (
      <Pressable
        onPress={() => setLanguage(code)}
        style={[
          lwStyles.lwOption,
          { borderColor: active ? accent : '#E5E7EB', backgroundColor: active ? `${accent}18` : backgroundColor },
        ]}
      >
        <Text style={[lwStyles.lwOptionText, { color: active ? accent : textColor }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={lwStyles.lwWrap}>
      <Text style={[lwStyles.lwLabel, { color: mutedColor }]}>{t('common.language')}</Text>
      <View style={lwStyles.lwRow}>
        <Option code="en" label={t('common.english')} />
        <Option code="ne" label={t('common.nepali')} />
      </View>
    </View>
  );
}

const lwStyles = StyleSheet.create({
  lwWrap: { gap: 8 },
  lwLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  lwRow: { flexDirection: 'row', gap: 10 },
  lwOption: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  lwOptionText: { fontSize: 15, fontWeight: '700' },
});
