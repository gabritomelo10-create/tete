// Percurso completo no navegador, em tela de celular, com microfone simulado pelo Chromium.
// O site é servido em /tete/, como no GitHub Pages. Uso: npm run e2e [-- pasta-para-capturas]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { iniciarServidor } from './servidor.js';

const pastaCapturas = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (pastaCapturas) fs.mkdirSync(pastaCapturas, { recursive: true });

const { base, fechar } = await iniciarServidor();
const navegador = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const celular = { ...devices['iPhone 13'] };
delete celular.defaultBrowserType;

let n = 0;
async function capturar(pagina, nome) {
  if (!pastaCapturas) return;
  n += 1;
  await pagina.screenshot({ path: path.join(pastaCapturas, `${String(n).padStart(2, '0')}-${nome}.png`), fullPage: true });
}

const erros = [];
function vigiar(pagina) {
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('response', (r) => { if (r.status() >= 400) erros.push(`${r.status()} ${r.url()}`); });
}

// Simula o menu de compartilhar do celular e guarda o que foi compartilhado.
const simularCompartilhar = () => {
  window.compartilhados = [];
  navigator.share = async (dados) => {
    window.compartilhados.push({ texto: dados.text, arquivos: (dados.files ?? []).map((f) => ({ nome: f.name, tipo: f.type, tamanho: f.size })) });
  };
  navigator.canShare = (dados) => !dados.files || dados.files.every((f) => f.type.startsWith('audio/'));
};

async function comecar(pagina, para, de) {
  await pagina.getByRole('button', { name: 'Preparar meu agradecimento' }).click();
  await pagina.getByLabel('Para quem vai esse carinho?').fill(para);
  await pagina.getByLabel('Como você quer assinar?').fill(de);
  await pagina.getByRole('button', { name: 'Continuar' }).click();
}

