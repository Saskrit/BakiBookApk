import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import AppDialog from '../components/AppDialog';
import i18n from '../i18n';

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export type DialogButton = {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: DialogButtonStyle;
};

export type DialogOptions = {
  title: string;
  message?: string;
  buttons: DialogButton[];
};

type DialogContextValue = {
  showDialog: (options: DialogOptions) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

let externalShowDialog: ((options: DialogOptions) => void) | null = null;

export function appAlert(title: string, message?: string, buttons?: DialogButton[]) {
  const resolvedButtons = buttons?.length ? buttons : [{ text: i18n.t('common.ok') }];
  if (externalShowDialog) {
    externalShowDialog({ title, message, buttons: resolvedButtons });
    return;
  }
  console.warn('[appAlert] DialogProvider not mounted:', title);
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);

  const showDialog = useCallback((next: DialogOptions) => {
    setOptions(next);
    setVisible(true);
  }, []);

  useEffect(() => {
    externalShowDialog = showDialog;
    return () => {
      externalShowDialog = null;
    };
  }, [showDialog]);

  const close = useCallback(() => {
    setVisible(false);
    setOptions(null);
  }, []);

  const handlePress = useCallback((button: DialogButton) => {
    close();
    const run = button.onPress;
    if (!run) return;
    // Wait for the modal to finish closing so Android can open the image picker / camera.
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        void Promise.resolve(run()).catch((err) => {
          console.error('[Dialog] button handler failed:', err);
        });
      }, 350);
    });
  }, [close]);

  const value = useMemo(() => ({ showDialog }), [showDialog]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AppDialog
        visible={visible}
        title={options?.title ?? ''}
        message={options?.message}
        buttons={options?.buttons ?? []}
        onDismiss={close}
        onPress={handlePress}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}
