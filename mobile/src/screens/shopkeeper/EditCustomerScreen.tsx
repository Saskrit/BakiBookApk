import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { fetchCustomer, updateCustomer } from '../../api/customers';
import { appAlert } from '../../contexts/DialogContext';
import { Button, ErrorText, Input, LoadingState, Screen, Subtitle, Title } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditCustomer'>;

export default function EditCustomerScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { customerId } = route.params;
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
      await updateCustomer(customerId, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
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
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title>{t('customers.editTitle')}</Title>
        <Subtitle>{t('customers.editSubtitle')}</Subtitle>
        {error ? <ErrorText message={error} /> : null}
        <Input label={t('customers.fields.name')} value={name} onChangeText={setName} />
        <Input label={t('customers.fields.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input
          label={t('customers.fields.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
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
