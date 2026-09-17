import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { fetchCustomer, updateCustomer } from '../../api/customers';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { Button, ErrorText, Input, LoadingState, Screen } from '../../components/ui';
import ScreenHeader from '../../components/ScreenHeader';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { isShopVerified } from '../../utils/authHelpers';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditCustomer'>;

export default function EditCustomerScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { customerId } = route.params;
  const shopVerified = isShopVerified(user);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomer(customerId)
      .then((res) => {
        setName(res.customer.name || '');
        setPhone(res.customer.phone || '');
        setEmail(res.customer.email || '');
        setAddress(res.customer.address || '');
        setNotes(res.customer.notes || '');
      })
      .catch(() => setError(t('customers.loadCustomerFailed')))
      .finally(() => setLoading(false));
  }, [customerId, t]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('customers.nameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, string | undefined> = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (shopVerified) {
        payload.email = email.trim() || undefined;
      }
      await updateCustomer(customerId, payload);
      appAlert(t('common.saved'), t('customers.updatedSuccess'));
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <Screen>
      <ScreenHeader
        title={t('customers.editTitle')}
        subtitle={t('customers.editSubtitle')}
        onBack={() => navigation.goBack()}
        style={{ paddingBottom: 0 }}
      />
      <ScrollView keyboardShouldPersistTaps="handled">
        {error ? <ErrorText message={error} /> : null}
        <Input label={t('customers.fields.name')} value={name} onChangeText={setName} />
        <Input label={t('customers.fields.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input
          label={t('customers.fields.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={shopVerified}
        />
        {!shopVerified ? (
          <Text style={{ color: colors.textMuted, fontSize: ty.sm, marginBottom: 12, marginTop: -4 }}>
            {t('customers.emailLockedUntilVerified')}
          </Text>
        ) : null}
        <Input label={t('customers.fields.address')} value={address} onChangeText={setAddress} />
        <Input label={t('customers.fields.notes')} value={notes} onChangeText={setNotes} multiline />
        <Button title={t('customers.saveChanges')} onPress={handleSave} loading={saving} />
        <Button
          title={t('common.cancel')}
          variant="outline"
          onPress={() => navigation.goBack()}
          disabled={saving}
        />
      </ScrollView>
    </Screen>
  );
}
