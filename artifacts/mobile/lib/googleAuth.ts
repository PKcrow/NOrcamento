export const GOOGLE_RATE_LIMIT_COOLDOWN_MS = 30_000;

export type AuthErrorDetails = {
  status?: number;
  code?: string;
  message?: string;
};

export type GoogleAuthErrorKind =
  | 'rate_limit'
  | 'redirect'
  | 'cancelled'
  | 'credentials'
  | 'unknown';

const GOOGLE_ERROR_MESSAGES: Record<
  Exclude<GoogleAuthErrorKind, 'rate_limit'>,
  string
> = {
  redirect:
    'Não foi possível concluir o retorno do Google. Verifique o app e tente novamente.',
  cancelled: 'Login com Google cancelado. Você pode tentar novamente quando quiser.',
  credentials:
    'Não foi possível entrar com o Google. Verifique suas credenciais e tente novamente.',
  unknown: 'Não foi possível entrar com o Google. Tente novamente.',
};

export function getAuthErrorDetails(error: unknown): AuthErrorDetails {
  if (!error || typeof error !== 'object') return {};

  const record = error as Record<string, unknown>;
  const rawErrors = Array.isArray(record.errors) ? record.errors : [];
  const firstError =
    rawErrors[0] && typeof rawErrors[0] === 'object'
      ? (rawErrors[0] as Record<string, unknown>)
      : undefined;
  const rawStatus = record.status ?? record.statusCode;
  const rawCode =
    firstError?.code ??
    record.code ??
    record.type ??
    record.errorCode;
  const rawMessage =
    firstError?.longMessage ??
    firstError?.message ??
    record.longMessage ??
    record.message ??
    record.error_description ??
    record.name;

  return {
    status: typeof rawStatus === 'number' ? rawStatus : undefined,
    code: typeof rawCode === 'string' ? rawCode : undefined,
    message: typeof rawMessage === 'string' ? rawMessage : undefined,
  };
}

export function isRateLimitError(details: AuthErrorDetails): boolean {
  return (
    details.status === 429 ||
    details.code === 'too_many_requests' ||
    /too[_ -]?many[_ -]?requests|rate[_ -]?limit|\b429\b/i.test(
      `${details.code ?? ''} ${details.message ?? ''}`,
    )
  );
}

export function getGoogleRetryAt(
  details: AuthErrorDetails,
  now: number,
): number | null {
  return isRateLimitError(details) ? now + GOOGLE_RATE_LIMIT_COOLDOWN_MS : null;
}

export function classifyGoogleAuthError(
  details: AuthErrorDetails,
): GoogleAuthErrorKind {
  if (isRateLimitError(details)) return 'rate_limit';

  const errorText = `${details.code ?? ''} ${details.message ?? ''}`;
  if (/cancel|abort|dismiss/i.test(errorText)) return 'cancelled';
  if (
    /redirect|callback|deep[- ]?link|uri_mismatch|return to the app/i.test(
      errorText,
    )
  ) {
    return 'redirect';
  }
  if (
    /credential|password|identifier|account|invalid_grant|unauthorized/i.test(
      errorText,
    )
  ) {
    return 'credentials';
  }
  return 'unknown';
}

export function getGoogleAuthErrorMessage(details: AuthErrorDetails): string {
  const kind = classifyGoogleAuthError(details);
  return kind === 'rate_limit'
    ? 'O login com Google foi temporariamente limitado. Aguarde alguns segundos antes de tentar novamente.'
    : GOOGLE_ERROR_MESSAGES[kind];
}

export function getGoogleCooldownSeconds(
  retryAt: number | null,
  now: number,
): number {
  if (retryAt === null) return 0;
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}

export function isGoogleButtonDisabled(
  googleLoading: boolean,
  cooldownSeconds: number,
): boolean {
  return googleLoading || cooldownSeconds > 0;
}

export function getGoogleButtonLabel(cooldownSeconds: number): string {
  return cooldownSeconds > 0
    ? `Tente novamente em ${cooldownSeconds}s`
    : 'Continuar com Google';
}