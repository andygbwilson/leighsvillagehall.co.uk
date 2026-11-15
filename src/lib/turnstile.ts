const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare dummy keys: the widget always passes. Use only in local development. */
export const DEV_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
export const DEV_TURNSTILE_SECRET = '1x0000000000000000000000000000000AA';

export async function verifyTurnstile(options: {
  token: string;
  secret: string;
  ip?: string | null;
}): Promise<string | null> {
  if (!options.secret) return null;
  if (!options.token.trim()) return 'Please complete the check before continuing.';
  const body = new URLSearchParams();
  body.set('secret', options.secret);
  body.set('response', options.token);
  if (options.ip) body.set('remoteip', options.ip);
  try {
    const response = await fetch(SITEVERIFY, { method: 'POST', body });
    const result = (await response.json()) as { success?: boolean };
    if (!result.success) return 'Please complete the check before continuing.';
  } catch {
    return 'The spam check could not be completed. Please try again.';
  }
  return null;
}

export function turnstileTokenFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const data = body as Record<string, unknown>;
  const token = data.turnstileToken ?? data['cf-turnstile-response'];
  return typeof token === 'string' ? token.trim() : '';
}

export function clientIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}
