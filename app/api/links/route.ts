import { createRedirect } from '@/lib/create-redirect';
import {
  getAllLinks,
  getClickStats,
} from '@/lib/db';
import { deserializeSubIds, type ParsedSubId } from '@/lib/shopee-url';
import {
  buildRedirectUrl,
  isAdminAuthorized,
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

/** POST /api/links — cadastra um novo link (qualquer destino https) */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized();

  let body: {
    url?: string;
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

  const url = (body.url ?? body.shopee_url)?.trim();
  if (!url) {
    return Response.json(
      { error: 'url (ou shopee_url) é obrigatório' },
      { status: 400 }
    );
  }

  const result = await createRedirect({
    url,
    title: body.title,
    slug: body.slug,
    sub_id: body.sub_id,
    sub_ids: body.sub_ids,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const mapped = mapLink(result.link);
  if (result.existing) {
    return Response.json({ ...mapped, existing: true });
  }

  return Response.json(mapped, { status: 201 });
}
