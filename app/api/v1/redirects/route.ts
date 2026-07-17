import { createRedirect } from '@/lib/create-redirect';
import { getClickStats } from '@/lib/db';
import {
  buildRedirectUrl,
  isRedirectApiAuthorized,
} from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/redirects
 *
 * Cria um redirect para qualquer URL https (landings, lojas, etc.).
 * Auth: Authorization: Bearer <REDIRECT_API_KEY>
 *
 * Body: { url, title?, slug? }
 * - title é opcional: se omitido e for Shopee, tenta auto-fill;
 *   senão usa o hostname da URL.
 *
 * Links criados aparecem no painel /admin com cliques e status.
 */
export async function POST(request: Request) {
  if (!isRedirectApiAuthorized(request)) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: {
    url?: string;
    shopee_url?: string;
    title?: string;
    slug?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const url = (body.url ?? body.shopee_url)?.trim();
  if (!url) {
    return Response.json({ error: 'url é obrigatório' }, { status: 400 });
  }

  const result = await createRedirect({
    url,
    title: body.title,
    slug: body.slug,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const { link, existing } = result;
  const payload = {
    slug: link.slug,
    redirect_url: buildRedirectUrl(link.slug),
    title: link.title,
    destination_url: link.shopee_url,
    active: link.active === 1,
    created_at: link.created_at,
    existing,
    clicks: getClickStats(link.id),
  };

  return Response.json(payload, { status: existing ? 200 : 201 });
}
