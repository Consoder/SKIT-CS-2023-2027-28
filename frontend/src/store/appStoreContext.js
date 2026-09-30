import { createContext, useContext } from 'react';

export const AppStoreContext = createContext(null);

export function useAppStore() {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return store;
}
