# Redirect Shopee

Redirecionador de links de afiliado Shopee para uso em Stories e bio do Instagram. Detecta o webview in-app da Meta e, no Android, escapa para o Chrome via `intent://` — sem alterar a URL de destino.

## Requisitos

- Node.js 20+
- npm

## Instalação local

```bash
npm install
cp .env.example .env.local
# Edite .env.local com seu ADMIN_TOKEN e BASE_URL
npm run dev
```

O serviço sobe em `http://localhost:5222`.

## Variáveis de ambiente

| Variável        | Obrigatória | Descrição                                              |
|-----------------|-------------|--------------------------------------------------------|
| `ADMIN_TOKEN`   | Sim         | Token para proteger `POST/GET /api/links`              |
| `BASE_URL`      | Sim         | URL pública (ex: `https://links.seudominio.com`)       |
| `ALLOWED_HOSTS` | Não         | Hosts Shopee permitidos (padrão: `shopee.com.br,s.shopee.com.br`) |
| `DB_PATH`       | Não         | Caminho do SQLite (padrão: `./data/redirect.db`)       |

## Cadastrar um link

```bash
curl -X POST http://localhost:5222/api/links \
  -H "Content-Type: application/json" \
  -H "x-admin-token: SEU_ADMIN_TOKEN" \
  -d '{
    "shopee_url": "https://s.shopee.com.br/SEU_LINK_AFILIADO",
    "sub_id": "story-junho",
    "title": "Produto X"
  }'
```

Resposta:

```json
{
  "id": 1,
  "slug": "aB3xK9mQ",
  "shopee_url": "https://s.shopee.com.br/SEU_LINK_AFILIADO",
  "redirect_url": "https://links.seudominio.com/r/aB3xK9mQ",
  ...
}
```

Use o `redirect_url` na Story/bio do Instagram.

## Painel admin (interface visual)

Acesse **`/admin`** no navegador. Na primeira visita, informe o `ADMIN_TOKEN` do servidor.

| Página | URL | Função |
|--------|-----|--------|
| Links | `/admin` | Cadastrar links, copiar URL, ativar/desativar |
| Relatórios | `/admin/relatorios` | Cliques por dia, plataforma, in-app, histórico |

O token fica na sessão do navegador até clicar em **Sair**.

## Listar links e métricas

```bash
curl http://localhost:5222/api/links \
  -H "x-admin-token: SEU_ADMIN_TOKEN"
```

Retorna cada link com `shopee_url` intacto e contagem de cliques reais (bots excluídos), agrupados por plataforma.

## Deploy com PM2

```bash
npm run build

# ecosystem.config.js (crie na raiz do projeto):
# module.exports = {
#   apps: [{
#     name: 'redirect-shopee',
#     script: 'node_modules/next/dist/bin/next',
#     args: 'start -p 5222',
#     env: { NODE_ENV: 'production' }
#   }]
# };

pm2 start ecosystem.config.js
pm2 save
```

Exponha via Cloudflare Tunnel ou reverse proxy apontando para a porta 5222.

## Fluxo de redirect

| Cenário              | Comportamento                                      |
|----------------------|----------------------------------------------------|
| IG Android in-app    | HTML → `intent://` → Chrome → Shopee               |
| IG iOS in-app        | HTML com botão + instrução "Abrir no navegador"    |
| Chrome/Safari/desktop| 302 direto para `shopee_url`                       |
| Bot (Meta preview)   | 302 direto; clique registrado com `is_bot=1`       |

A `shopee_url` **nunca é modificada** — trafega byte a byte igual ao cadastrado.

## Verificar integridade do Sub_id

1. Gere o link na Shopee com Sub_id único.
2. Cadastre via API (Sub_id é metadado, não injetado na URL).
3. Faça um clique real pelo fluxo completo.
4. Confira no painel de afiliado da Shopee se o clique chegou com o Sub_id correto.

## Estrutura

```
app/r/[slug]/route.ts   → núcleo do redirect
app/api/links/route.ts  → gestão de links
lib/db.ts               → SQLite (isolado para futura migração)
lib/detect.ts           → detecção de User-Agent
lib/intent.ts           → buildIntent()
lib/templates.ts        → HTML Android/iOS
lib/security.ts         → allowlist, auth, slug
```
