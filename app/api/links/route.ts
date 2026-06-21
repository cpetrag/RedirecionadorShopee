import {
  createLink,
  getAllLinks,
  getClickStats,
  getLinkByShopeeUrl,
  slugExists,
} from '@/lib/db';
import { enrichWithProductName } from '@/lib/shopee-api';
import {
  deserializeSubIds,
  formatSubIds,
  resolveShopeeAffiliateUrl,
  serializeSubIds,
  type ParsedSubId,
} from '@/lib/shopee-url';
import {
  buildRedirectUrl,
  generateSlug,
  isAdminAuthorized,
  isAllowedShopeeUrl,
} from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapLink(link: ReturnType<typeof getAllLinks>[0]) {
  return {
    ...link,
    redirect_url: buildRedirectUrl(link.slug),
    shopee_url: link.shopee_url,
    sub_ids: deserializeSubIds(link.sub_ids),
    clicks: getClickStats(link.id),
  };
}

function unauthorized() {
  return Response.json({ error: 'Não autorizado' }, { status: 401 });
}

/** GET /api/links — lista links com estatísticas de cliques */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized();

  const links = getAllLinks();
  const result = links.map(mapLink);

  return Response.json({ links: result });
}

/** POST /api/links — cadastra um novo link de afiliado */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized();

  let body: {
    shopee_url?: string;
    slug?: string;
    sub_id?: string;
    sub_ids?: ParsedSubId[];
    title?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { shopee_url } = body;
  let title = body.title?.trim() || null;
  let sub_id = body.sub_id?.trim() || null;
  let sub_ids_json: string | null = null;

  if (Array.isArray(body.sub_ids) && body.sub_ids.length > 0) {
    const valid = body.sub_ids.filter(
      (s) => s && typeof s.slot === 'number' && typeof s.value === 'string'
    );
    if (valid.length > 0) {
      sub_ids_json = serializeSubIds(valid);
      if (!sub_id) sub_id = formatSubIds(valid);
    }
  }

  if (!shopee_url || typeof shopee_url !== 'string') {
    return Response.json(
      { error: 'shopee_url é obrigatório' },
      { status: 400 }
    );
  }

  if (!isAllowedShopeeUrl(shopee_url)) {
    return Response.json(
      {
        error:
          'URL não permitida. Apenas hosts Shopee configurados em ALLOWED_HOSTS.',
      },
      { status: 400 }
    );
  }

  const trimmedUrl = shopee_url.trim();
  const existingLink = getLinkByShopeeUrl(trimmedUrl);
  if (existingLink) {
    return Response.json({
      ...mapLink(existingLink),
      existing: true,
    });
  }

  // Auto-processa URL: extrai subIds + nome do produto se não vieram no body
  if (!sub_ids_json || !title) {
    try {
      let meta = await resolveShopeeAffiliateUrl(shopee_url);
      meta = await enrichWithProductName(meta);

      if (!sub_ids_json && meta.sub_ids.length > 0) {
        sub_ids_json = serializeSubIds(meta.sub_ids);
        if (!sub_id) sub_id = formatSubIds(meta.sub_ids);
      }
      if (!title && meta.product_name) {
        title = meta.product_name;
      }
    } catch (err) {
      console.error('[links] auto-resolve falhou:', err);
    }
  }

  let slug = body.slug?.trim();
  if (slug) {
    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(slug)) {
      return Response.json(
        { error: 'slug inválido (3-64 chars, alfanumérico/_/-)' },
        { status: 400 }
      );
    }
    if (slugExists(slug)) {
      return Response.json({ error: 'slug já existe' }, { status: 409 });
    }
  } else {
    // Gera slug único
    let attempts = 0;
    do {
      slug = generateSlug();
      attempts++;
    } while (slugExists(slug) && attempts < 10);

    if (slugExists(slug!)) {
      return Response.json(
        { error: 'Não foi possível gerar slug único' },
        { status: 500 }
      );
    }
  }

  const link = createLink({
    slug: slug!,
    shopee_url: trimmedUrl,
    sub_id,
    sub_ids: sub_ids_json,
    title: title ?? null,
  });

  return Response.json(
    {
      ...mapLink(link),
    },
    { status: 201 }
  );
}
