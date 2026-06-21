'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminShell({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="admin-root">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-brand-icon">🛒</div>
            <span>Redirect Shopee</span>
          </div>
          <nav className="admin-nav">
            <Link href="/admin" className={pathname === '/admin' ? 'active' : ''}>
              🔗 Links
            </Link>
            <Link
              href="/admin/relatorios"
              className={pathname === '/admin/relatorios' ? 'active' : ''}
            >
              📊 Relatórios
            </Link>
          </nav>
          <div className="admin-sidebar-footer">
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              style={{ width: '100%', color: 'rgba(255,255,255,0.6)' }}
              onClick={onLogout}
            >
              Sair
            </button>
          </div>
        </aside>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
