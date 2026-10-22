import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empacotar, desempacotar } from '../js/pacote.js';

test('o bilhete vai e volta dentro do link, sem nomes legíveis', async () => {
  const dados = { para: 'Marina', de: 'Ana', bilhete: 'Você lembrou de mim.\nObrigada! 💛' };
  const pacote = await empacotar(dados);
  assert.match(pacote, /^z[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(pacote, /Marina|Ana/);
  assert.deepEqual(await desempacotar(`#${pacote}`), dados);
});

test('um bilhete longo ainda gera um link curto o bastante para o WhatsApp', async () => {
  const bilhete = 'Seu carinho chegou na hora certa. Os macarons estavam lindos e deliciosos! '.repeat(8).slice(0, 600);
  const pacote = await empacotar({ para: 'Marina', de: 'Ana', bilhete });
  assert.ok(pacote.length < 1200, `pacote com ${pacote.length} caracteres`);
});

test('formato sem compressão também é lido', async () => {
  const json = JSON.stringify({ p: 'Lia', d: 'Rafa', b: 'Oi' });
  const pacote = `j${Buffer.from(json).toString('base64url')}`;
  assert.deepEqual(await desempacotar(pacote), { para: 'Lia', de: 'Rafa', bilhete: 'Oi' });
});

test('links cortados, adulterados ou incompletos não abrem', async () => {
  const pacote = await empacotar({ para: 'Marina', de: 'Ana', bilhete: 'Oi' });
  const invalidos = [
    '', '#', '#x123', pacote.slice(0, 8), `${pacote}%%`,
    `j${Buffer.from(JSON.stringify({ p: 'Marina', d: 'Ana' })).toString('base64url')}`,
    `j${Buffer.from(JSON.stringify({ p: 'Marina', d: 'Ana', a: 1 })).toString('base64url')}`,
    `j${Buffer.from(JSON.stringify({ p: 'x'.repeat(41), d: 'Ana', b: 'oi' })).toString('base64url')}`,
    `j${Buffer.from(JSON.stringify({ p: 'Marina', d: 'Ana', b: 'x'.repeat(601) })).toString('base64url')}`,
    `j${Buffer.from('não é json').toString('base64url')}`,
  ];
  for (const texto of invalidos) assert.equal(await desempacotar(texto), null, texto);
});

test('limpa espaços e caracteres de controle', async () => {
  const pacote = await empacotar({ para: '  Marina \u0000 Souza ', de: 'Ana​', bilhete: 'Linha 1\r\n\r\n\r\n\r\nLinha 2' });
  assert.deepEqual(await desempacotar(pacote), { para: 'Marina Souza', de: 'Ana', bilhete: 'Linha 1\n\nLinha 2' });
});

test('recusa dados incompletos ao montar', async () => {
  await assert.rejects(empacotar({ para: '', de: 'Ana', bilhete: 'oi' }));
  await assert.rejects(empacotar({ para: 'Marina', de: 'Ana', bilhete: '  ' }));
});
