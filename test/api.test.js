import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { carregarConfig } from '../server/config.js';
import { criarApp } from '../server/app.js';

const DIA = 24 * 60 * 60 * 1000;
// Cabeçalhos mínimos de cada formato, seguidos de bytes quaisquer.
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2048, 7)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(2048, 3)]);

let ctx;

async function iniciar(env = {}) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'carinho-'));
  const config = carregarConfig({ DATA_DIR: pasta, ...env });
  const relogio = { agora: Date.UTC(2026, 11, 1) };
  const { app, limparExpiradas, encerrar } = criarApp(config, { agora: () => relogio.agora });
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;
  ctx = { pasta, config, relogio, base, servidor, limparExpiradas, encerrar };
  return ctx;
}

async function parar() {
  if (!ctx) return;
  await new Promise((r) => ctx.servidor.close(r));
  ctx.encerrar();
  fs.rmSync(ctx.pasta, { recursive: true, force: true });
  ctx = null;
}

const criar = (corpo) => fetch(`${ctx.base}/api/mensagens`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo),
});

const audios = () => fs.readdirSync(ctx.config.pastaAudios);

beforeEach(() => iniciar());
afterEach(parar);

test('cria um bilhete e devolve link difícil de adivinhar, sem nomes no endereço', async () => {
  const r = await criar({ para: 'Marina', de: 'Ana', tipo: 'bilhete', bilhete: 'Você lembrou de mim.' });
  assert.equal(r.status, 201);
  const dados = await r.json();
  assert.match(dados.id, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(dados.link, `${ctx.base}/c/${dados.id}`);
  assert.doesNotMatch(dados.link, /Marina|Ana/);
  assert.match(dados.linkGerenciar, new RegExp(`/gerenciar/${dados.id}#chave=[A-Za-z0-9_-]{43}$`));
  assert.equal(new Date(dados.expiraEm).getTime(), ctx.relogio.agora + 90 * DIA);

  const lida = await (await fetch(`${ctx.base}/api/mensagens/${dados.id}`)).json();
  assert.deepEqual(
    { para: lida.para, de: lida.de, tipo: lida.tipo, bilhete: lida.bilhete, audioUrl: lida.audioUrl },
    { para: 'Marina', de: 'Ana', tipo: 'bilhete', bilhete: 'Você lembrou de mim.', audioUrl: undefined },
  );
  assert.equal(lida.chave_gestao, undefined);
});

test('usa PUBLIC_URL para montar os links quando configurado', async () => {
  await parar();
  await iniciar({ PUBLIC_URL: 'https://carinho.exemplo.com.br/' });
  const dados = await (await criar({ para: 'Marina', de: 'Ana', tipo: 'bilhete', bilhete: 'Oi' })).json();
  assert.equal(dados.link, `https://carinho.exemplo.com.br/c/${dados.id}`);
});

test('salva áudio em armazenamento privado e serve só pela rota controlada, com Range', async () => {
  const r = await criar({ para: 'Marina', de: 'Ana Luíza', tipo: 'audio', audio: WEBM.toString('base64'), duracaoMs: 4200 });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.deepEqual(audios(), [`${id}.webm`]);

  const lida = await (await fetch(`${ctx.base}/api/mensagens/${id}`)).json();
  assert.equal(lida.audioUrl, `/api/mensagens/${id}/audio`);
  assert.equal(lida.duracaoMs, 4200);

  const audio = await fetch(`${ctx.base}${lida.audioUrl}`);
  assert.equal(audio.status, 200);
  assert.equal(audio.headers.get('content-type'), 'audio/webm');
  assert.match(audio.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Buffer.from(await audio.arrayBuffer()), WEBM);

  const parcial = await fetch(`${ctx.base}${lida.audioUrl}`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(parcial.status, 206);
  assert.equal((await parcial.arrayBuffer()).byteLength, 10);

  const baixar = await fetch(`${ctx.base}${lida.audioUrl}?baixar`);
  assert.match(baixar.headers.get('content-disposition'), /attachment; filename="?carinho-de-ana-luiza\.webm"?/);

  // A pasta de dados não é exposta como arquivo estático.
  assert.equal((await fetch(`${ctx.base}/audios/${id}.webm`)).status, 404);
  assert.equal((await fetch(`${ctx.base}/data/audios/${id}.webm`)).status, 404);
});

test('reconhece áudio do iPhone (MP4) pelo conteúdo', async () => {
  const { id } = await (await criar({ para: 'M', de: 'A', tipo: 'audio', audio: MP4.toString('base64') })).json();
  assert.deepEqual(audios(), [`${id}.m4a`]);
  const audio = await fetch(`${ctx.base}/api/mensagens/${id}/audio`);
  assert.equal(audio.headers.get('content-type'), 'audio/mp4');
});

test('recusa dados inválidos', async () => {
  const casos = [
    [{ de: 'Ana', tipo: 'bilhete', bilhete: 'oi' }, 400],
    [{ para: '   ', de: 'Ana', tipo: 'bilhete', bilhete: 'oi' }, 400],
    [{ para: 'Marina', tipo: 'bilhete', bilhete: 'oi' }, 400],
    [{ para: 'x'.repeat(41), de: 'Ana', tipo: 'bilhete', bilhete: 'oi' }, 400],
    [{ para: 'Marina', de: 'Ana', tipo: 'bilhete', bilhete: '' }, 400],
    [{ para: 'Marina', de: 'Ana', tipo: 'bilhete', bilhete: 'x'.repeat(601) }, 400],
    [{ para: 'Marina', de: 'Ana', tipo: 'video' }, 400],
    [{ para: 'Marina', de: 'Ana', tipo: 'audio' }, 400],
    [{ para: 'Marina', de: 'Ana', tipo: 'audio', audio: 'não é base64!' }, 400],
    [{ para: 'Marina', de: 'Ana', tipo: 'audio', audio: Buffer.from('<html>texto qualquer</html>').toString('base64') }, 415],
  ];
  for (const [corpo, status] of casos) {
    const r = await criar(corpo);
    assert.equal(r.status, status, JSON.stringify(corpo));
    assert.ok((await r.json()).erro);
  }
  assert.deepEqual(audios(), []);
});

test('recusa áudio maior que o limite', async () => {
  await parar();
  await iniciar({ MAX_AUDIO_BYTES: '4096' });
  const grande = Buffer.concat([WEBM, Buffer.alloc(4096)]);
  const r = await criar({ para: 'M', de: 'A', tipo: 'audio', audio: grande.toString('base64') });
  assert.equal(r.status, 413);
  assert.deepEqual(audios(), []);
});

test('limpa espaços e caracteres de controle dos nomes', async () => {
  const { id } = await (await criar({ para: '  Marina \u0000 Souza ', de: 'Ana​', tipo: 'bilhete', bilhete: 'Linha 1\r\n\r\n\r\n\r\nLinha 2' })).json();
  const lida = await (await fetch(`${ctx.base}/api/mensagens/${id}`)).json();
  assert.equal(lida.para, 'Marina Souza');
  assert.equal(lida.de, 'Ana');
  assert.equal(lida.bilhete, 'Linha 1\n\nLinha 2');
});

test('exclui somente com a chave de gerenciamento correta', async () => {
  const dados = await (await criar({ para: 'M', de: 'A', tipo: 'audio', audio: WEBM.toString('base64') })).json();
  const chave = new URL(dados.linkGerenciar).hash.replace('#chave=', '');
  const excluir = (c) => fetch(`${ctx.base}/api/mensagens/${dados.id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chave: c }),
  });

  assert.equal((await excluir('chave-errada')).status, 404);
  assert.equal((await excluir(undefined)).status, 404);
  assert.equal((await fetch(`${ctx.base}/api/mensagens/${dados.id}`)).status, 200);

  assert.equal((await excluir(chave)).status, 204);
  assert.equal((await fetch(`${ctx.base}/api/mensagens/${dados.id}`)).status, 404);
  assert.equal((await fetch(`${ctx.base}/api/mensagens/${dados.id}/audio`)).status, 404);
  assert.deepEqual(audios(), []);
  assert.equal((await excluir(chave)).status, 404);
});

test('mensagens expiram após o prazo e a limpeza apaga os arquivos', async () => {
  const a = await (await criar({ para: 'M', de: 'A', tipo: 'audio', audio: WEBM.toString('base64') })).json();
  const b = await (await criar({ para: 'M', de: 'A', tipo: 'audio', audio: MP4.toString('base64') })).json();
  assert.equal(audios().length, 2);

  ctx.relogio.agora += 90 * DIA - 1000;
  assert.equal((await fetch(`${ctx.base}/api/mensagens/${a.id}`)).status, 200);

  ctx.relogio.agora += 1000;
  // Ao tentar abrir depois do prazo: "expirou" e o conteúdo some na hora.
  assert.equal((await fetch(`${ctx.base}/api/mensagens/${a.id}`)).status, 410);
  assert.deepEqual(audios(), [`${b.id}.m4a`]);

  assert.equal(await ctx.limparExpiradas(), 1);
  assert.deepEqual(audios(), []);
  assert.equal((await fetch(`${ctx.base}/api/mensagens/${b.id}/audio`)).status, 404);
});

test('limita criações excessivas por IP', async () => {
  await parar();
  await iniciar({ RATE_LIMIT_MAX: '3' });
  const corpo = { para: 'M', de: 'A', tipo: 'bilhete', bilhete: 'oi' };
  for (let i = 0; i < 3; i += 1) assert.equal((await criar(corpo)).status, 201);
  const bloqueada = await criar(corpo);
  assert.equal(bloqueada.status, 429);
  assert.ok(Number(bloqueada.headers.get('retry-after')) > 0);

  ctx.relogio.agora += 60 * 60 * 1000 + 1;
  assert.equal((await criar(corpo)).status, 201);
});

test('ids inválidos ou inexistentes respondem 404', async () => {
  for (const id of ['curto', 'A'.repeat(22), '..%2F..%2Fetc%2Fpasswd']) {
    assert.equal((await fetch(`${ctx.base}/api/mensagens/${id}`)).status, 404);
    assert.equal((await fetch(`${ctx.base}/api/mensagens/${id}/audio`)).status, 404);
  }
});

test('páginas, QR fixo e cabeçalhos de segurança', async () => {
  const inicio = await fetch(`${ctx.base}/`);
  assert.equal(inicio.status, 200);
  const html = await inicio.text();
  assert.match(html, /Um carinho merece outro\./);
  assert.ok(html.includes(`content="${ctx.base}/img/compartilhar.png"`));
  assert.match(inicio.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(inicio.headers.get('referrer-policy'), 'no-referrer');
  assert.match(inicio.headers.get('permissions-policy'), /microphone=\(self\)/);

  const qr = await fetch(`${ctx.base}/sacola`, { redirect: 'manual' });
  assert.equal(qr.status, 302);
  assert.equal(qr.headers.get('location'), '/');

  const carinho = await fetch(`${ctx.base}/c/qualquer-id`);
  assert.equal(carinho.status, 200);
  assert.match(carinho.headers.get('x-robots-tag'), /noindex/);

  assert.equal((await fetch(`${ctx.base}/gerenciar/abc`)).status, 200);
  assert.equal((await fetch(`${ctx.base}/fonts/pinyon-400.woff2`)).status, 200);
  assert.equal((await fetch(`${ctx.base}/fonts/../../package.json`)).status, 404);
  assert.equal((await fetch(`${ctx.base}/nao-existe`)).status, 404);
});

test('destino do QR pode ser trocado sem reimprimir', async () => {
  await parar();
  await iniciar({ QR_REDIRECT: '/?origem=sacola-natal' });
  const qr = await fetch(`${ctx.base}/sacola`, { redirect: 'manual' });
  assert.equal(qr.headers.get('location'), '/?origem=sacola-natal');
});
