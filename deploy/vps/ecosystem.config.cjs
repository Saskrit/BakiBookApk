module.exports = {
  apps: [
    {
      name: 'bakibook-api',
      cwd: '/var/www/bakibook/server',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '400M',
      time: true,
      error_file: '/var/www/bakibook/logs/err.log',
      out_file: '/var/www/bakibook/logs/out.log',
      merge_logs: true,
    },
  ],
};
