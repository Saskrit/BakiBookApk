import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fetchLegalDocument, type LegalSection } from '../../api/legal';
import { LoadingState } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as t } from '../../theme/typography';
import { formatDate } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LegalDocument'>;

function SectionBlock({ section }: { section: LegalSection }) {
  return (
    <View style={ldStyles.ldSection}>
      <Text style={ldStyles.ldSectionTitle}>{section.title}</Text>
      {section.paragraphs?.map((p, i) => (
        <Text key={`p-${i}`} style={ldStyles.ldParagraph}>
          {p}
        </Text>
      ))}
      {section.bullets?.map((b, i) => (
        <View key={`b-${i}`} style={ldStyles.ldBulletRow}>
          <Text style={ldStyles.ldBulletDot}>•</Text>
          <Text style={ldStyles.ldBulletText}>{b}</Text>
        </View>
      ))}
      {section.contactEmail ? (
        <Pressable onPress={() => Linking.openURL(`mailto:${section.contactEmail}`)}>
          <Text style={ldStyles.ldLink}>{section.contactEmail}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function LegalDocumentScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { slug, title } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docTitle, setDocTitle] = useState(title);
  const [sections, setSections] = useState<LegalSection[]>([]);
  const [updated, setUpdated] = useState('');

  useEffect(() => {
    fetchLegalDocument(slug)
      .then((res) => {
        setDocTitle(res.document.title);
        setSections(res.document.sections || []);
        if (res.document.lastUpdated) {
          setUpdated(formatDate(res.document.lastUpdated));
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('legal.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (loading) return <LoadingState />;

  return (
    <View style={ldStyles.ldScreen}>
      <View style={[ldStyles.ldHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={ldStyles.ldBack}>{t('common.back')}</Text>
        </Pressable>
        <Text style={ldStyles.ldHeaderTitle}>{docTitle}</Text>
        {updated ? <Text style={ldStyles.ldUpdated}>{t('legal.lastUpdated', { date: updated })}</Text> : null}
      </View>

      <ScrollView
        contentContainerStyle={[ldStyles.ldContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={ldStyles.ldError}>{error}</Text> : null}
        {sections.map((section, index) => (
          <SectionBlock key={`${section.title}-${index}`} section={section} />
        ))}
      </ScrollView>
    </View>
  );
}

const ldStyles = StyleSheet.create({
  ldScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  ldHeader: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  ldBack: { color: 'rgba(255,255,255,0.95)', fontSize: t.bodyLg, fontWeight: '600', marginBottom: 6 },
  ldHeaderTitle: { color: '#FFF', fontSize: t.h2, fontWeight: '800' },
  ldUpdated: { color: 'rgba(255,255,255,0.85)', fontSize: t.caption, marginTop: 6 },
  ldContent: { padding: 16 },
  ldError: { color: colors.danger, marginBottom: 12, fontSize: t.body },
  ldSection: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  ldSectionTitle: { fontSize: t.bodyLg, fontWeight: '800', color: colors.text, marginBottom: 8 },
  ldParagraph: { fontSize: t.body, color: colors.textMuted, lineHeight: 20, marginBottom: 8 },
  ldBulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingLeft: 4 },
  ldBulletDot: { color: colors.primary, fontWeight: '800', lineHeight: 20 },
  ldBulletText: { flex: 1, fontSize: t.body, color: colors.textMuted, lineHeight: 20 },
  ldLink: { fontSize: t.body, color: colors.primary, fontWeight: '700', marginTop: 4 },
});
