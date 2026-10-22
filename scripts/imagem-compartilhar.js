// Gera public/img/compartilhar.png (1200×630), a prévia que aparece ao colar o link no WhatsApp.
// Usa o próprio envelope do site, sem nomes. Uso: node scripts/imagem-compartilhar.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { carregarConfig } from '../server/config.js';
import { criarApp } from '../server/app.js';

const pastaDados = fs.mkdtempSync(path.join(os.tmpdir(), 'carinho-og-'));
const config = carregarConfig({ DATA_DIR: pastaDados });
const { app, encerrar } = criarApp(config);
const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
const base = `http://127.0.0.1:${servidor.address().port}`;

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/estilo.css">
<link rel="stylesheet" href="/og.css">
</head><body><div class="og">
  <div class="og-texto">
    <span class="marca-nome">Tetê</span><span class="marca-sub">Atelier Sucré</span>
    <h1>Tem um carinho de volta para você.</h1>
    <p>Toque para abrir seu agradecimento.</p>
  </div>
  <div class="og-envelope"></div>
</div>
<script type="module">
  import { criarEnvelope } from '/js/comum.js';
  const env = criarEnvelope({ para: 'você' });
  env.style.animation = 'none';
  document.querySelector('.og-envelope').append(env);
  document.fonts.ready.then(() => document.body.dataset.pronto = '1');
</script></body></html>`;
const css = `
body { display:block; min-height:0; }
.og { width:1200px; height:630px; display:flex; align-items:center; gap:40px; padding:0 70px; }
.og-texto { flex:1; display:flex; flex-direction:column; align-items:flex-start; color: var(--dourado-escuro); }
.og-texto .marca-sub { font-size:30px; margin-top:-2px; }
.og-texto .marca-nome { font-size:22px; }
.og-texto h1 { font-size:64px; margin:28px 0 14px; }
.og-texto p { font-size:26px; color: var(--tinta-suave); margin:0; }
.og-envelope .envelope { --w: 470px; margin:0; }
.og-envelope .env-etiqueta { font-size:34px; }
`;

const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
  await pagina.route(`${base}/og`, (rota) => rota.fulfill({ contentType: 'text/html', body: html }));
  await pagina.route(`${base}/og.css`, (rota) => rota.fulfill({ contentType: 'text/css', body: css }));
  await pagina.goto(`${base}/og`);
  await pagina.waitForSelector('body[data-pronto]');
  await pagina.screenshot({ path: path.join(config.raiz, 'public/img/compartilhar.png') });
  console.log('public/img/compartilhar.png gerada');
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
  encerrar();
  fs.rmSync(pastaDados, { recursive: true, force: true });
}
