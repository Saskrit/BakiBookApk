import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { createCustomer } from '../../api/customers';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { Button, ErrorText, Input, Screen, Subtitle, Title } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { isShopVerified } from '../../utils/authHelpers';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddCustomer'>;

export default function AddCustomerScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const shopVerified = isShopVerified(user);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('customers.nameRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createCustomer({
        name: name.trim(),
        phone,
        email: shopVerified ? email : '',
        address,
      });
      appAlert(t('common.saved'), t('customers.addedSuccess'));
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.failedToSave'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title>{t('customers.addTitle')}</Title>
        <Subtitle>{t('customers.addSubtitle')}</Subtitle>
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
        <Button title={t('customers.saveCustomer')} onPress={handleSave} loading={loading} />
      </ScrollView>
    </Screen>
  );
}
