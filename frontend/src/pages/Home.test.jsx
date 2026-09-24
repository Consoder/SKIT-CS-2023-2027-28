import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Home from './Home';

function renderHome() {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe('Home scanner input validation', () => {
  it('shows no error before the field is touched', () => {
    renderHome();
    expect(screen.queryByText(/enter a url to analyze/i)).not.toBeInTheDocument();
  });

  it('shows a validation error after blurring an invalid URL and disables submit', () => {
    renderHome();
    const input = screen.getByPlaceholderText(/enter url to analyze/i);

    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.blur(input);

    expect(screen.getByText(/enter a valid url/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze url/i })).toBeDisabled();
  });

  it('clears the error and re-enables submit once the URL is valid', () => {
    renderHome();
    const input = screen.getByPlaceholderText(/enter url to analyze/i);

    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: 'https://example.com' } });

    expect(screen.queryByText(/enter a valid url/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze url/i })).not.toBeDisabled();
  });
});
