import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import Home from './Home';

function renderHome() {
  renderWithProviders(<Home />);
}

describe('Home scanner input validation', () => {
  it('shows no error before the field is touched', () => {
    renderHome();
    expect(screen.queryByText(/enter a url to analyze/i)).not.toBeInTheDocument();
  });

  it('shows a validation error after blurring an invalid URL and disables submit', () => {
    renderHome();
    const input = screen.getByPlaceholderText(/enter url to analyze/i);

    fireEvent.change(input, { target: { value: 'not a url' } });
    fireEvent.blur(input);

    expect(screen.getByText(/enter a valid url/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze url/i })).toBeDisabled();
  });

  it('rejects dangerous schemes the same way the backend does', () => {
    renderHome();
    const input = screen.getByPlaceholderText(/enter url to analyze/i);

    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
    fireEvent.blur(input);

    expect(screen.getByText(/must use http/i)).toBeInTheDocument();
  });

  it('clears the error and re-enables submit once the URL is valid', () => {
    renderHome();
    const input = screen.getByPlaceholderText(/enter url to analyze/i);

    fireEvent.change(input, { target: { value: 'not a url' } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: 'https://example.com' } });

    expect(screen.queryByText(/enter a valid url/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze url/i })).not.toBeDisabled();
  });

  it('explains the four verdict classes', () => {
    renderHome();
    for (const label of ['Benign', 'Suspicious', 'Phishing', 'Malware']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});
