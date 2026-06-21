/**
 * Página intermediária para Instagram Android.
 * Dispara intent:// no cliente para abrir o Chrome com a URL intacta.
 */
export function htmlAndroid(intentUrl: string, fallbackUrl: string): string {
  const escapedIntent = escapeHtml(intentUrl);
  const escapedFallback = escapeHtml(fallbackUrl);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Abrindo na Shopee…</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ee4d2d;
      color: #fff;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 12px; }
    p { font-size: 0.9rem; opacity: 0.9; line-height: 1.5; max-width: 320px; }
    .btn {
      display: inline-block;
      margin-top: 28px;
      padding: 14px 32px;
      background: #fff;
      color: #ee4d2d;
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
    }
    .hint { margin-top: 20px; font-size: 0.85rem; opacity: 0.85; }
  </style>
</head>
<body>
  <div class="spinner" aria-hidden="true"></div>
  <h1>Abrindo na Shopee…</h1>
  <p>Aguarde enquanto redirecionamos você.</p>
  <a class="btn" href="${escapedIntent}">Abrir na Shopee</a>
  <p class="hint">Toque em <strong>CONTINUAR</strong> se aparecer um aviso.</p>
  <script>
    (function () {
      var intent = ${JSON.stringify(intentUrl)};
      var fallback = ${JSON.stringify(fallbackUrl)};
      try {
        window.location.replace(intent);
      } catch (e) {
        window.location.replace(fallback);
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * Página intermediária para Instagram iOS.
 * Não há intent:// no iOS — instruímos o usuário a abrir no Safari.
 */
export function htmlIOS(shopeeUrl: string): string {
  const escapedUrl = escapeHtml(shopeeUrl);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Continuar para Shopee</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #ee4d2d;
      color: #fff;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 12px; }
    p { font-size: 0.9rem; opacity: 0.9; line-height: 1.5; max-width: 340px; }
    .btn {
      display: inline-block;
      margin-top: 28px;
      padding: 16px 36px;
      background: #fff;
      color: #ee4d2d;
      font-size: 1.1rem;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
    }
    .hint { margin-top: 24px; font-size: 0.85rem; opacity: 0.85; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>Continuar para Shopee</h1>
  <p>Toque no botão abaixo para seguir ao produto.</p>
  <a class="btn" href="${escapedUrl}">Continuar pra Shopee</a>
  <p class="hint">
    Para abrir direto no app: toque em <strong>⋮ / Aa</strong> no topo
    e escolha <strong>Abrir no navegador</strong>.
  </p>
  <!-- x-safari-https:// é instável no iOS; não confiar -->
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
