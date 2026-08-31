const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function getApiRootPayload() {
  return {
    status: 'ok',
    name: 'BakiBook API',
    message: 'BakiBook API is running',
    timestamp: new Date().toISOString(),
    docs: {
      health: '/api/health',
      maintenance: '/api/maintenance-status',
      auth: '/api/auth',
    },
  };
}

export function prefersApiHtml(req) {
  if (req.query?.format === 'json') return false;
  if (req.query?.format === 'html') return true;
  const accept = String(req.headers.accept || '');
  return accept.includes('text/html');
}

export function renderApiLandingPage({ apiOrigin, clientUrl, timestamp }) {
  const safeApi = escapeHtml(apiOrigin || '');
  const safeClient = escapeHtml(clientUrl || 'https://bakibook.run.place');

  const endpoints = [
    { path: '/api/health', label: 'Health check', desc: 'Server status & email config' },
    { path: '/api/maintenance-status', label: 'Maintenance', desc: 'Public maintenance flag' },
    { path: '/api/auth/login', label: 'Auth', desc: 'Login, register, verify' },
    { path: '/api/stats', label: 'Stats', desc: 'Public platform metrics' },
  ];

  const shortTime = escapeHtml(
    timestamp
      ? new Date(timestamp).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        }) + ' UTC'
      : ''
  );

  const endpointCards = endpoints
    .map(
      (item) => `
      <a class="endpoint" href="${escapeHtml(item.path)}" title="${escapeHtml(item.desc)}">
        <span class="endpoint__method">GET</span>
        <div class="endpoint__text">
          <span class="endpoint__path">${escapeHtml(item.path)}</span>
          <span class="endpoint__label">${escapeHtml(item.label)}</span>
        </div>
      </a>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="BakiBook API — credit ledger backend for shopkeepers and customers." />
    <meta name="robots" content="noindex" />
    <title>BakiBook API</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg: #f6f3ef;
        --surface: rgba(255, 255, 255, 0.92);
        --border: rgba(76, 92, 45, 0.12);
        --text: #2f3820;
        --muted: #5c6650;
        --primary: #6a7e3f;
        --primary-dark: #4c5c2d;
        --primary-soft: #eef4e4;
      }

      * { box-sizing: border-box; margin: 0; padding: 0; }

      html, body {
        height: 100%;
        overflow: hidden;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: "DM Sans", system-ui, -apple-system, sans-serif;
        color: var(--text);
        background:
          radial-gradient(ellipse 70% 50% at 15% 0%, rgba(106, 126, 63, 0.16), transparent 55%),
          radial-gradient(ellipse 60% 45% at 85% 100%, rgba(76, 92, 45, 0.08), transparent 50%),
          var(--bg);
      }

      .card {
        width: min(100%, 640px);
        max-height: calc(100dvh - 32px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: var(--surface);
        backdrop-filter: blur(12px);
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(76, 92, 45, 0.12);
      }

      .card__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 20px 22px 16px;
        border-bottom: 1px solid var(--border);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .logo {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(145deg, var(--primary) 0%, var(--primary-dark) 100%);
        display: grid;
        place-items: center;
        color: #fff;
        font-weight: 700;
        font-size: 1.125rem;
        box-shadow: 0 8px 20px rgba(106, 126, 63, 0.28);
      }

      .brand__text { min-width: 0; }

      .brand h1 {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.2;
        color: var(--primary-dark);
      }

      .brand p {
        margin-top: 2px;
        color: var(--muted);
        font-size: 0.8125rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 12px;
        border-radius: 999px;
        background: var(--primary-soft);
        border: 1px solid rgba(106, 126, 63, 0.18);
        color: var(--primary-dark);
        font-size: 0.75rem;
        font-weight: 600;
        white-space: nowrap;
      }

      .status__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #5cb85c;
        box-shadow: 0 0 0 3px rgba(92, 184, 92, 0.22);
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.65; }
      }

      .card__body {
        padding: 18px 22px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .meta__item {
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid var(--border);
        min-width: 0;
      }

      .meta__item--full {
        grid-column: 1 / -1;
      }

      .meta__label {
        display: block;
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 3px;
      }

      .meta__value {
        display: block;
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.75rem;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        padding: 9px 14px;
        border-radius: 10px;
        font-size: 0.8125rem;
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
      }

      .btn--primary {
        background: linear-gradient(145deg, var(--primary) 0%, var(--primary-dark) 100%);
        color: #fff;
      }

      .btn--ghost {
        background: #fff;
        color: var(--primary-dark);
        border: 1px solid var(--border);
      }

      .section-label {
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .endpoints {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .endpoint {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid var(--border);
        text-decoration: none;
        color: inherit;
        min-width: 0;
      }

      .endpoint:hover {
        border-color: rgba(106, 126, 63, 0.35);
        background: #fff;
      }

      .endpoint__method {
        flex-shrink: 0;
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.625rem;
        font-weight: 600;
        padding: 3px 6px;
        border-radius: 5px;
        background: var(--primary-soft);
        color: var(--primary-dark);
      }

      .endpoint__text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .endpoint__path {
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.6875rem;
        color: var(--primary-dark);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .endpoint__label {
        font-size: 0.75rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .card__footer {
        padding: 12px 22px 16px;
        border-top: 1px solid var(--border);
        text-align: center;
        font-size: 0.75rem;
        color: var(--muted);
      }

      .card__footer a {
        color: var(--primary);
        text-decoration: none;
        font-weight: 600;
      }

      @media (max-width: 520px) {
        body { padding: 10px; align-items: flex-start; padding-top: max(10px, env(safe-area-inset-top)); }
        .card { max-height: calc(100dvh - 20px); border-radius: 16px; }
        .card__header { flex-direction: column; align-items: flex-start; padding: 16px; }
        .meta { grid-template-columns: 1fr; }
        .endpoints { grid-template-columns: 1fr; }
        html, body { overflow: auto; }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <header class="card__header">
        <div class="brand">
          <div class="logo" aria-hidden="true">B</div>
          <div class="brand__text">
            <h1>BakiBook API</h1>
            <p>Credit ledger backend</p>
          </div>
        </div>
        <div class="status" role="status">
          <span class="status__dot" aria-hidden="true"></span>
          Operational
        </div>
      </header>

      <div class="card__body">
        <div class="meta">
          <div class="meta__item">
            <span class="meta__label">API</span>
            <span class="meta__value" title="${safeApi}">${safeApi || '—'}</span>
          </div>
          <div class="meta__item">
            <span class="meta__label">Web app</span>
            <span class="meta__value" title="${safeClient}">${safeClient}</span>
          </div>
          <div class="meta__item meta__item--full">
            <span class="meta__label">Checked</span>
            <span class="meta__value">${shortTime}</span>
          </div>
        </div>

        <div class="actions">
          <a class="btn btn--primary" href="/api/health">Health check</a>
          <a class="btn btn--ghost" href="${safeClient}">Web app ↗</a>
          <a class="btn btn--ghost" href="/api?format=json">JSON</a>
        </div>

        <p class="section-label">Public endpoints</p>
        <div class="endpoints">${endpointCards}</div>
      </div>

      <p class="card__footer">
        Clients use <code>/api</code> · <a href="${safeClient}">bakibook.run.place</a>
      </p>
    </main>
  </body>
</html>`;
}

export function handleApiRoot(req, res) {
  const payload = getApiRootPayload();

  if (!prefersApiHtml(req)) {
    return res.json(payload);
  }

  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host') || '';
  const apiOrigin = host ? `${proto}://${host}` : process.env.SERVER_URL || '';
  const clientUrl = process.env.CLIENT_URL || 'https://bakibook.run.place';

  return res.type('html').send(
    renderApiLandingPage({
      apiOrigin,
      clientUrl,
      timestamp: payload.timestamp,
    })
  );
}
