module.exports = {
  apps: [
    {
      name: 'redirect-shopee',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 5222',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: '5222',
      },
    },
  ],
};
