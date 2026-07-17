# Design: Redirect genérico + API de criação

**Data:** 2026-07-17  
**Status:** Aprovado para implementação  
**Contexto:** O sistema deixava de aceitar destinos que não fossem Shopee. O uso principal passa a incluir landings e qualquer URL https, com criação via painel e via API com chave.

## Objetivo

1. Aceitar qualquer URL de destino `https://` (não restringir a lojas/Shopee).
2. Manter auto-preenchimento (título/subIds) **somente** quando a URL for Shopee.
3. Expor `POST /api/v1/redirects` autenticado por API key para sistemas de landings.
4. Neutralizar a página intermediária do redirect (sem branding Shopee).

## Fora de escopo

- Renomear coluna `shopee_url` no banco (permanece; semanticamente = URL destino).
- Scrapers / auto-fill para Mercado Livre, Amazon, etc.
- Rate limiting avançado na API pública.
- Aceitar `http://` ou destinos em localhost/IPs privados.

## Regras de validação

### URL destino

- Obrigatório.
- Protocolo: apenas `https:`.
- **Denylist:** `localhost`, `127.0.0.1`, `::1`, hosts privados (`10.*`, `172.16–31.*`, `192.168.*`), e hostnames que resolvam claramente como loopback/privado via parse de IP literal.
- Não há allowlist de marketplaces.

### Shopee (detecção opcional)

- Host em `ALLOWED_HOSTS` (default: `shopee.com.br`, `s.shopee.com.br`) ou subdomínio → trata como Shopee.
- Só nesses casos: chamar `resolveShopeeAffiliateUrl` + `enrichWithProductName` se faltar título/subIds.

### Título (`title`)

- **Opcional** em todos os casos (admin e API).
- Ordem de preenchimento:
  1. Valor enviado pelo cliente (se não vazio).
  2. Se URL Shopee: nome obtido pelo resolve/API afiliados.
  3. Fallback: hostname da URL (ex.: `landing.exemplo.com`).
- Documentar essa regra na rota da API, no README e no `.env.example`.

### Slug

- Opcional; se omitido, gera base62 (8 chars) único.
- Se informado: `/^[a-zA-Z0-9_-]{3,64}$/`; conflito → `409`.

### Dedupe

- Se a URL destino (trim) já existir → retornar o link existente com `existing: true` (sem criar duplicata).

## API externa

### Endpoint

`POST /api/v1/redirects`

### Autenticação

```
Authorization: Bearer <REDIRECT_API_KEY>
```

- Env: `REDIRECT_API_KEY` (obrigatório para a rota funcionar; se ausente → todas as requests `401`).
- Comparação em tempo constante quando possível (ou igualdade estrita do header).
- Admin (`x-admin-token` / `ADMIN_TOKEN`) **não** autentica esta rota; usa chave própria.

### Request

```json
{
  "url": "https://landing.exemplo.com/oferta",
  "title": "Oferta Black Friday",
  "slug": "bf-landing"
}
```

| Campo   | Obrigatório | Notas                                      |
|---------|-------------|--------------------------------------------|
| `url`   | sim         | Destino https                              |
| `title` | não         | Ver regras de fallback acima               |
| `slug`  | não         | Gerado se omitido                          |

Alias aceito para compatibilidade com o admin: `shopee_url` como sinônimo de `url` (se ambos vierem, preferir `url`).

### Response `201` (criado) / `200` (já existia)

```json
{
  "slug": "aB3xY9k2",
  "redirect_url": "https://seu-dominio.com/r/aB3xY9k2",
  "title": "landing.exemplo.com",
  "destination_url": "https://landing.exemplo.com/oferta",
  "existing": false,
  "active": true,
  "clicks": { "real": 0, "total": 0, "bots": 0, "in_app": 0 }
}
```

- `destination_url` espelha o valor gravado (coluna `shopee_url`).
- Manter `shopee_url` no payload do admin atual para não quebrar a UI; a API v1 usa `destination_url`.
- Links criados via API **aparecem no painel admin** (mesma tabela `links`) com cliques e status, iguais aos criados pelo formulário.

### Consultar link / estatísticas

`GET /api/v1/redirects/:slug`  
Mesma autenticação Bearer.

