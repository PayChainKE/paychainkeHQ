module.exports = {
  apps: [
    {
      name: 'paychain-backend',
      script: 'npm',
      args: 'run dev',
      cwd: './backend',
      watch: false,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'paychain-merchant',
      script: 'npm',
      args: 'run dev',
      cwd: './apps/merchant-dashboard',
      watch: false,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'paychain-web',
      script: 'npm',
      args: 'run dev',
      cwd: './apps/web',
      watch: false,
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};
