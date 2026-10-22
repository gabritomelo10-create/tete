// O carinho viaja dentro do próprio link, depois do "#": nada fica salvo em servidor,
// e a parte depois do "#" não é enviada a nenhum site quando o link é aberto.
// Formato: "z" + base64url(deflate(JSON)) — ou "j" + base64url(JSON) se o navegador não comprimir.

export const LIMITES = { nome: 40, bilhete: 600 };

const paraBase64url = (bytes) => {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const deBase64url = (texto) => {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
};

async function transformar(bytes, fluxo) {
  const resposta = new Response(new Blob([bytes]).stream().pipeThrough(fluxo));
  return new Uint8Array(await resposta.arrayBuffer());
}

const comprime = () => typeof CompressionStream === 'function';

// Remove caracteres de controle e espaços repetidos; devolve '' se passar do limite.
export function limparTexto(valor, max, { multilinha = false } = {}) {
  if (typeof valor !== 'string') return '';
  let texto = valor.normalize('NFC');
  texto = multilinha
    ? texto.replace(/\r\n?/g, '\n').replace(/[^\P{C}\n]/gu, '').replace(/\n{3,}/g, '\n\n')
    : texto.replace(/\p{C}/gu, '').replace(/\s+/g, ' ');
  texto = texto.trim();
  return [...texto].length > max ? '' : texto;
}

function validar(dados) {
  const para = limparTexto(dados?.p, LIMITES.nome);
  const de = limparTexto(dados?.d, LIMITES.nome);
  const bilhete = limparTexto(dados?.b ?? '', LIMITES.bilhete, { multilinha: true });
  const comAudio = dados?.a === 1;
  if (!para || !de || (!bilhete && !comAudio)) return null;
  return { para, de, bilhete, comAudio };
}

// { para, de, bilhete, comAudio } → texto para colocar depois do "#".
export async function empacotar({ para, de, bilhete, comAudio }) {
  const dados = validar({ p: para, d: de, b: bilhete, a: comAudio ? 1 : undefined });
  if (!dados) throw new Error('Dados incompletos');
  const json = JSON.stringify({
    p: dados.para,
    d: dados.de,
    ...(dados.bilhete ? { b: dados.bilhete } : {}),
    ...(dados.comAudio ? { a: 1 } : {}),
  });
  const bytes = new TextEncoder().encode(json);
  if (comprime()) return `z${paraBase64url(await transformar(bytes, new CompressionStream('deflate-raw')))}`;
  return `j${paraBase64url(bytes)}`;
}

// Texto depois do "#" → { para, de, bilhete, comAudio }, ou null se o link estiver incompleto.
export async function desempacotar(texto) {
  try {
    const conteudo = decodeURIComponent(String(texto).replace(/^#/, '')).trim();
    let bytes = deBase64url(conteudo.slice(1));
    if (conteudo[0] === 'z') bytes = await transformar(bytes, new DecompressionStream('deflate-raw'));
    else if (conteudo[0] !== 'j') return null;
    return validar(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
