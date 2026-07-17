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
      <h1 style={{ color: '#1a1a1a' }}>Redirect</h1>
      <p>
        Serviço de redirecionamento de links (landings, afiliados, lojas) para
        Stories, bio e integrações via API.
      </p>
      <p style={{ fontSize: 14, color: '#666' }}>
        Links ativos: <code>/r/[slug]</code>. API:{' '}
        <code>/api/v1/redirects</code>. Gestão via{' '}
        <a href="/admin" style={{ color: '#1a1a1a' }}>
          painel admin
        </a>
        .
      </p>
    </main>
  );
}
