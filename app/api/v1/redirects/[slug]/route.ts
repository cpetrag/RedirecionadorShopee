import { findLinkBySlug, getClickStats } from '@/lib/db';
import {
  buildRedirectUrl,
  isRedirectApiAuthorized,
} from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET /api/v1/redirects/:slug
 *
 * Retorna dados do link e estatísticas de cliques.
 * Auth: Authorization: Bearer <REDIRECT_API_KEY>
 */
export async function GET(request: Request, context: RouteContext) {
  if (!isRedirectApiAuthorized(request)) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { slug } = await context.params;
  if (!slug || !/^[a-zA-Z0-9_-]{3,64}$/.test(slug)) {
    return Response.json({ error: 'slug inválido' }, { status: 400 });
  }

  const link = findLinkBySlug(slug);
  if (!link) {
    return Response.json({ error: 'Link não encontrado' }, { status: 404 });
  }

  return Response.json({
    slug: link.slug,
    redirect_url: buildRedirectUrl(link.slug),
    title: link.title,
    destination_url: link.shopee_url,
    active: link.active === 1,
    created_at: link.created_at,
    clicks: getClickStats(link.id),
  });
}
