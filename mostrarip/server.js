const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const LOG_FILE = path.join(__dirname, 'ips.log');
const ADMIN_PASSWORD = 'admin'; // Senha simples conforme solicitado

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/') {
    // Pega o IP real mesmo atrás de proxy/load balancer
    const raw =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress;

    // Converte ::ffff:x.x.x.x (IPv4 mapeado em IPv6) para IPv4 puro
    const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;

    // Loga no terminal e no arquivo
    const agora = new Date().toLocaleString('pt-BR');
    const logEntry = `[${agora}] Conexão de: ${ip}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(LOG_FILE, logEntry);

    // Lê o HTML e injeta o IP
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const rendered = html.replace('{{IP}}', ip);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(rendered);
  } 
  else if (parsedUrl.pathname === '/admin') {
    const password = parsedUrl.query.pw;

    if (password !== ADMIN_PASSWORD) {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Acesso Negado</h1><p>Use /admin?pw=suasenha</p>');
    }

    let logs = '';
    if (fs.existsSync(LOG_FILE)) {
      logs = fs.readFileSync(LOG_FILE, 'utf8');
    } else {
      logs = 'Nenhum log registrado ainda.';
    }

    const adminHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Admin - Logs de IP</title>
      <style>
        body { background: #0f0f0f; color: #fff; font-family: sans-serif; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: #1a1a1a; padding: 20px; border-radius: 8px; border: 1px solid #2a2a2a; }
        h1 { color: #4ade80; border-bottom: 1px solid #2a2a2a; padding-bottom: 10px; }
        pre { background: #000; padding: 15px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; color: #ccc; line-height: 1.5; }
        .refresh { display: inline-block; margin-bottom: 20px; color: #4ade80; text-decoration: none; border: 1px solid #4ade80; padding: 5px 15px; border-radius: 4px; }
        .refresh:hover { background: #4ade80; color: #000; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Histórico de Acessos (IPs)</h1>
        <a href="/admin?pw=${ADMIN_PASSWORD}" class="refresh">Atualizar</a>
        <pre>${logs}</pre>
      </div>
    </body>
    </html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(adminHtml);
  }
  else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
