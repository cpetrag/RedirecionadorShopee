import {
  getAllLinks,
  getClickStats,
  getClicksByDay,
  getClicksByHour,
  getGlobalStats,
  getPlatformBreakdown,
} from '@/lib/db';
import { buildRedirectUrl, isAdminAuthorized } from '@/lib/security';
import { deserializeSubIds } from '@/lib/shopee-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return Response.json({ error: 'Não autorizado' }, { status: 401 });
}

/** GET /api/reports — relatório agregado de cliques */
export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const days = Math.min(
    Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 1),
    365
  );
  const linkIdParam = searchParams.get('link_id');
  const linkId = linkIdParam ? parseInt(linkIdParam, 10) : undefined;

  const summary = linkId ? getClickStats(linkId) : getGlobalStats();
  const byDay = getClicksByDay(days, linkId);
  const byHour = getClicksByHour(days, linkId);
  const byPlatform = getPlatformBreakdown(days, linkId);

  const links = getAllLinks().map((link) => ({
    id: link.id,
    slug: link.slug,
    title: link.title,
    sub_id: link.sub_id,
    sub_ids: deserializeSubIds(link.sub_ids),
    shopee_url: link.shopee_url,
    active: link.active,
    redirect_url: buildRedirectUrl(link.slug),
    clicks: getClickStats(link.id),
  }));

  return Response.json({
    days,
    link_id: linkId ?? null,
    summary,
    by_day: byDay,
    by_hour: byHour,
    by_platform_period: byPlatform,
    links,
  });
}
