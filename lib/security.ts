/**
 * Retorna a lista de hosts permitidos para URLs de destino.
 * Evita open-redirect: só aceitamos domínios Shopee configurados.
 */
export function getAllowedHosts(): string[] {
  const raw = process.env.ALLOWED_HOSTS ?? 'shopee.com.br,s.shopee.com.br';
  return raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/**
 * Valida se a URL é https e pertence a um host da allowlist.
 */
export function isAllowedShopeeUrl(url: string): boolean {
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

/**
 * Verifica o token de admin nas rotas de gestão.
 */
export function isAdminAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  return request.headers.get('x-admin-token') === token;
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
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    slug += BASE62[bytes[i] % BASE62.length];
  }
  return slug;
}

/** Monta a URL pública do redirect a partir do slug. */
export function buildRedirectUrl(slug: string): string {
  const base = process.env.BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:5222';
  return `${base}/r/${slug}`;
}
