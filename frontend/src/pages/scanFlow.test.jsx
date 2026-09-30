import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { renderWithProviders } from '../test/renderWithProviders';

describe('scan flow (demo mode)', () => {
  it('scans a phishing URL and opens its result with verdict, evidence and audit record', async () => {
    renderWithProviders(<App />, { route: '/scan' });

    const input = await screen.findByPlaceholderText(/enter url to analyze/i, {}, { timeout: 15000 });
    fireEvent.change(input, { target: { value: 'http://secure-paypa1-login.com/verify-account' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze url/i }));

    // Pipeline progress is shown while the analysis runs.
    expect(await screen.findByRole('list', { name: /analysis progress/i })).toBeInTheDocument();

    // Lands on the result page.
    expect(await screen.findByText(/analysis result/i, {}, { timeout: 20000 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('http://secure-paypa1-login.com/verify-account');
    expect(screen.getAllByText('Phishing').length).toBeGreaterThan(0);
    expect(screen.getByText(/impersonates the "paypal" brand/i)).toBeInTheDocument();

    // The audit tab shows the hash-chain record (genesis-linked, block #0).
    fireEvent.click(screen.getByRole('tab', { name: /audit record/i }));
    // Inactive panels stay in the DOM (hidden via CSS) so the PDF prints them.
    const panel = document.getElementById('panel-audit');
    expect(panel).not.toHaveClass('hidden');
    expect(within(panel).getByText('#0')).toBeInTheDocument();
  }, 45000);

  it('shows the dashboard empty state and loads sample data', async () => {
    renderWithProviders(<App />, { route: '/dashboard' });
    fireEvent.click(await screen.findByRole('button', { name: /load sample data/i }, { timeout: 15000 }));
    expect(await screen.findByText(/urls analyzed/i, {}, { timeout: 20000 })).toBeInTheDocument();
    expect(screen.getByText('Recent scans')).toBeInTheDocument();
  }, 45000);
});
