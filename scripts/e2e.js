// Percurso completo no navegador, em tela de celular, com microfone simulado pelo Chromium.
// Uso: npm run e2e [-- pasta-para-capturas]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { carregarConfig } from '../server/config.js';
import { criarApp } from '../server/app.js';

const pastaCapturas = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (pastaCapturas) fs.mkdirSync(pastaCapturas, { recursive: true });

const pastaDados = fs.mkdtempSync(path.join(os.tmpdir(), 'carinho-e2e-'));
const { app, encerrar } = criarApp(carregarConfig({ DATA_DIR: pastaDados }));
const servidor = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${servidor.address().port}`;

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const celular = { ...devices['iPhone 13'], defaultBrowserType: undefined };
delete celular.defaultBrowserType;

let n = 0;
async function capturar(pagina, nome) {
  if (!pastaCapturas) return;
  n += 1;
  await pagina.screenshot({ path: path.join(pastaCapturas, `${String(n).padStart(2, '0')}-${nome}.png`), fullPage: true });
}

const errosConsole = [];
function vigiar(pagina) {
  pagina.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text()); });
  pagina.on('pageerror', (e) => errosConsole.push(e.message));
}

try {
  // ---------- Quem agradece: áudio ----------
  const ctxA = await navegador.newContext({ ...celular, permissions: ['microphone'], reducedMotion: 'no-preference' });
  const a = await ctxA.newPage();
  vigiar(a);
  await a.goto(`${base}/sacola`);
  await a.getByRole('heading', { name: 'Um carinho merece outro.' }).waitFor();
  await capturar(a, 'inicio');

  await a.getByRole('button', { name: 'Preparar meu agradecimento' }).click();
  await a.getByRole('button', { name: 'Continuar' }).click();
  await a.getByText('Conte para quem vai esse carinho.').waitFor();
  await a.getByLabel('Para quem vai esse carinho?').fill('Marina');
  await a.getByLabel('Como você quer assinar?').fill('Ana');
  await capturar(a, 'nomes');
  await a.getByRole('button', { name: 'Continuar' }).click();

  await a.getByRole('heading', { name: 'O que tornou esse presente especial?' }).waitFor();
  await capturar(a, 'palavras');
  await a.getByRole('button', { name: 'Gravar minha mensagem' }).click();
  await a.getByText('Marina vai ouvir exatamente assim').waitFor();

  await a.getByRole('button', { name: 'Começar a gravar' }).click();
  await a.getByText('Gravando… toque para parar').waitFor();
  await a.waitForTimeout(2600);
  await capturar(a, 'gravando');
  await a.getByRole('button', { name: 'Parar gravação' }).click();
  await a.getByText('Ouça antes de seguir:').waitFor();
  await capturar(a, 'revisao');

  // Apagar e gravar de novo
  await a.getByRole('button', { name: 'Apagar e gravar de novo' }).click();
  await a.getByRole('button', { name: 'Começar a gravar' }).click();
  await a.waitForTimeout(1800);
  await a.getByRole('button', { name: 'Parar gravação' }).click();
  await a.getByRole('button', { name: 'Ver como vai ficar' }).click();

  await a.getByRole('heading', { name: 'Marina, tem um carinho de volta para você.' }).waitFor();
  await a.getByText('qualquer pessoa com o link poderá abrir').waitFor();
  await capturar(a, 'previa-envelope');
  await a.locator('.envelope').click({ force: true }); // o envelope flutua suavemente
  await a.waitForTimeout(900);
  await capturar(a, 'previa-abrindo');
  await a.locator('.carta').waitFor();
  await a.waitForTimeout(800);
  await capturar(a, 'previa-carta');

  // Editar volta para a gravação mantendo o áudio
  await a.getByRole('button', { name: 'Editar' }).click();
  await a.getByText('Ouça antes de seguir:').waitFor();
  await a.getByRole('button', { name: 'Ver como vai ficar' }).click();

  await a.getByRole('button', { name: 'Está pronto' }).click();
  await a.getByRole('heading', { name: 'Seu carinho está pronto para fazer o caminho de volta.' }).waitFor();
  const linkGerenciar = await a.locator('#link-gerenciar').textContent();
  const texto = await a.locator('#texto-envio').inputValue();
  assert.equal(texto, 'Marina, seu presente deixou meu dia mais doce. Preparei um carinho de volta para você 💛');
  const id = linkGerenciar.match(/gerenciar\/([^#]+)/)[1];
  await capturar(a, 'pronto');

  // ---------- Quem recebe ----------
  const ctxB = await navegador.newContext({ ...celular });
  const b = await ctxB.newPage();
  vigiar(b);
  await b.goto(`${base}/c/${id}`);
  await b.getByRole('heading', { name: 'Marina, tem um carinho de volta para você.' }).waitFor();
  await b.getByText('De Ana.').waitFor();
  await capturar(b, 'recebe-envelope');
  await b.getByRole('button', { name: 'Abrir meu agradecimento' }).click();
  await b.locator('.carta').waitFor();
  await b.waitForTimeout(800);
  await capturar(b, 'recebe-carta-audio');
  assert.equal(await b.locator('.carta-assinatura .nome').textContent(), 'Ana');
  const baixar = b.getByRole('link', { name: 'Guardar o áudio no celular' });
  assert.equal(await baixar.getAttribute('href'), `/api/mensagens/${id}/audio?baixar`);
  const audioOk = await b.evaluate(async (url) => (await fetch(url)).headers.get('content-type'), `/api/mensagens/${id}/audio`);
  assert.equal(audioOk, 'audio/webm');
  // O áudio gravado toca até o fim e oferece "Ouvir de novo".
  await b.getByRole('button', { name: 'Ouvir de novo' }).waitFor({ timeout: 8000 });

  // ---------- Bilhete escrito, com microfone negado ----------
  const ctxC = await navegador.newContext({ ...celular, permissions: [] });
  const c = await ctxC.newPage();
  vigiar(c);
  await c.goto(base);
  await c.getByRole('button', { name: 'Preparar meu agradecimento' }).click();
  await c.getByLabel('Para quem vai esse carinho?').fill('Dona Helena');
  await c.getByLabel('Como você quer assinar?').fill('Beto');
  await c.getByRole('button', { name: 'Continuar' }).click();
  await c.getByRole('button', { name: 'Prefiro escrever um bilhete' }).click();
  await c.getByRole('button', { name: 'Seu carinho chegou na hora certa.' }).click();
  await c.getByRole('textbox', { name: 'Bilhete' }).press('End');
  await c.getByRole('textbox', { name: 'Bilhete' }).pressSequentially(' Os macarons estavam lindos!');
  await capturar(c, 'bilhete');
  await c.getByRole('button', { name: 'Ver como vai ficar' }).click();
  await c.getByRole('button', { name: 'Está pronto' }).click();
  await c.getByRole('heading', { name: 'Seu carinho está pronto para fazer o caminho de volta.' }).waitFor();
  const linkBilhete = (await c.locator('#link-gerenciar').textContent()).replace('/gerenciar/', '/c/').replace(/#.*/, '');

  const d = await ctxB.newPage();
  vigiar(d);
  await d.goto(linkBilhete);
  await d.getByRole('button', { name: 'Abrir meu agradecimento' }).click();
  await d.getByText('Seu carinho chegou na hora certa. Os macarons estavam lindos!').waitFor();
  await d.waitForTimeout(800);
  await capturar(d, 'recebe-bilhete');
  const [download] = await Promise.all([
    d.waitForEvent('download'),
    d.getByRole('button', { name: 'Guardar o bilhete como imagem' }).click(),
  ]);
  assert.equal(download.suggestedFilename(), 'bilhete-de-Beto.png');

  // Microfone negado oferece o bilhete
  await c.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('negado', 'NotAllowedError'));
  });
  await c.goto(base);
  await c.getByRole('button', { name: 'Preparar meu agradecimento' }).click();
  await c.getByLabel('Para quem vai esse carinho?').fill('Lia');
  await c.getByLabel('Como você quer assinar?').fill('Rafa');
  await c.getByRole('button', { name: 'Continuar' }).click();
  await c.getByRole('button', { name: 'Gravar minha mensagem' }).click();
  await c.getByRole('button', { name: 'Começar a gravar' }).click();
  await c.getByText('Sem acesso ao microfone').waitFor();
  await capturar(c, 'microfone-negado');
  await c.getByRole('button', { name: 'Escrever bilhete' }).click();
  await c.getByRole('heading', { name: 'Seu bilhete' }).waitFor();

  // ---------- Gerenciar e excluir ----------
  await a.goto(linkGerenciar);
  await a.getByRole('heading', { name: 'Para Marina, de Ana' }).waitFor();
  await capturar(a, 'gerenciar');
  await a.getByRole('button', { name: 'Excluir agora' }).click();
  await a.getByRole('button', { name: 'Sim, excluir' }).click();
  await a.getByRole('heading', { name: 'Pronto. O carinho foi excluído.' }).waitFor();

  await b.goto(`${base}/c/${id}`);
  await b.getByRole('heading', { name: 'Não encontramos este carinho.' }).waitFor();
  await capturar(b, 'link-excluido');

  const esperados = (t) => /status of 404/.test(t); // a página excluída consulta a API e recebe 404
  assert.deepEqual(errosConsole.filter((t) => !esperados(t)), []);
  console.log('E2E ok: áudio, bilhete, microfone negado, recebimento, download e exclusão.');
} finally {
  await navegador.close();
  await new Promise((r) => servidor.close(r));
  encerrar();
  fs.rmSync(pastaDados, { recursive: true, force: true });
}
