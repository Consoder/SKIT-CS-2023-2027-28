import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppStoreProvider from '../store/AppStoreProvider';

// Renders UI inside the router + a fresh in-memory store (no localStorage).
export function renderWithProviders(ui, { route = '/', initialState = {} } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppStoreProvider initialState={{ scans: [], ledger: [], settings: { mode: 'demo' }, ...initialState }}>{ui}</AppStoreProvider>
    </MemoryRouter>,
  );
}
