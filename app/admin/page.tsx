import './admin.css';
import AuthGate from '@/components/admin/AuthGate';
import LinksManager from '@/components/admin/LinksManager';

export const metadata = {
  title: 'Admin — Redirect Shopee',
  robots: 'noindex, nofollow',
};

export default function AdminPage() {
  return (
    <AuthGate>
      <LinksManager />
    </AuthGate>
  );
}
