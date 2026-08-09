import './src/i18n';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { DialogProvider } from './src/contexts/DialogContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { SocketProvider } from './src/contexts/SocketContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { MaintenanceProvider } from './src/contexts/MaintenanceContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
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
