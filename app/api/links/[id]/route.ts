import { setLinkActive } from '@/lib/db';
import { buildRedirectUrl, isAdminAuthorized } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return Response.json({ error: 'Não autorizado' }, { status: 401 });
}

/** PATCH /api/links/[id] — ativa/desativa link */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(request)) return unauthorized();

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  let body: { active?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (typeof body.active !== 'boolean') {
    return Response.json({ error: 'active (boolean) é obrigatório' }, { status: 400 });
  }

  const link = setLinkActive(id, body.active);
  if (!link) {
    return Response.json({ error: 'Link não encontrado' }, { status: 404 });
  }

  return Response.json({
    ...link,
    redirect_url: buildRedirectUrl(link.slug),
  });
}
