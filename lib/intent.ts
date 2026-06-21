/**
 * Monta um intent:// para escapar do webview do Instagram e abrir no Chrome.
 * A URL de destino NÃO é alterada — apenas reempacotada no formato intent.
 */
export function buildIntent(httpsUrl: string): string {
  const u = new URL(httpsUrl);
  const hostPath = u.host + u.pathname + u.search;
  const fallback = encodeURIComponent(httpsUrl);
  return `intent://${hostPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}
