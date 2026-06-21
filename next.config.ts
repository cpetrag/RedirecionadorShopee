import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 é módulo nativo — não empacotar no bundle do servidor
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
