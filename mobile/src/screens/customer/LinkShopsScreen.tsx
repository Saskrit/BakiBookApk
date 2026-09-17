import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  acceptShopLink,
  fetchPendingLinks,
  rejectShopLink,
  type PendingInvitation,
} from '../../api/portal';
import { appAlert } from '../../contexts/DialogContext';
import {
  CustomerButton,
  CustomerCard,
  CustomerLoading,
} from '../../components/customer/CustomerUi';
import { customerColors as c } from '../../theme/customerColors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { formatRs } from '../../utils/format';

import ScreenHeader from '../../components/ScreenHeader';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LinkShops'>;

export default function LinkShopsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [links, setLinks] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');

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

  const handleAccept = (customerId: string, shopName: string) => {
    appAlert(t('customer.acceptInviteTitle'), t('customer.acceptInviteBody', { shop: shopName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.accept'),
        onPress: async () => {
          setActingId(customerId);
          try {
            await acceptShopLink(customerId);
            appAlert(t('customer.linked'), t('customer.linkedSuccess'));
            const data = await fetchPendingLinks();
            const remaining = data.invitations || [];
            setLinks(remaining);
            if (!remaining.length) navigation.goBack();
          } catch (err) {
            appAlert(
              t('common.error'),
              err instanceof Error ? err.message : t('customer.acceptInviteFailed')
            );
          } finally {
            setActingId('');
          }
        },
      },
    ]);
  };

  const handleDecline = (customerId: string, shopName: string) => {
    appAlert(t('customer.declineInviteTitle'), t('customer.declineInviteBody', { shop: shopName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.decline'),
        style: 'destructive',
        onPress: async () => {
          setActingId(customerId);
          try {
            await rejectShopLink(customerId);
            const data = await fetchPendingLinks();
            const remaining = data.invitations || [];
            setLinks(remaining);
            if (!remaining.length) navigation.goBack();
          } catch (err) {
            appAlert(
              t('common.error'),
              err instanceof Error ? err.message : t('customer.declineInviteFailed')
            );
          } finally {
            setActingId('');
          }
        },
      },
    ]);
  };

  if (loading) return <CustomerLoading />;

  return (
    <View style={lsStyles.lsScreen}>
      <LinearGradient colors={[c.peach, c.sky]} style={lsStyles.lsHeader}>
        <ScreenHeader
          title={t('customer.linkShopsTitle')}
          subtitle={t('customer.linkShopsSubtitle')}
          onBack={() => navigation.goBack()}
          variant="customer"
          style={lsStyles.lsHeaderInner}
        />
      </LinearGradient>

      <FlatList
        contentContainerStyle={[lsStyles.lsContent, { paddingBottom: insets.bottom + 24 }]}
        data={links}
        keyExtractor={(item, index) => String(item.id || index)}
        ListEmptyComponent={<Text style={lsStyles.lsEmpty}>{t('customer.noPendingLinks')}</Text>}
        renderItem={({ item }) => {
          const id = String(item.id);
          const shopName = String(item.shopName || 'Shop');
          const balance = Number(item.balance || 0);
          const busy = actingId === id;

          return (
            <CustomerCard>
              <Text style={lsStyles.lsShop}>{shopName}</Text>
              <Text style={lsStyles.lsMeta}>
                {t('customer.invitedAs', { name: String(item.email || item.name || '') })}
              </Text>
              {balance > 0 ? (
                <Text style={lsStyles.lsDue}>
                  {t('customer.currentDue')}: {formatRs(balance)}
                </Text>
              ) : null}
              <View style={lsStyles.lsActions}>
                <CustomerButton
                  title={t('customer.view')}
                  size="medium"
                  variant="secondary"
                  style={lsStyles.lsActionBtn}
                  disabled={busy}
                  onPress={() =>
                    navigation.navigate('LinkShopInvite', {
                      customerId: id,
                      shopName,
                    })
                  }
                />
                <CustomerButton
                  title={t('customer.accept')}
                  size="medium"
                  style={lsStyles.lsActionBtn}
                  loading={busy}
                  disabled={busy}
                  onPress={() => handleAccept(id, shopName)}
                />
                <CustomerButton
                  title={t('customer.decline')}
                  size="medium"
                  variant="outline"
                  style={lsStyles.lsActionBtn}
                  disabled={busy}
                  onPress={() => handleDecline(id, shopName)}
                />
              </View>
            </CustomerCard>
          );
        }}
      />
    </View>
  );
}

const lsStyles = StyleSheet.create({
  lsScreen: { flex: 1, backgroundColor: c.cream },
  lsHeader: {
    borderBottomLeftRadius: radius.container,
    borderBottomRightRadius: radius.container,
  },
  lsHeaderInner: { paddingBottom: 18 },
  lsContent: { padding: spacing.md },
  lsEmpty: { textAlign: 'center', color: c.textMuted, marginTop: 40 },
  lsShop: { fontSize: 17, fontWeight: '800', color: c.text },
  lsMeta: { color: c.textMuted, marginTop: 6, marginBottom: 4 },
  lsDue: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 12,
  },
  lsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  lsActionBtn: {
    flex: 1,
  },
});
