export default function Home() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 480,
        margin: '80px auto',
        padding: '0 24px',
        color: '#333',
      }}
    >
      <h1 style={{ color: '#ee4d2d' }}>Redirect Shopee</h1>
      <p>
        Serviço de redirecionamento de links de afiliado para uso em Stories e
        bio do Instagram.
      </p>
      <p style={{ fontSize: 14, color: '#666' }}>
        Links ativos ficam em <code>/r/[slug]</code>. Gestão via{' '}
        <a href="/admin" style={{ color: '#ee4d2d' }}>
          painel admin
        </a>
        .
      </p>
    </main>
  );
}
