// Percurso completo no navegador, em tela de celular.
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
  navigator.share = async (dados) => { window.compartilhados.push(dados.text); };
};

// A abertura com a logo some sozinha; espera ela sair antes de interagir.
const esperarAbertura = (pagina) => pagina.locator('#abertura').waitFor({ state: 'hidden' });

try {
  // ---------- Quem agradece: bilhete ----------
  const ctxA = await navegador.newContext({ ...celular });
  await ctxA.addInitScript(simularCompartilhar);
  const a = await ctxA.newPage();
  vigiar(a);
  await a.goto(`${base}sacola/`);
  await a.locator('#abertura .logo-grande').waitFor();
  await a.waitForTimeout(2300);
  await capturar(a, 'abertura');
  await esperarAbertura(a);
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
  await a.getByRole('heading', { name: 'O que tornou esse presente especial?' }).waitFor();
  assert.equal(await campo.inputValue(), 'Você lembrou de mim. Os macarons estavam lindos!');
  await a.getByRole('button', { name: 'Ver como vai ficar' }).click();
  await a.getByRole('button', { name: 'Está pronto' }).click();

  await a.getByRole('heading', { name: 'Seu carinho está pronto para fazer o caminho de volta.' }).waitFor();
  await capturar(a, 'pronto-bilhete');
  await a.getByRole('button', { name: 'Compartilhar', exact: true }).click();
  const [envio] = await a.evaluate(() => window.compartilhados);
  const [mensagem, linkBilhete] = envio.split('\n');
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

  // ---------- Pular a abertura com um toque ----------
  const c = await ctxB.newPage();
  vigiar(c);
  await c.goto(base);
  await c.locator('#abertura').click();
  await c.locator('#abertura').waitFor({ state: 'detached', timeout: 1500 });
  await c.getByRole('button', { name: 'Preparar meu agradecimento' }).click();
  await c.getByLabel('Para quem vai esse carinho?').waitFor();

  // ---------- Link cortado ----------
  await b.goto(linkBilhete.slice(0, -12));
  await b.getByRole('heading', { name: 'Não conseguimos abrir este carinho.' }).waitFor();
  await capturar(b, 'link-cortado');

  assert.deepEqual(erros, []);
  console.log('E2E ok: abertura, bilhete, prévia, compartilhamento, recebimento, download e link cortado.');
} finally {
  await navegador.close();
  await fechar();
}
