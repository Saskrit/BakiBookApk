import './src/i18n';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { DialogProvider } from './src/contexts/DialogContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { SocketProvider } from './src/contexts/SocketContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { MaintenanceProvider } from './src/contexts/MaintenanceContext';
import { useAppFonts } from './src/hooks/useAppFonts';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme/colors';
import { warmAuthServices } from './src/utils/warmApi';

export default function App() {
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    if (fontsLoaded) warmAuthServices();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <DialogProvider>
        <AuthProvider>
          <LanguageProvider>
            <MaintenanceProvider>
              <SocketProvider>
                <NotificationProvider>
                  <RootNavigator />
                  <StatusBar style="dark" />
                </NotificationProvider>
              </SocketProvider>
            </MaintenanceProvider>
          </LanguageProvider>
        </AuthProvider>
      </DialogProvider>
    </SafeAreaProvider>
  );
}
