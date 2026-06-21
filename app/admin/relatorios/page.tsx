import '../admin.css';
import AuthGate from '@/components/admin/AuthGate';
import ReportsDashboard from '@/components/admin/ReportsDashboard';

export const metadata = {
  title: 'Relatórios — Redirect Shopee',
  robots: 'noindex, nofollow',
};

export default function RelatoriosPage() {
  return (
    <AuthGate>
      <ReportsDashboard />
    </AuthGate>
  );
}
