import {
  createLink,
  getLinkByShopeeUrl,
  slugExists,
  type Link,
} from '@/lib/db';
import { enrichWithProductName } from '@/lib/shopee-api';
import {
  formatSubIds,
  resolveShopeeAffiliateUrl,
  serializeSubIds,
  type ParsedSubId,
} from '@/lib/shopee-url';
import {
  generateSlug,
  isAllowedDestinationUrl,
  isShopeeUrl,
} from '@/lib/security';

export type CreateRedirectInput = {
  url: string;
  title?: string | null;
  slug?: string | null;
  sub_id?: string | null;
  sub_ids?: ParsedSubId[] | null;
};

export type CreateRedirectSuccess = {
  ok: true;
  link: Link;
  existing: boolean;
};

export type CreateRedirectFailure = {
  ok: false;
  error: string;
  status: number;
};

export type CreateRedirectResult = CreateRedirectSuccess | CreateRedirectFailure;

function titleFromHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Link';
  }
}

/**
 * Cria (ou reutiliza) um redirect. Mesma lógica para admin e API v1.
 * title é opcional: cliente → auto-fill Shopee → hostname.
 */
export async function createRedirect(
  input: CreateRedirectInput
): Promise<CreateRedirectResult> {
  const rawUrl = typeof input.url === 'string' ? input.url.trim() : '';
  if (!rawUrl) {
    return { ok: false, error: 'url é obrigatório', status: 400 };
  }

  if (!isAllowedDestinationUrl(rawUrl)) {
    return {
      ok: false,
      error:
        'URL não permitida. Use https:// e um host público (não localhost/IP privado).',
      status: 400,
    };
  }

  const existingLink = getLinkByShopeeUrl(rawUrl);
  if (existingLink) {
    return { ok: true, link: existingLink, existing: true };
  }

  let title = input.title?.trim() || null;
  let sub_id = input.sub_id?.trim() || null;
  let sub_ids_json: string | null = null;

  if (Array.isArray(input.sub_ids) && input.sub_ids.length > 0) {
    const valid = input.sub_ids.filter(
      (s) => s && typeof s.slot === 'number' && typeof s.value === 'string'
    );
    if (valid.length > 0) {
      sub_ids_json = serializeSubIds(valid);
      if (!sub_id) sub_id = formatSubIds(valid);
    }
  }

  if (isShopeeUrl(rawUrl) && (!sub_ids_json || !title)) {
    try {
      let meta = await resolveShopeeAffiliateUrl(rawUrl);
      meta = await enrichWithProductName(meta);

      if (!sub_ids_json && meta.sub_ids.length > 0) {
        sub_ids_json = serializeSubIds(meta.sub_ids);
        if (!sub_id) sub_id = formatSubIds(meta.sub_ids);
      }
      if (!title && meta.product_name) {
        title = meta.product_name;
      }
    } catch (err) {
      console.error('[create-redirect] auto-resolve Shopee falhou:', err);
    }
  }

  if (!title) {
    title = titleFromHostname(rawUrl);
  }

  let slug = input.slug?.trim() || '';
  if (slug) {
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(slug)) {
      return {
        ok: false,
        error: 'slug inválido (3-64 chars, alfanumérico/_/-)',
        status: 400,
      };
    }
    if (slugExists(slug)) {
      return { ok: false, error: 'slug já existe', status: 409 };
    }
  } else {
    let attempts = 0;
    do {
      slug = generateSlug();
      attempts++;
    } while (slugExists(slug) && attempts < 10);

    if (slugExists(slug)) {
      return {
        ok: false,
        error: 'Não foi possível gerar slug único',
        status: 500,
      };
    }
  }

  const link = createLink({
    slug,
    shopee_url: rawUrl,
    sub_id,
    sub_ids: sub_ids_json,
    title,
  });

  return { ok: true, link, existing: false };
}
