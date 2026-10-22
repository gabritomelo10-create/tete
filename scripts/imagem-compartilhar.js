// Gera img/compartilhar.png (1200×630), a prévia que aparece ao colar o link no WhatsApp.
// Usa o próprio envelope do site, sem nomes. Uso: node scripts/imagem-compartilhar.js
import path from 'node:path';
import { chromium } from 'playwright';
import { iniciarServidor, RAIZ } from './servidor.js';

const { base, fechar } = await iniciarServidor();

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="css/estilo.css">
<link rel="stylesheet" href="og.css">
</head><body><div class="og">
  <div class="og-texto">
    <span class="logo"><span class="logo-palavra"><span class="logo-n">N</span><span class="logo-o"><img src="img/bola-o.svg" alt=""></span><span class="logo-el">ël</span></span><span class="logo-sucre">Sucré</span></span>
    <h1>Tem um carinho de volta para <em>você</em>.</h1>
    <p>Toque para abrir seu agradecimento.</p>
  </div>
  <div class="og-envelope"></div>
</div>
<script type="module">
  import { criarEnvelope } from './js/comum.js';
  const env = criarEnvelope({ para: 'você' });
  env.style.animation = 'none';
  document.querySelector('.og-envelope').append(env);
  document.fonts.ready.then(() => document.body.dataset.pronto = '1');
</script></body></html>`;
const css = `
body { display:block; min-height:0; }
.og { width:1200px; height:630px; display:flex; align-items:center; gap:40px; padding:0 70px; position:relative; background: radial-gradient(90% 80% at 30% 0%, rgb(190 50 40 / 55%) 0%, transparent 65%), linear-gradient(180deg, var(--rouge) 0%, var(--rouge-profundo) 100%); color: var(--texto-claro); }
.og::after { content:''; position:absolute; left:0; right:0; bottom:0; height:34px; background: url('img/losangos.svg') repeat-x center top / 58.9px 34px, var(--sapin); border-top:1px solid var(--ouro); }
.og-texto h1 { background: var(--ouro-texto); -webkit-background-clip:text; background-clip:text; color:transparent; }
.og-texto h1 em { background:none; color:inherit; -webkit-background-clip:border-box; background-clip:border-box; }
.og-texto { flex:1; display:flex; flex-direction:column; align-items:flex-start; color: var(--dourado-escuro); }
.og-texto .logo { --tam: 54px; margin-top:-30px; }
.og-texto h1 { font-size:64px; margin:28px 0 14px; }
.og-texto p { font-size:24px; color: var(--texto-claro-suave); margin:0; }
.og-envelope { align-self:stretch; display:grid; place-items:center; padding:0 40px 34px; margin-right:-70px; background: var(--creme); border-radius: 0; }
.og-envelope .envelope { --w: 440px; margin:0; }
.og-envelope .env-etiqueta { font-size:28px; }
`;

const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
  await pagina.route(`${base}og`, (rota) => rota.fulfill({ contentType: 'text/html', body: html }));
  await pagina.route(`${base}og.css`, (rota) => rota.fulfill({ contentType: 'text/css', body: css }));
  await pagina.goto(`${base}og`);
  await pagina.waitForSelector('body[data-pronto]');
  await pagina.screenshot({ path: path.join(RAIZ, 'img/compartilhar.png') });
  console.log('img/compartilhar.png gerada');
} finally {
  await navegador.close();
  await fechar();
}
