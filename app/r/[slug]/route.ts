import { getLinkBySlug, recordAggregatedClickAsync } from '@/lib/db';
import { detect } from '@/lib/detect';
import { buildIntent } from '@/lib/intent';
import { htmlAndroid, htmlIOS } from '@/lib/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Redirect 302 com Cache-Control: no-store (Response.redirect não aceita headers). */
function redirect302(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      ...NO_STORE,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const link = getLinkBySlug(slug);

  if (!link) {
    return new Response('Link não encontrado', {
      status: 404,
      headers: NO_STORE,
    });
  }

  const ua = request.headers.get('user-agent') ?? '';
  const info = detect(ua);

  // shopee_url byte a byte igual ao cadastrado — nunca alterar
  const shopeeUrl = link.shopee_url;

  recordAggregatedClickAsync({
    link_id: link.id,
    platform: info.platform,
    in_app: info.inApp,
    is_bot: info.isBot,
  });

  if (info.isBot) {
    return redirect302(shopeeUrl);
  }

  if (info.inApp && info.isAndroid) {
    const intentUrl = buildIntent(shopeeUrl);
    return new Response(htmlAndroid(intentUrl, shopeeUrl), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...NO_STORE,
      },
    });
  }

  if (info.inApp && info.isIOS) {
    return new Response(htmlIOS(shopeeUrl), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...NO_STORE,
      },
    });
  }

  if (info.inApp) {
    return new Response(htmlIOS(shopeeUrl), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...NO_STORE,
      },
    });
  }

  return redirect302(shopeeUrl);
}
