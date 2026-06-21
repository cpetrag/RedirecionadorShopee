import crypto from 'crypto';
import type { ResolvedShopeeMeta } from '@/lib/shopee-url';

const ENDPOINT =
  process.env.SHOPEE_AFFILIATE_ENDPOINT ??
  'https://open-api.affiliate.shopee.com.br/graphql';

function getCredentials(): { appId: string; secret: string } | null {
  const appId = process.env.SHOPEE_AFFILIATE_APP_ID;
  const secret = process.env.SHOPEE_AFFILIATE_SECRET;
  if (!appId || !secret) return null;
  return { appId, secret };
}

function buildAuthHeader(appId: string, secret: string, payload: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash('sha256')
    .update(`${appId}${timestamp}${payload}${secret}`)
    .digest('hex');
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

async function graphql<T>(query: string): Promise<T | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const payload = JSON.stringify({ query });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthHeader(creds.appId, creds.secret, payload),
    },
    body: payload,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) return null;

  const json = (await res.json()) as { data?: T; errors?: { message?: string }[] };
  if (json.errors?.length) {
    console.error('[shopee-api]', json.errors);
    return null;
  }
  return json.data ?? null;
}

/** Busca productName via productOfferV2 quando App ID + Secret estão configurados */
export async function fetchProductName(
  itemId: string,
  shopId?: string | null
): Promise<string | null> {
  const shopFilter = shopId ? `shopId: ${shopId}, ` : '';
  const query = `{
    productOfferV2(${shopFilter}itemId: ${itemId}, limit: 1) {
      nodes { productName }
    }
  }`;

  const data = await graphql<{
    productOfferV2?: { nodes?: { productName?: string }[] };
  }>(query);

  return data?.productOfferV2?.nodes?.[0]?.productName ?? null;
}

/** Enriquece metadados resolvidos com nome do produto (se API configurada) */
export async function enrichWithProductName(
  meta: ResolvedShopeeMeta
): Promise<ResolvedShopeeMeta> {
  if (!meta.item_id || meta.product_name) return meta;

  const product_name = await fetchProductName(meta.item_id, meta.shop_id);
  return { ...meta, product_name };
}

export function isShopeeApiConfigured(): boolean {
  return getCredentials() !== null;
}
