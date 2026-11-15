import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatbotWidget from './ChatbotWidget';

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

describe('ChatbotWidget', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: 'EthioSmart is a platform that helps Ethiopian freshman students prepare for their exams.',
        links: [{ route: '/auth', label: 'Sign up / Sign in' }],
      }),
    } as Response);
  });

  it('renders only the floating button before opening', () => {
    render(<ChatbotWidget />);
    expect(screen.getByRole('button', { name: /ask about ethiosmart/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /ethiosmart ai assistant/i })).not.toBeInTheDocument();
  });

  it('opens the panel and shows the welcome message', () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /ask about ethiosmart/i }));
    expect(screen.getByRole('dialog', { name: /ethiosmart ai assistant/i })).toBeInTheDocument();
    expect(screen.getByText(/Hi! I'm the EthioSmart AI Assistant/i)).toBeInTheDocument();
  });

  it('sends a question and renders the assistant answer with links', async () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /ask about ethiosmart/i }));

    const input = screen.getByRole('textbox', { name: /ask about ethiosmart/i });
    fireEvent.change(input, { target: { value: 'What is EthioSmart?' } });
    fireEvent.click(screen.getByRole('button', { name: /send question/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/EthioSmart is a platform that helps Ethiopian freshman students/i)
      ).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/chatbot/ask');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      message: 'What is EthioSmart?',
      history: [],
    });
    // Allowlisted link chip rendered and pointing at /auth
    const link = screen.getByRole('link', { name: /sign up \/ sign in/i });
    expect(link).toHaveAttribute('href', '/auth');
  });

  it('shows a friendly fallback message when the API fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'down' }),
    } as Response);
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /ask about ethiosmart/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /ask about ethiosmart/i }), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send question/i }));
    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    });
  });

  it('closes on Escape', () => {
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /ask about ethiosmart/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