Resposta `200`:

```json
{
  "slug": "aB3xY9k2",
  "redirect_url": "https://seu-dominio.com/r/aB3xY9k2",
  "title": "landing.exemplo.com",
  "destination_url": "https://landing.exemplo.com/oferta",
  "active": true,
  "created_at": "...",
  "clicks": {
    "real": 12,
    "total": 15,
    "bots": 3,
    "in_app": 8,
    "by_platform": { "android": 5, "ios": 3, "desktop": 4 }
  }
}
```

- `404` se slug não existir.
- No admin: lista “Links cadastrados” e Relatórios já exibem cliques; nenhum filtro especial por origem (API vs painel).

### Erros

| Status | Situação                                      |
|--------|-----------------------------------------------|
| 401    | API key ausente/inválida                      |
| 400    | JSON inválido, URL inválida, não-https, denylist |
| 409    | slug já existe                                |
| 500    | falha ao gerar slug único                     |

## Painel admin

- Labels genéricos: “URL de destino”, não “URL Shopee”.
- Botão “Analisar URL”: só chama `/api/shopee/resolve` se `isShopeeUrl`; senão hint de que o título pode ser preenchido manualmente (opcional).
- `POST /api/links` passa a usar a mesma lógica compartilhada de criação (validação genérica + title opcional + fallback hostname).
- Campo body continua aceitando `shopee_url` (compatibilidade) e, se útil, também `url`.

## Redirect público `/r/[slug]`

- Lógica de bot / Android intent / iOS / 302 permanece.
- `lib/templates.ts`: textos neutros — título “Abrindo…”, botão “Abrir link”, cor neutra (não laranja Shopee).
- Destino continua sendo a URL salva byte a byte.

## Arquitetura

```
POST /api/v1/redirects  ──┐
                          ├──► lib/create-redirect.ts ──► lib/db.createLink
POST /api/links         ──┘         │
                                    ├─ isAllowedDestinationUrl
                                    ├─ isShopeeUrl ? resolve : skip
                                    └─ title fallback (hostname)
```

### Arquivos a alterar / criar

| Arquivo | Ação |
|---------|------|
| `lib/security.ts` | `isAllowedDestinationUrl`, `isShopeeUrl`, `isRedirectApiAuthorized` |
| `lib/create-redirect.ts` | **novo** — create/dedupe/resolve compartilhado |
| `app/api/v1/redirects/route.ts` | **novo** — endpoint API key |
| `app/api/links/route.ts` | usar create compartilhado |
| `components/admin/LinksManager.tsx` | UI genérica |
| `lib/templates.ts` | interstitial neutro |
| `.env.example` | `REDIRECT_API_KEY`; documentar `ALLOWED_HOSTS` só para auto-fill Shopee |
| `README.md` | documentar API v1 + title opcional |

## Variáveis de ambiente

```env
REDIRECT_API_KEY=troque-por-uma-chave-forte
ADMIN_TOKEN=...
BASE_URL=https://seu-dominio.com
# Usado apenas para detectar Shopee e auto-preencher título/subIds
ALLOWED_HOSTS=shopee.com.br,s.shopee.com.br
```

## Testes / verificação manual

1. Criar via API com URL de landing + sem title → `title` = hostname; `redirect_url` válido.
2. Criar via API com URL Shopee sem title → tenta auto-fill; se falhar, hostname.
3. Mesma URL duas vezes → segunda resposta `existing: true`, mesmo slug.
4. URL `http://` ou `https://127.0.0.1/...` → 400.
5. Sem Bearer / Bearer errado → 401.
6. Admin cria link não-Shopee com título opcional vazio → funciona com fallback.
7. Abrir `/r/{slug}` (fluxo Instagram se possível) → página “Abrindo…” neutra e redireciona ao destino.

## Decisão de produto (resumo)

| Tema | Decisão |
|------|----------|
| Escopo de URL | Qualquer https (landings), não só loja |
| Title | Opcional; fallback hostname; documentado |
| API | `POST /api/v1/redirects` + `REDIRECT_API_KEY` |
| Abordagem | Mínima: sem migration de coluna |
| Interstitial | Sempre genérico |
