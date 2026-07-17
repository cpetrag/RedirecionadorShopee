import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Redirect — Clube Promos',
  description:
    'Redirecionador de links https (landings, afiliados, lojas) — redirect.clubepromos.com.br',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
