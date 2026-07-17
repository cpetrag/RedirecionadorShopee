# Redirect

Redirecionador de links https (landings, afiliados, lojas) para uso em Stories, bio e sistemas externos.

**Produção:** [https://redirect.clubepromos.com.br](https://redirect.clubepromos.com.br)

No Instagram Android, escapa do webview via `intent://` — sem alterar a URL de destino.

## Requisitos

- Node.js 20+
- npm

## Instalação local

```bash
npm install
cp .env.example .env.local
# Edite .env.local: ADMIN_TOKEN, REDIRECT_API_KEY
# BASE_URL local: http://localhost:5222
npm run dev
```

Local: `http://localhost:5222`  
Produção: `https://redirect.clubepromos.com.br`

## Variáveis de ambiente

| Variável           | Obrigatória | Descrição |
|--------------------|-------------|-----------|
| `ADMIN_TOKEN`      | Sim         | Token do painel e `POST/GET /api/links` |
| `REDIRECT_API_KEY` | Sim*        | Bearer token de `POST/GET /api/v1/redirects` |
| `BASE_URL`         | Sim         | Em produção: `https://redirect.clubepromos.com.br` |
| `ALLOWED_HOSTS`    | Não         | Hosts Shopee para **auto-fill** (não limita destino) |
| `DB_PATH`          | Não         | SQLite (padrão: `./data/redirect.db`) |

\*Obrigatória para usar a API v1. Sem ela, as rotas `/api/v1/*` respondem `401`.

## Como criar a `REDIRECT_API_KEY`

Não existe tela para gerar a chave. Você cria um segredo forte e coloca no `.env` do servidor.

1. Gere uma chave (PowerShell):

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

2. No VPS, edite o `.env` / `.env.local` do app (ou as env do PM2) e adicione:

```env
REDIRECT_API_KEY=cole-a-chave-gerada
BASE_URL=https://redirect.clubepromos.com.br
```

3. Reinicie o processo (`pm2 restart redirect-shopee`).

4. Use no header das chamadas:

```
Authorization: Bearer cole-a-chave-gerada
```

Guarde a chave no sistema de landings. Não commite no git.

## API v1 (landings / automações)

Base: `https://redirect.clubepromos.com.br`

Auth em todas as rotas:

```
Authorization: Bearer SEU_REDIRECT_API_KEY
```

### Criar redirect

```bash
curl -X POST https://redirect.clubepromos.com.br/api/v1/redirects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_REDIRECT_API_KEY" \
  -d '{
    "url": "https://landing.exemplo.com/oferta",
    "title": "Oferta Black Friday"
  }'
```

| Campo   | Obrigatório | Notas |
|---------|-------------|--------|
| `url`   | Sim         | Qualquer `https://` público (não localhost/IP privado) |
| `title` | Não         | Se vazio: Shopee tenta auto-fill; senão usa o **hostname** |
| `slug`  | Não         | Gerado automaticamente se omitido |

Resposta (`201` criado / `200` já existia):

```json
{
  "slug": "aB3xK9mQ",
  "redirect_url": "https://redirect.clubepromos.com.br/r/aB3xK9mQ",
  "title": "Oferta Black Friday",
  "destination_url": "https://landing.exemplo.com/oferta",
  "active": true,
  "existing": false,
  "clicks": { "real": 0, "total": 0, "bots": 0, "in_app": 0, "by_platform": {} }
}
```

Links criados pela API **aparecem no painel** `/admin` com as mesmas métricas de cliques.

### Consultar link e cliques

```bash
curl https://redirect.clubepromos.com.br/api/v1/redirects/aB3xK9mQ \
  -H "Authorization: Bearer SEU_REDIRECT_API_KEY"
```

## Painel admin

Acesse [https://redirect.clubepromos.com.br/admin](https://redirect.clubepromos.com.br/admin). Na primeira visita, informe o `ADMIN_TOKEN`.

| Página | URL | Função |
|--------|-----|--------|
| Links | `/admin` | Cadastrar, copiar URL, ver cliques, ativar/desativar |
| Relatórios | `/admin/relatorios` | Cliques por dia, plataforma, in-app |

## Admin API (token do painel)

```bash
curl -X POST https://redirect.clubepromos.com.br/api/links \
  -H "Content-Type: application/json" \
  -H "x-admin-token: SEU_ADMIN_TOKEN" \
  -d '{
    "url": "https://s.shopee.com.br/SEU_LINK",
    "title": "Produto X"
  }'
```

`shopee_url` ainda é aceito como alias de `url`.

## Deploy com PM2

```bash
npm run build

# ecosystem.config.js (crie na raiz do projeto):
# module.exports = {
#   apps: [{
#     name: 'redirect-shopee',
#     script: 'node_modules/next/dist/bin/next',
#     args: 'start -p 5222',
#     env: {
#       NODE_ENV: 'production',
#       BASE_URL: 'https://redirect.clubepromos.com.br'
#     }
#   }]
# };

pm2 start ecosystem.config.js
pm2 save
```

Exponha via Cloudflare Tunnel ou reverse proxy apontando para a porta 5222.

## Fluxo de redirect

| Cenário              | Comportamento                                      |
|----------------------|----------------------------------------------------|
| IG Android in-app    | HTML → `intent://` → Chrome → destino              |
| IG iOS in-app        | HTML com botão + instrução "Abrir no navegador"    |
| Chrome/Safari/desktop| 302 direto para a URL cadastrada                   |
| Bot (Meta preview)   | 302 direto; clique com `is_bot=1`                  |

A URL de destino **nunca é modificada** — trafega byte a byte igual ao cadastrado.

## Estrutura

```
app/r/[slug]/route.ts           → núcleo do redirect
app/api/v1/redirects/            → API pública (API key)
app/api/links/route.ts           → gestão admin
lib/create-redirect.ts           → criação compartilhada
lib/db.ts                        → SQLite
lib/security.ts                  → destino https, auth, slug
lib/templates.ts                 → HTML Android/iOS
```
