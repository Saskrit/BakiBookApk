import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { acceptShopLink, fetchPendingLinks, rejectShopLink } from '../../api/portal';
import { appAlert } from '../../contexts/DialogContext';
import {
  CustomerButton,
  CustomerCard,
  CustomerLoading,
} from '../../components/customer/CustomerUi';
import { customerColors as c } from '../../theme/customerColors';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LinkShops'>;

export default function LinkShopsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchPendingLinks();
    setLinks(data.invitations || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setLinks([]))
        .finally(() => setLoading(false));
    }, [load])
  );

  const handleAccept = async (customerId: string) => {
    await acceptShopLink(customerId);
    appAlert(t('customer.linked'), t('customer.linkedSuccess'));
    await load();
    if (links.length <= 1) navigation.goBack();
  };

  const handleReject = async (customerId: string) => {
    await rejectShopLink(customerId);
    await load();
  };

  if (loading) return <CustomerLoading />;

  return (
    <View style={lsStyles.lsScreen}>
      <LinearGradient
        colors={[c.peach, c.sky]}
        style={[lsStyles.lsHeader, { paddingTop: insets.top + 10 }]}
      >
        <Text style={lsStyles.lsBack} onPress={() => navigation.goBack()}>
          {t('common.back')}
        </Text>
        <Text style={lsStyles.lsTitle}>{t('customer.linkShopsTitle')}</Text>
        <Text style={lsStyles.lsSubtitle}>{t('customer.linkShopsSubtitle')}</Text>
      </LinearGradient>

      <FlatList
        contentContainerStyle={[lsStyles.lsContent, { paddingBottom: insets.bottom + 24 }]}
        data={links}
        keyExtractor={(item, index) => String(item.id || index)}
        ListEmptyComponent={<Text style={lsStyles.lsEmpty}>{t('customer.noPendingLinks')}</Text>}
        renderItem={({ item }) => (
          <CustomerCard>
            <Text style={lsStyles.lsShop}>{String(item.shopName || 'Shop')}</Text>
            <Text style={lsStyles.lsMeta}>
              {t('customer.invitedAs', { name: String(item.email || item.name || '') })}
            </Text>
            <CustomerButton title={t('customer.accept')} onPress={() => handleAccept(String(item.id))} />
            <CustomerButton
              title={t('customer.reject')}
              variant="outline"
              onPress={() => handleReject(String(item.id))}
            />
          </CustomerCard>
        )}
      />
    </View>
  );
}

const lsStyles = StyleSheet.create({
  lsScreen: { flex: 1, backgroundColor: c.cream },
  lsHeader: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  lsBack: { color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  lsTitle: { fontSize: 28, fontWeight: '800', color: c.text },
  lsSubtitle: { marginTop: 4, color: c.textMuted },
  lsContent: { padding: 16 },
  lsEmpty: { textAlign: 'center', color: c.textMuted, marginTop: 40 },
  lsShop: { fontSize: 17, fontWeight: '800', color: c.text },
  lsMeta: { color: c.textMuted, marginVertical: 8 },
});
