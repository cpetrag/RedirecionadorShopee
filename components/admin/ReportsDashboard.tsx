'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-client';
import type { DayStat, HourStat, LinkRow, PlatformPeriodStat, ReportData } from '@/lib/admin-types';

const PLATFORM_LABELS: Record<string, string> = {
  android: 'Android',
  ios: 'iOS',
  desktop: 'Desktop',
  other: 'Outro',
};

function DayChart({ data }: { data: DayStat[] }) {
  if (data.length === 0) {
    return <div className="admin-empty">Sem cliques no período selecionado.</div>;
  }

  const max = Math.max(...data.map((d) => d.real + d.in_app), 1);

  return (
    <>
      <div className="admin-chart-bars">
        {data.map((day) => {
          const realH = (day.real / max) * 140;
          const inAppH = (day.in_app / max) * 140;
          const label = day.date.slice(5); // MM-DD
          return (
            <div key={day.date} className="admin-chart-bar-group" title={`${day.date}: ${day.real} cliques`}>
              <div
                className="admin-chart-bar-stack"
                style={{ height: Math.max(realH + inAppH, 4) }}
              >
                {day.in_app > 0 && (
                  <div
                    className="admin-chart-bar-inapp"
                    style={{ height: inAppH }}
                  />
                )}
                {day.real > 0 && (
                  <div
                    className="admin-chart-bar-real"
                    style={{ height: realH }}
                  />
                )}
              </div>
              <span className="admin-chart-label">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="admin-chart-legend">
        <span>
          <i style={{ background: 'var(--shopee)' }} /> Cliques reais
        </span>
        <span>
          <i style={{ background: '#7c3aed' }} /> In-app (IG/FB)
        </span>
      </div>
    </>
  );
}

function HourChart({ data }: { data: HourStat[] }) {
  if (data.length === 0) {
    return <div className="admin-empty">Sem cliques no período selecionado.</div>;
  }

  // Preenche horas 0–23 (pode faltar hora sem clique)
  const byHour = new Map(data.map((h) => [h.hour, h]));
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const row = byHour.get(hour);
    return { hour, real: row?.real ?? 0, in_app: row?.in_app ?? 0 };
  });

  const max = Math.max(...hours.map((h) => h.real), 1);

  return (
    <>
      <div className="admin-chart-bars">
        {hours.map(({ hour, real, in_app }) => {
          const realH = (real / max) * 140;
          const inAppH = (in_app / max) * 140;
          return (
            <div
              key={hour}
              className="admin-chart-bar-group"
              title={`${String(hour).padStart(2, '0')}h: ${real} cliques`}
            >
              <div
                className="admin-chart-bar-stack"
                style={{ height: Math.max(realH + inAppH, real > 0 ? 4 : 2) }}
              >
                {in_app > 0 && (
                  <div className="admin-chart-bar-inapp" style={{ height: inAppH }} />
                )}
                {real > 0 && (
                  <div className="admin-chart-bar-real" style={{ height: realH }} />
                )}
              </div>
              <span className="admin-chart-label">
                {hour % 3 === 0 ? `${String(hour).padStart(2, '0')}h` : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="admin-chart-legend">
        <span>
          <i style={{ background: 'var(--shopee)' }} /> Cliques reais (soma do período)
        </span>
        <span>
          <i style={{ background: '#7c3aed' }} /> In-app (IG/FB)
        </span>
      </div>
      <p className="admin-field-hint" style={{ marginTop: 12, marginBottom: 0 }}>
        Soma de todos os dias do filtro, agrupado por hora do dia.
      </p>
    </>
  );
}

export default function ReportsDashboard() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [linkId, setLinkId] = useState<number | ''>('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (linkId !== '') params.set('link_id', String(linkId));
    const res = await adminFetch(`/api/reports?${params}`);
    if (res.ok) {
      setReport(await res.json());
    }
    setLoading(false);
  }, [days, linkId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const summary = report?.summary;
  const links = report?.links ?? [];

  return (
    <>
      <div className="admin-page-header">
        <h1>Relatórios</h1>
        <p>Métricas agregadas por dia, hora e plataforma.</p>
      </div>

      <div className="admin-filters">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <select
          value={linkId}
          onChange={(e) =>
            setLinkId(e.target.value === '' ? '' : Number(e.target.value))
          }
        >
          <option value="">Todos os links</option>
          {links.map((l: LinkRow) => (
            <option key={l.id} value={l.id}>
              {l.title ?? l.slug} ({l.clicks.real} cliques)
            </option>
          ))}
        </select>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={loadReport}
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="admin-loading">Carregando relatório…</div>
      ) : report ? (
        <>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <div className="label">Cliques reais</div>
              <div className="value accent">{summary?.real ?? 0}</div>
              <div className="sub">Exclui bots</div>
            </div>
            <div className="admin-stat-card">
              <div className="label">In-app (IG/FB)</div>
              <div className="value">{summary?.in_app ?? 0}</div>
            </div>
            <div className="admin-stat-card">
              <div className="label">Bots</div>
              <div className="value">{summary?.bots ?? 0}</div>
              <div className="sub">Previews Meta etc.</div>
            </div>
            {!linkId && (
              <>
                <div className="admin-stat-card">
                  <div className="label">Links ativos</div>
                  <div className="value">
                    {'active_links' in (summary ?? {})
                      ? (summary as { active_links: number }).active_links
                      : links.filter((l) => l.active).length}
                  </div>
                </div>
              </>
            )}
          </div>

          {summary?.by_platform && Object.keys(summary.by_platform).length > 0 && (
            <div className="admin-stats">
              {Object.entries(summary.by_platform).map(([platform, count]) => (
                <div key={platform} className="admin-stat-card">
                  <div className="label">{PLATFORM_LABELS[platform] ?? platform}</div>
                  <div className="value">{count}</div>
                </div>
              ))}
            </div>
          )}

          <div className="admin-chart">
            <h2>Cliques por dia</h2>
            <DayChart data={report.by_day} />
          </div>

          <div className="admin-chart">
            <h2>Fluxo por hora do dia</h2>
            <HourChart data={report.by_hour} />
          </div>

          <div className="admin-table-wrap" style={{ marginBottom: 28 }}>
            <h2>Performance por link</h2>
            {links.length === 0 ? (
              <div className="admin-empty">Nenhum link cadastrado.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Link</th>
                    <th>SubIds</th>
                    <th>Reais</th>
                    <th>In-app</th>
                    <th>Bots</th>
                    <th>Android</th>
                    <th>iOS</th>
                    <th>Desktop</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <div>{link.title ?? link.slug}</div>
                        <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          /r/{link.slug}
                        </div>
                      </td>
                      <td>
                        {(link.sub_ids?.length ?? 0) > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {link.sub_ids!.map((s) => (
                              <span key={s.slot} className="admin-badge admin-badge-platform">
                                {String(s.slot).padStart(2, '0')}: {s.value}
                              </span>
                            ))}
                          </div>
                        ) : (
                          link.sub_id ?? '—'
                        )}
                      </td>
                      <td><strong>{link.clicks.real}</strong></td>
                      <td>{link.clicks.in_app}</td>
                      <td>{link.clicks.bots}</td>
                      <td>{link.clicks.by_platform.android ?? 0}</td>
                      <td>{link.clicks.by_platform.ios ?? 0}</td>
                      <td>{link.clicks.by_platform.desktop ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="admin-table-wrap">
            <h2>Plataformas no período</h2>
            {report.by_platform_period.length === 0 ? (
              <div className="admin-empty">Nenhum clique registrado ainda.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Plataforma</th>
                    <th>Reais</th>
                    <th>In-app</th>
                    <th>Bots</th>
                  </tr>
                </thead>
                <tbody>
                  {report.by_platform_period.map((row: PlatformPeriodStat) => (
                    <tr key={row.platform}>
                      <td>
                        <span className="admin-badge admin-badge-platform">
                          {PLATFORM_LABELS[row.platform] ?? row.platform}
                        </span>
                      </td>
                      <td><strong>{row.real}</strong></td>
                      <td>{row.in_app}</td>
                      <td>{row.bots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="admin-alert admin-alert-error">
          Erro ao carregar relatório. Verifique o token.
        </div>
      )}
    </>
  );
}
