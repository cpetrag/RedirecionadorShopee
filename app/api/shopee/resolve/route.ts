import { enrichWithProductName, isShopeeApiConfigured } from '@/lib/shopee-api';
import { resolveShopeeAffiliateUrl } from '@/lib/shopee-url';
import { isAdminAuthorized, isAllowedShopeeUrl } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return Response.json({ error: 'Não autorizado' }, { status: 401 });
}

/**
 * POST /api/shopee/resolve
 * Desencurta URL de afiliado e extrai subIds do utm_content + metadados.
 * Não altera a URL original — só leitura para preencher o cadastro.
 */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized();

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return Response.json({ error: 'url é obrigatório' }, { status: 400 });
  }

  if (!isAllowedShopeeUrl(url)) {
    return Response.json(
      { error: 'URL não permitida. Apenas domínios Shopee configurados.' },
      { status: 400 }
    );
  }

  try {
    let meta = await resolveShopeeAffiliateUrl(url);
    meta = await enrichWithProductName(meta);

    return Response.json({
      ...meta,
      api_configured: isShopeeApiConfigured(),
    });
  } catch (err) {
    console.error('[shopee/resolve]', err);
    return Response.json(
      { error: 'Não foi possível resolver a URL. Tente novamente.' },
      { status: 502 }
    );
  }
}
