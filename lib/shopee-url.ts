/** Sub_id com slot (1–5) conforme utm_content da Shopee */
export type ParsedSubId = {
  slot: number;
  value: string;
};

export type ResolvedShopeeMeta = {
  /** URL final após seguir redirects (só leitura — não usada no redirect) */
  resolved_url: string;
  sub_ids: ParsedSubId[];
  shop_id: string | null;
  item_id: string | null;
  shop_slug: string | null;
  product_name: string | null;
  utm_campaign: string | null;
  utm_source: string | null;
};

/**
 * Shopee codifica até 5 subIds em utm_content separados por "-".
 * Ex: teste01-teste02-teste03-- → slots 1–3 preenchidos, 4–5 vazios.
 */
export function parseSubIdsFromUtmContent(utmContent: string): ParsedSubId[] {
  if (!utmContent) return [];

  const parts = utmContent.split('-');
  while (parts.length < 5) parts.push('');

  const result: ParsedSubId[] = [];
  for (let i = 0; i < 5; i++) {
    const value = (parts[i] ?? '').trim();
    if (value) result.push({ slot: i + 1, value });
  }
  return result;
}

/** Extrai shopId e itemId de URLs expandidas da Shopee BR */
export function parseProductIds(url: string): {
  shop_id: string | null;
  item_id: string | null;
  shop_slug: string | null;
} {
  try {
    const { pathname } = new URL(url);

    // /loja/1512108548/23698384152
    const pathMatch = pathname.match(/\/([^/]+)\/(\d+)\/(\d+)\/?$/);
    if (pathMatch) {
      return {
        shop_slug: pathMatch[1],
        shop_id: pathMatch[2],
        item_id: pathMatch[3],
      };
    }

    // /produto-i.123.456 ou ...-i.123.456
    const legacyMatch = pathname.match(/[.-]i\.(\d+)\.(\d+)/);
    if (legacyMatch) {
      return { shop_slug: null, shop_id: legacyMatch[1], item_id: legacyMatch[2] };
    }
  } catch {
    /* URL inválida */
  }

  return { shop_id: null, item_id: null, shop_slug: null };
}

/** Segue redirects HTTP até a URL final (max 10 saltos) */
export async function followRedirects(url: string): Promise<string> {
  let current = url;
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0',
    Accept: 'text/html,application/xhtml+xml',
  };

  for (let i = 0; i < 10; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      current = new URL(location, current).href;
      continue;
    }

    break;
  }

  return current;
}

/** Busca HTML da página (links curtos da Shopee retornam 200 com JS redirect) */
async function fetchPageHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });
  return res.text();
}

/**
 * Extrai utm_content e URL expandida embutidos no HTML da Shopee.
 * Links s.shopee.com.br expõem subIds no HTML e a URL real em CONFIG.httpUrl.
 */
function decodeShopeeEscaped(value: string): string {
  return value
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=');
}

function parseEmbeddedAffiliateData(html: string): {
  utm_content: string | null;
  expanded_url: string | null;
  product_name: string | null;
} {
  // URL completa do produto: var CONFIG={httpUrl:"https:\/\/shopee.com.br\/loja\/123\/456?..."}
  const configMatch = html.match(/CONFIG=\{httpUrl:"([^"]+)"/);
  let expanded_url: string | null = null;
  if (configMatch?.[1]) {
    expanded_url = decodeShopeeEscaped(configMatch[1]);
  }

  if (!expanded_url) {
    const urlMatch = html.match(/https:\\\\\/\\\\\/shopee\.com\.br\\\\\/[^"\\]+/);
    if (urlMatch) {
      expanded_url = decodeShopeeEscaped(urlMatch[0]);
    }
  }

  // utm_content pode estar no HTML ou na URL expandida
  let utm_content: string | null = null;
  const utmInHtml = html.match(/utm_content=([^&"'\\]+)/);
  if (utmInHtml?.[1]) {
    utm_content = decodeURIComponent(utmInHtml[1].replace(/\+/g, ' '));
  } else if (expanded_url) {
    try {
      utm_content = new URL(expanded_url).searchParams.get('utm_content');
    } catch {
      /* ignore */
    }
  }

  const ogTitle = html.match(/property="og:title" content="([^"]+)"/)?.[1];
  const product_name =
    ogTitle && !ogTitle.includes('Shopee Brasil | Ofertas')
      ? ogTitle
      : null;

  return { utm_content, expanded_url, product_name };
}

/** Resolve link curto ou longo e extrai metadados de afiliado */
export async function resolveShopeeAffiliateUrl(
  inputUrl: string
): Promise<ResolvedShopeeMeta> {
  let resolved_url = await followRedirects(inputUrl);
  let parsed = new URL(resolved_url);

  let utmContent = parsed.searchParams.get('utm_content');
  let product_name: string | null = null;

  // Link curto: buscar utm_content no HTML
  if (!utmContent || resolved_url.includes('s.shopee.com.br')) {
    const html = await fetchPageHtml(inputUrl);
    const embedded = parseEmbeddedAffiliateData(html);

    if (embedded.utm_content) utmContent = embedded.utm_content;
    if (embedded.expanded_url) {
      resolved_url = embedded.expanded_url;
      parsed = new URL(resolved_url);
      if (!utmContent) utmContent = parsed.searchParams.get('utm_content');
    }
    if (embedded.product_name) product_name = embedded.product_name;
  }

  const sub_ids = parseSubIdsFromUtmContent(utmContent ?? '');
  const ids = parseProductIds(resolved_url);

  return {
    resolved_url,
    sub_ids,
    shop_id: ids.shop_id,
    item_id: ids.item_id,
    shop_slug: ids.shop_slug,
    product_name,
    utm_campaign: parsed.searchParams.get('utm_campaign'),
    utm_source: parsed.searchParams.get('utm_source'),
  };
}

/** Formata sub_ids para exibição: "01: teste01 · 02: teste02" */
export function formatSubIds(subIds: ParsedSubId[]): string {
  return subIds.map((s) => `${String(s.slot).padStart(2, '0')}: ${s.value}`).join(' · ');
}

/** Serializa sub_ids para o banco (JSON) */
export function serializeSubIds(subIds: ParsedSubId[]): string | null {
  if (subIds.length === 0) return null;
  return JSON.stringify(subIds);
}

/** Desserializa sub_ids do banco */
export function deserializeSubIds(raw: string | null): ParsedSubId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ParsedSubId[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Normaliza URL para comparar duplicatas (trim, host minúsculo, sem barra final). */
export function normalizeShopeeUrlForCompare(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}
