import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Hosts usados para detectar URL Shopee (auto-fill de título/subIds).
 * Não limita mais o destino do redirect — ver isAllowedDestinationUrl.
 */
export function getAllowedHosts(): string[] {
  const raw = process.env.ALLOWED_HOSTS ?? 'shopee.com.br,s.shopee.com.br';
  return raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/** True se o host for Shopee (allowlist ALLOWED_HOSTS). */
export function isShopeeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return getAllowedHosts().some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

/** @deprecated Use isShopeeUrl — mantido para compatibilidade. */
export function isAllowedShopeeUrl(url: string): boolean {
  return isShopeeUrl(url);
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    return true;
  }
  if (host.includes(':')) {
    // IPv6 literais comuns de loopback/ULA
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return true;
    }
  }
  return isPrivateIpv4(host);
}

/**
 * Valida URL de destino genérica (landings, lojas, etc.).
 * https apenas; bloqueia localhost e IPs privados (anti open-redirect).
 */
export function isAllowedDestinationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname) return false;
    if (isPrivateOrLocalHostname(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica o token de admin nas rotas de gestão.
 */
export function isAdminAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  return request.headers.get('x-admin-token') === token;
}

/**
 * Autenticação da API pública v1: Authorization: Bearer <REDIRECT_API_KEY>
 */
export function isRedirectApiAuthorized(request: Request): boolean {
  const expected = process.env.REDIRECT_API_KEY;
  if (!expected) return false;

  const header = request.headers.get('authorization');
  if (!header) return false;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;

  const provided = match[1].trim();
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Anonimiza o IP zerando o último octeto (IPv4) ou truncando (IPv6).
 */
export function anonymizeIp(ip: string | null): string | null {
  if (!ip) return null;

  // Remove prefixo IPv4-mapped
  const cleaned = ip.replace(/^::ffff:/, '');

  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
  }

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    return parts.slice(0, 4).join(':') + '::';
  }

  return null;
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Gera slug aleatório de 8 caracteres base62. */
export function generateSlug(length = 8): string {
  let slug = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    slug += BASE62[bytes[i]! % BASE62.length];
  }
  return slug;
}

/** Monta a URL pública do redirect a partir do slug. */
export function buildRedirectUrl(slug: string): string {
  const base =
    process.env.BASE_URL?.replace(/\/$/, '') ??
    'https://redirect.clubepromos.com.br';
  return `${base}/r/${slug}`;
}
