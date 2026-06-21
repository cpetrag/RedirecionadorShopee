import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Redirect Shopee',
  description: 'Redirecionador de links de afiliado Shopee',
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
