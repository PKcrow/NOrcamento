import { describe, expect, it } from 'vitest';
import {
  classifyGoogleAuthError,
  getAuthErrorDetails,
  getGoogleAuthErrorMessage,
  getGoogleButtonLabel,
  getGoogleCooldownSeconds,
  getGoogleRetryAt,
  isGoogleButtonDisabled,
  isRateLimitError,
} from './googleAuth';

describe('Google OAuth error classification', () => {
  it.each([
    { error: { status: 429 }, label: 'HTTP status' },
    { error: { statusCode: 429 }, label: 'statusCode' },
    {
      error: { errors: [{ code: 'too_many_requests' }] },
      label: 'Clerk code',
    },
    {
      error: { code: 'rate_limit_exceeded' },
      label: 'rate-limit code',
    },
    {
      error: { errors: [{ message: 'too many requests' }] },
      label: 'rate-limit message',
    },
  ])('classifies $label as a temporary block', ({ error }) => {
    const details = getAuthErrorDetails(error);

    expect(isRateLimitError(details)).toBe(true);
    expect(classifyGoogleAuthError(details)).toBe('rate_limit');
  });

  it.each([
    {
      error: { errors: [{ code: 'oauth_redirect_error', message: 'redirect failed' }] },
      kind: 'redirect',
      message:
        'Não foi possível concluir o retorno do Google. Verifique o app e tente novamente.',
    },
    {
      error: { code: 'oauth_cancelled', message: 'user cancelled the flow' },
      kind: 'cancelled',
      message: 'Login com Google cancelado. Você pode tentar novamente quando quiser.',
    },
    {
      error: { type: 'user_cancelled' },
      kind: 'cancelled',
      message: 'Login com Google cancelado. Você pode tentar novamente quando quiser.',
    },
    {
      error: { name: 'AbortError' },
      kind: 'cancelled',
      message: 'Login com Google cancelado. Você pode tentar novamente quando quiser.',
    },
    {
      error: { errors: [{ code: 'invalid_credentials', message: 'credentials rejected' }] },
      kind: 'credentials',
      message:
        'Não foi possível entrar com o Google. Verifique suas credenciais e tente novamente.',
    },
  ])('keeps the $kind error message separate from rate limits', ({ error, kind, message }) => {
    const details = getAuthErrorDetails(error);

    expect(classifyGoogleAuthError(details)).toBe(kind);
    expect(getGoogleAuthErrorMessage(details)).toBe(message);
  });

  it('does not expose an unknown provider message', () => {
    const details = getAuthErrorDetails({
      errors: [{ message: 'provider request failed' }],
    });

    expect(getGoogleAuthErrorMessage(details)).toBe(
      'Não foi possível entrar com o Google. Tente novamente.',
    );
  });

  it('does not classify a network rejection as a rate limit', () => {
    const details = getAuthErrorDetails(new TypeError('Network request failed'));

    expect(isRateLimitError(details)).toBe(false);
    expect(getGoogleRetryAt(details, 100_000)).toBeNull();
  });
});


describe('Google sign-in cooldown', () => {
  const retryAt = 100_000;

  it('counts down from the full cooldown and expires at zero', () => {
    expect(getGoogleCooldownSeconds(retryAt, retryAt - 30_000)).toBe(30);
    expect(getGoogleCooldownSeconds(retryAt, retryAt - 1_000)).toBe(1);
    expect(getGoogleCooldownSeconds(retryAt, retryAt)).toBe(0);
    expect(getGoogleCooldownSeconds(retryAt, retryAt + 1)).toBe(0);
  });

  it('has no cooldown when no retry time is set', () => {
    expect(getGoogleCooldownSeconds(null, retryAt)).toBe(0);
  });

  it('keeps the button disabled and shows the remaining time', () => {
    const seconds = getGoogleCooldownSeconds(retryAt, retryAt - 12_000);

    expect(isGoogleButtonDisabled(false, seconds)).toBe(true);
    expect(getGoogleButtonLabel(seconds)).toBe('Tente novamente em 12s');
  });

  it('re-enables the button after the cooldown expires', () => {
    const seconds = getGoogleCooldownSeconds(retryAt, retryAt);

    expect(isGoogleButtonDisabled(false, seconds)).toBe(false);
    expect(getGoogleButtonLabel(seconds)).toBe('Continuar com Google');
  });

  it('re-enables the button after a network rejection without starting cooldown', async () => {
    const now = 100_000;
    let googleLoading = false;
    let googleRetryAt: number | null = null;

    googleLoading = true;
    try {
      await Promise.reject(new TypeError('Network request failed'));
    } catch (error) {
      const details = getAuthErrorDetails(error);
      const retryAt = getGoogleRetryAt(details, now);
      if (retryAt !== null) googleRetryAt = retryAt;
    } finally {
      googleLoading = false;
    }

    const seconds = getGoogleCooldownSeconds(googleRetryAt, now);
    expect(googleRetryAt).toBeNull();
    expect(seconds).toBe(0);
    expect(isGoogleButtonDisabled(googleLoading, seconds)).toBe(false);
  });

  it('re-enables the button after cancelling the browser without starting cooldown', async () => {
    const now = 100_000;
    let googleLoading = false;
    let googleRetryAt: number | null = null;

    googleLoading = true;
    try {
      await Promise.reject({ code: 'oauth_cancelled', message: 'user cancelled the flow' });
    } catch (error) {
      const details = getAuthErrorDetails(error);
      const retryAt = getGoogleRetryAt(details, now);

      expect(getGoogleAuthErrorMessage(details)).toBe(
        'Login com Google cancelado. Você pode tentar novamente quando quiser.',
      );
      if (retryAt !== null) googleRetryAt = retryAt;
    } finally {
      googleLoading = false;
    }

    const seconds = getGoogleCooldownSeconds(googleRetryAt, now);
    expect(googleRetryAt).toBeNull();
    expect(seconds).toBe(0);
    expect(isGoogleButtonDisabled(googleLoading, seconds)).toBe(false);
    expect(getGoogleButtonLabel(seconds)).toBe('Continuar com Google');
  });
});