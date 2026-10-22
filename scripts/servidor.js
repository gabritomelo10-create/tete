// Servidor estático local que imita o GitHub Pages: o site fica em /tete/, como em
// https://gabritomelo10-create.github.io/tete/. Uso: npm start (porta 8080, ou PORT).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PREFIXO = '/tete/';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function iniciarServidor(porta = 0) {
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/tete') {
      res.writeHead(301, { Location: PREFIXO }).end();
      return;
    }
    if (!url.pathname.startsWith(PREFIXO)) {
      res.writeHead(404).end('404');
      return;
    }
    let arquivo = path.join(RAIZ, decodeURIComponent(url.pathname.slice(PREFIXO.length)));
    if (!arquivo.startsWith(RAIZ) || arquivo.includes(`${path.sep}node_modules`) || arquivo.includes(`${path.sep}.git`)) {
      res.writeHead(404).end('404');
      return;
    }
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/` }).end();
        return;
      }
      arquivo = path.join(arquivo, 'index.html');
    }
    fs.readFile(arquivo, (erro, dados) => {
      if (erro) {
        res.writeHead(404).end('404');
        return;
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream' }).end(dados);
    });
  });
  return new Promise((resolve) => {
    servidor.listen(porta, '127.0.0.1', () => resolve({
      servidor,
      base: `http://127.0.0.1:${servidor.address().port}${PREFIXO}`,
      fechar: () => new Promise((r) => servidor.close(r)),
    }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { base } = await iniciarServidor(Number(process.env.PORT) || 8080);
  console.log(`Um carinho de volta em ${base}`);
}
