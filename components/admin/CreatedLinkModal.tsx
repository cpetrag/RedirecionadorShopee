'use client';

import { useState } from 'react';
import type { LinkRow } from '@/lib/admin-types';

function SubIdBadges({ subIds }: { subIds: LinkRow['sub_ids'] }) {
  if (!subIds?.length) {
    return <span className="admin-modal-muted">Nenhum subId detectado</span>;
  }
  return (
    <div className="admin-modal-badges">
      {subIds.map((s) => (
        <span key={s.slot} className="admin-badge admin-badge-platform">
          {String(s.slot).padStart(2, '0')}: {s.value}
        </span>
      ))}
    </div>
  );
}

export default function CreatedLinkModal({
  link,
  isExisting = false,
  onClose,
}: {
  link: LinkRow;
  isExisting?: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(link.redirect_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="created-link-title"
      >
        <button
          type="button"
          className="admin-modal-close"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>

        <div className="admin-modal-icon">{isExisting ? '↩' : '✓'}</div>
        <h2 id="created-link-title" className="admin-modal-title">
          {isExisting ? 'Link já cadastrado' : 'Link criado com sucesso'}
        </h2>
        <p className="admin-modal-subtitle">
          {isExisting
            ? 'Esta URL Shopee já existe — copie o link de redirect abaixo'
            : 'Use este link na Story ou bio do Instagram'}
        </p>

        <div className="admin-modal-link-box">
          <label className="admin-modal-label">Seu link de redirect</label>
          <div className="admin-modal-link-row">
            <code className="admin-modal-link">{link.redirect_url}</code>
          </div>
          <button
            type="button"
            className={`admin-btn admin-btn-primary admin-modal-copy${copied ? ' copied' : ''}`}
            onClick={copyLink}
          >
            {copied ? 'Copiado!' : 'Copiar link'}
          </button>
        </div>

        <div className="admin-modal-details">
          <div className="admin-modal-detail">
            <span className="admin-modal-label">Produto</span>
            <span>{link.title ?? '—'}</span>
          </div>
          <div className="admin-modal-detail">
            <span className="admin-modal-label">Slug</span>
            <code>/r/{link.slug}</code>
          </div>
          <div className="admin-modal-detail">
            <span className="admin-modal-label">URL Shopee (inalterada)</span>
            <code className="admin-modal-url-small">{link.shopee_url}</code>
          </div>
          <div className="admin-modal-detail">
            <span className="admin-modal-label">SubIds (utm_content)</span>
            <SubIdBadges subIds={link.sub_ids} />
          </div>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-modal-close-btn"
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
