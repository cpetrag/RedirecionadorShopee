'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-client';
import CreatedLinkModal from '@/components/admin/CreatedLinkModal';
import type { LinkRow, ParsedSubId } from '@/lib/admin-types';
import { normalizeShopeeUrlForCompare } from '@/lib/shopee-url';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      className={`admin-copy-btn${copied ? ' copied' : ''}`}
      onClick={copy}
    >
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

function SubIdBadges({ subIds }: { subIds: ParsedSubId[] }) {
  if (subIds.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {subIds.map((s) => (
        <span key={s.slot} className="admin-badge admin-badge-platform">
          {String(s.slot).padStart(2, '0')}: {s.value}
        </span>
      ))}
    </div>
  );
}

export default function LinksManager() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const [resolveHint, setResolveHint] = useState('');
  const [createdLink, setCreatedLink] = useState<LinkRow | null>(null);
  const [createdLinkExisting, setCreatedLinkExisting] = useState(false);

  const [shopeeUrl, setShopeeUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [subIds, setSubIds] = useState<ParsedSubId[]>([]);
  const [title, setTitle] = useState('');

  const loadLinks = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch('/api/links');
    if (res.ok) {
      const data = await res.json();
      setLinks(data.links);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const resolveUrl = useCallback(async (url: string) => {
    const res = await adminFetch('/api/shopee/resolve', {
      method: 'POST',
      body: JSON.stringify({ url: url.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `Erro ao analisar URL (${res.status})`);
    }
    return data as {
      sub_ids?: ParsedSubId[];
      product_name?: string | null;
      item_id?: string | null;
      api_configured?: boolean;
    };
  }, []);

  const applyResolveData = (data: {
    sub_ids?: ParsedSubId[];
    product_name?: string | null;
    item_id?: string | null;
    api_configured?: boolean;
  }) => {
    setSubIds(data.sub_ids ?? []);
    if (data.product_name) setTitle(data.product_name);

    const parts: string[] = [];
    if (data.sub_ids?.length) {
      parts.push(`${data.sub_ids.length} subId(s) extraído(s) do utm_content`);
    }
    if (data.product_name) parts.push(`Produto: ${data.product_name}`);
    else if (data.item_id && data.api_configured) {
      parts.push('Produto não encontrado na API — preencha o título manualmente');
    }

    if (parts.length) setResolveHint(parts.join(' · '));
    else setResolveHint('Nenhum utm_content encontrado nesta URL');
  };

  const handleAnalyze = async () => {
    if (!shopeeUrl.trim()) return;
    setError('');
    setResolveHint('');
    setSubIds([]);
    setResolving(true);

    try {
      const data = await resolveUrl(shopeeUrl);
      applyResolveData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar URL');
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const trimmedUrl = shopeeUrl.trim();
    const duplicate = links.find(
      (l) => normalizeShopeeUrlForCompare(l.shopee_url) === normalizeShopeeUrlForCompare(trimmedUrl)
    );
    if (duplicate) {
      setCreatedLink(duplicate);
      setCreatedLinkExisting(true);
      setShopeeUrl('');
      setSlug('');
      setSubIds([]);
      setTitle('');
      setResolveHint('');
      setSubmitting(false);
      return;
    }

    let payloadSubIds = subIds;
    let payloadTitle = title.trim();

    // Pré-visualiza metadados no formulário (o servidor também processa automaticamente)
    if (shopeeUrl.trim() && (!payloadSubIds.length || !payloadTitle)) {
      try {
        setResolveHint('Processando URL…');
        const data = await resolveUrl(shopeeUrl);
        if (data.sub_ids?.length) payloadSubIds = data.sub_ids;
        if (data.product_name && !payloadTitle) payloadTitle = data.product_name;
        applyResolveData(data);
      } catch (err) {
        setSubmitting(false);
        setError(err instanceof Error ? err.message : 'Erro ao processar URL');
        return;
      }
    }

    const body: Record<string, unknown> = { shopee_url: shopeeUrl.trim() };
    if (slug.trim()) body.slug = slug.trim();
    if (payloadSubIds.length) body.sub_ids = payloadSubIds;
    if (payloadTitle) body.title = payloadTitle;

    const res = await adminFetch('/api/links', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    let data: LinkRow & { error?: string; existing?: boolean };
    try {
      data = await res.json();
    } catch {
      setSubmitting(false);
      setError('Resposta inválida ao criar link');
      return;
    }

    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar link');
      return;
    }

    setCreatedLink(data);
    setCreatedLinkExisting(!!data.existing);
    setShopeeUrl('');
    setSlug('');
    setSubIds([]);
    setTitle('');
    setResolveHint('');
    loadLinks();
  };

  const toggleActive = async (link: LinkRow) => {
    const res = await adminFetch(`/api/links/${link.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !link.active }),
    });
    if (res.ok) loadLinks();
  };

  const totalReal = links.reduce((s, l) => s + l.clicks.real, 0);

  return (
    <>
      {createdLink && (
        <CreatedLinkModal
          link={createdLink}
          isExisting={createdLinkExisting}
          onClose={() => {
            setCreatedLink(null);
            setCreatedLinkExisting(false);
          }}
        />
      )}

      <div className="admin-page-header">
        <h1>Links</h1>
        <p>Cadastre URLs de afiliado Shopee e copie o link para Stories/bio.</p>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="label">Total de links</div>
          <div className="value">{links.length}</div>
        </div>
        <div className="admin-stat-card">
          <div className="label">Ativos</div>
          <div className="value accent">
            {links.filter((l) => l.active).length}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="label">Cliques reais</div>
          <div className="value">{totalReal}</div>
          <div className="sub">Bots excluídos</div>
        </div>
      </div>

      <div className="admin-form">
        <h2>Novo link</h2>
        {error && <div className="admin-alert admin-alert-error">{error}</div>}
        {resolveHint && !createdLink && (
          <div className="admin-alert admin-alert-success">{resolveHint}</div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="admin-field">
            <label htmlFor="shopee_url">URL de afiliado Shopee *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="shopee_url"
                type="url"
                value={shopeeUrl}
                onChange={(e) => setShopeeUrl(e.target.value)}
                placeholder="https://s.shopee.com.br/18CNPX3x4"
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={handleAnalyze}
                disabled={resolving || !shopeeUrl.trim()}
              >
                {resolving ? 'Analisando…' : 'Analisar URL'}
              </button>
            </div>
            <p className="admin-field-hint">
              Cole o link curto da Shopee e clique <strong>Criar link</strong> — o
              sistema processa automaticamente subIds e nome do produto.
              A URL cadastrada <strong>não será alterada</strong>.
            </p>
          </div>

          {subIds.length > 0 && (
            <div className="admin-field">
              <label>SubIds detectados (utm_content)</label>
              <SubIdBadges subIds={subIds} />
            </div>
          )}

          <div className="admin-form-grid">
            <div className="admin-field">
              <label htmlFor="title">Título / Produto</label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Preenchido ao analisar URL"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="slug">Slug personalizado (opcional)</label>
              <input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Gerado automaticamente"
                pattern="[a-zA-Z0-9_-]{3,64}"
              />
            </div>
          </div>

          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={submitting || resolving}
          >
            {submitting ? 'Processando…' : 'Criar link'}
          </button>
        </form>
      </div>

      <div className="admin-table-wrap">
        <h2>Links cadastrados</h2>
        {loading ? (
          <div className="admin-loading">Carregando…</div>
        ) : links.length === 0 ? (
          <div className="admin-empty">Nenhum link cadastrado ainda.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Link redirect</th>
                <th>Produto / SubIds</th>
                <th>Cliques</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <div className="mono truncate" title={link.redirect_url}>
                      /r/{link.slug}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <CopyButton text={link.redirect_url} />
                    </div>
                  </td>
                  <td>
                    <div>{link.title ?? '—'}</div>
                    <SubIdBadges subIds={link.sub_ids ?? []} />
                  </td>
                  <td>
                    <strong>{link.clicks.real}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                      {' '}
                      / {link.clicks.total} total
                    </span>
                    {link.clicks.in_app > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#7c3aed' }}>
                        {link.clicks.in_app} in-app
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${link.active ? 'admin-badge-active' : 'admin-badge-inactive'}`}
                    >
                      {link.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`admin-toggle${link.active ? ' on' : ''}`}
                      onClick={() => toggleActive(link)}
                      title={link.active ? 'Desativar' : 'Ativar'}
                      aria-label={link.active ? 'Desativar link' : 'Ativar link'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