try {
  // ---------- Quem agradece: bilhete ----------
  const ctxA = await navegador.newContext({ ...celular, permissions: ['microphone'] });
  await ctxA.addInitScript(simularCompartilhar);
  const a = await ctxA.newPage();
  vigiar(a);
  await a.goto(`${base}sacola/`);
  await a.getByRole('heading', { name: 'Um carinho merece outro.' }).waitFor();
  assert.equal(new URL(a.url()).pathname, '/tete/');
  await capturar(a, 'inicio');

  await a.getByRole('button', { name: 'Preparar meu agradecimento' }).click();
  await a.getByRole('button', { name: 'Continuar' }).click();
  await a.getByText('Conte para quem vai esse carinho.').waitFor();
  await a.getByLabel('Para quem vai esse carinho?').fill('Marina');
  await a.getByLabel('Como você quer assinar?').fill('Ana');
  await a.getByRole('button', { name: 'Continuar' }).click();
  await a.getByRole('heading', { name: 'O que tornou esse presente especial?' }).waitFor();
  await capturar(a, 'palavras');

  await a.getByRole('button', { name: 'Prefiro escrever um bilhete' }).click();
  const campo = a.getByRole('textbox', { name: 'Bilhete' });
  await a.getByRole('button', { name: 'Você lembrou de mim.' }).click();
  await campo.press('End');
  await campo.pressSequentially(' Os macarons estavam lindos!');
  await capturar(a, 'bilhete');
  await a.getByRole('button', { name: 'Ver como vai ficar' }).click();

  await a.getByRole('heading', { name: 'Marina, tem um carinho de volta para você.' }).waitFor();
  await a.getByText('O bilhete vai dentro do próprio link').waitFor();
  await capturar(a, 'previa-envelope');
  await a.locator('.envelope').click({ force: true }); // o envelope flutua suavemente
  await a.locator('.carta').waitFor();
  await a.waitForTimeout(800);
  await capturar(a, 'previa-carta');

  await a.getByRole('button', { name: 'Editar' }).click();
  await a.getByRole('heading', { name: 'Seu bilhete' }).waitFor();
  assert.equal(await campo.inputValue(), 'Você lembrou de mim. Os macarons estavam lindos!');
  await a.getByRole('button', { name: 'Ver como vai ficar' }).click();
  await a.getByRole('button', { name: 'Está pronto' }).click();

  await a.getByRole('heading', { name: 'Seu carinho está pronto para fazer o caminho de volta.' }).waitFor();
  assert.equal(await a.getByRole('button', { name: 'Compartilhar o áudio' }).isVisible(), false);
  await capturar(a, 'pronto-bilhete');
  await a.getByRole('button', { name: 'Compartilhar', exact: true }).click();
  const [envio] = await a.evaluate(() => window.compartilhados);
  const [mensagem, linkBilhete] = envio.texto.split('\n');
  assert.equal(mensagem, 'Marina, seu presente deixou meu dia mais doce. Preparei um carinho de volta para você 💛');
  assert.match(linkBilhete, /\/tete\/c\/#z[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(linkBilhete, /Marina|Ana/);

  // ---------- Quem recebe o bilhete ----------
  const ctxB = await navegador.newContext({ ...celular });
  const b = await ctxB.newPage();
  vigiar(b);
  await b.goto(linkBilhete);
  await b.getByRole('heading', { name: 'Marina, tem um carinho de volta para você.' }).waitFor();
  await b.getByText('De Ana.').waitFor();
  await capturar(b, 'recebe-envelope');
  await b.getByRole('button', { name: 'Abrir meu agradecimento' }).click();
  await b.getByText('Você lembrou de mim. Os macarons estavam lindos!').waitFor();
  await b.waitForTimeout(800);
  await capturar(b, 'recebe-bilhete');
  assert.equal(await b.locator('.carta-assinatura .nome').textContent(), 'Ana');
  const [download] = await Promise.all([
    b.waitForEvent('download'),
    b.getByRole('button', { name: 'Guardar o bilhete como imagem' }).click(),
  ]);
  assert.equal(download.suggestedFilename(), 'bilhete-de-Ana.png');

  // ---------- Quem agradece: áudio ----------
  await a.goto(base);
  await comecar(a, 'Dona Helena', 'Beto');
  await a.getByRole('button', { name: 'Gravar minha mensagem' }).click();
  await a.getByText('Dona Helena vai ouvir exatamente assim').waitFor();
  await a.getByRole('button', { name: 'Começar a gravar' }).click();
  await a.getByText('Gravando… toque para parar').waitFor();
  await a.waitForTimeout(2200);
  await capturar(a, 'gravando');
  await a.getByRole('button', { name: 'Parar gravação' }).click();
  await a.getByText('Ouça antes de seguir:').waitFor();
  await capturar(a, 'revisao');
  await a.getByRole('button', { name: 'Apagar e gravar de novo' }).click();
  await a.getByRole('button', { name: 'Começar a gravar' }).click();
  await a.waitForTimeout(1800);
  await a.getByRole('button', { name: 'Parar gravação' }).click();
  await a.getByRole('button', { name: 'Ver como vai ficar' }).click();
  await a.getByText('Você vai enviar duas coisas na mesma conversa').waitFor();
  await a.getByRole('button', { name: 'Está pronto' }).click();
  await a.getByRole('heading', { name: 'Envie seu áudio na mesma conversa' }).waitFor();
  await capturar(a, 'pronto-audio');

  await a.getByRole('button', { name: 'Compartilhar', exact: true }).click();
  await a.getByRole('button', { name: 'Compartilhar o áudio' }).click();
  const [envioLink, envioAudio] = await a.evaluate(() => window.compartilhados);
  const linkAudio = envioLink.texto.split('\n').pop();
  assert.equal(envioAudio.arquivos.length, 1);
  assert.match(envioAudio.arquivos[0].nome, /^carinho-para-dona-helena\.(m4a|weba|ogg)$/);
  assert.ok(envioAudio.arquivos[0].tamanho > 1000);
  const baixar = a.getByRole('link', { name: 'Ou baixe o áudio para anexar' });
  assert.match(await baixar.getAttribute('href'), /^blob:/);

  // ---------- Quem recebe o carinho com áudio ----------
  await b.goto(linkAudio);
  await b.getByRole('button', { name: 'Abrir meu agradecimento' }).click();
  await b.getByText('Beto gravou uma mensagem de voz para você.').waitFor();
  await b.waitForTimeout(800);
  await capturar(b, 'recebe-audio');

  // ---------- Microfone negado oferece o bilhete ----------
  const ctxC = await navegador.newContext({ ...celular });
  await ctxC.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('negado', 'NotAllowedError'));
  });
  const c = await ctxC.newPage();
  vigiar(c);
  await c.goto(base);
  await comecar(c, 'Lia', 'Rafa');
  await c.getByRole('button', { name: 'Gravar minha mensagem' }).click();
  await c.getByRole('button', { name: 'Começar a gravar' }).click();
  await c.getByText('Sem acesso ao microfone').waitFor();
  await capturar(c, 'microfone-negado');
  await c.getByRole('button', { name: 'Escrever bilhete' }).click();
  await c.getByRole('heading', { name: 'Seu bilhete' }).waitFor();

  // ---------- Link cortado ----------
  await b.goto(linkBilhete.slice(0, -12));
  await b.getByRole('heading', { name: 'Não conseguimos abrir este carinho.' }).waitFor();
  await capturar(b, 'link-cortado');

  assert.deepEqual(erros, []);
  console.log('E2E ok: bilhete, áudio, compartilhamento, recebimento, download, microfone negado e link cortado.');
} finally {
  await navegador.close();
  await fechar();
}
