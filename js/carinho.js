// Página de quem recebe: envelope personalizado → abrir → ouvir ou ler → guardar.
import {
  el, icones, criarEnvelope, abrirEnvelope, criarCarta, brilhos,
} from './comum.js';
import { desempacotar } from './pacote.js';

const conteudo = document.getElementById('conteudo');

function indisponivel() {
  document.title = 'Um carinho de volta';
  conteudo.replaceChildren(el('div', { class: 'cena' },
    el('h2', { text: 'Não conseguimos abrir este carinho.' }),
    el('div', { class: 'filete', 'aria-hidden': 'true' }),
    el('p', { class: 'lead', text: 'O link parece ter chegado incompleto. Ele precisa estar inteiro, até o último caractere.' }),
    el('p', { class: 'nota', text: 'Tente tocar no link de novo, direto na conversa, ou peça para quem enviou mandar outra vez.' }),
    el('div', { class: 'acoes' }, el('a', { class: 'botao botao-secundario', href: '../', text: 'Preparar um agradecimento' }))));
}

// Quebra o texto em linhas que caibam na largura do cartão.
function quebrarLinhas(ctx, texto, largura) {
  const linhas = [];
  for (const paragrafo of texto.split('\n')) {
    let linha = '';
    for (const palavra of paragrafo.split(' ')) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (ctx.measureText(tentativa).width > largura && linha) {
        linhas.push(linha);
        linha = palavra;
      } else {
        linha = tentativa;
      }
    }
    linhas.push(linha);
  }
  return linhas;
}

function carregarImagem(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Gera uma imagem do bilhete para guardar no celular, na estética Noël Sucré.
async function guardarBilhete(dados) {
  await Promise.all([
    document.fonts.load('500 40px "Bodoni Moda"'),
    document.fonts.load('italic 40px "Bodoni Moda"'),
    document.fonts.load('600 20px "Manrope"'),
  ]).catch(() => {});
  const bola = await carregarImagem(new URL('../img/bola.svg', import.meta.url).href);
  const L = 1080;
  const margem = 130;
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = '44px "Bodoni Moda", serif';
  const linhas = quebrarLinhas(medir, dados.bilhete, L - margem * 2);
  const A = Math.max(1350, 640 + linhas.length * 68 + 420);

  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d');

  // Moldura vinho com o papel creme por cima
  const fundo = ctx.createRadialGradient(L / 2, 0, 50, L / 2, A / 2, A);
  fundo.addColorStop(0, '#8f1c1c');
  fundo.addColorStop(0.55, '#5a0b10');
  fundo.addColorStop(1, '#2c0507');
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, L, A);
  ctx.fillStyle = '#fbf6ee';
  ctx.fillRect(60, 60, L - 120, A - 120);
  const ouro = ctx.createLinearGradient(0, 0, L, A);
  ouro.addColorStop(0, '#f6ddae');
  ouro.addColorStop(0.45, '#d9ac6c');
  ouro.addColorStop(0.7, '#b07a3c');
  ouro.addColorStop(1, '#e9c68e');
  ctx.strokeStyle = ouro;
  ctx.lineWidth = 2;
  ctx.strokeRect(84, 84, L - 168, A - 168);

  if (bola) ctx.drawImage(bola, L / 2 - 30, 60, 60, 92);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a8743a';
  ctx.font = '500 58px "Bodoni Moda", serif';
  ctx.fillText('Noël', L / 2, 222);
  ctx.font = '600 18px "Manrope", sans-serif';
  ctx.letterSpacing = '12px';
  ctx.fillText('SUCRÉ', L / 2 + 6, 258);
  ctx.letterSpacing = '0px';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#6b1016';
  ctx.font = 'italic 76px "Bodoni Moda", serif';
  ctx.fillText(`${dados.para},`, margem, 410);
  ctx.fillStyle = '#4b0b10';
  ctx.font = '44px "Bodoni Moda", serif';
  let y = 510;
  for (const linha of linhas) {
    ctx.fillText(linha, margem, y);
    y += 68;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a8743a';
  ctx.font = 'italic 36px "Bodoni Moda", serif';
  ctx.fillText('Com carinho,', L - margem, y + 60);
  ctx.fillStyle = '#6b1016';
  ctx.font = 'italic 64px "Bodoni Moda", serif';
  ctx.fillText(dados.de, L - margem, y + 140);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#a8743a';
  ctx.font = 'italic 34px "Bodoni Moda", serif';
  ctx.fillText('Celebre o que torna a vida mais doce.', L / 2, A - 168);
  ctx.font = '600 15px "Manrope", sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('TETÊ ATELIER SUCRÉ', L / 2, A - 124);

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: `bilhete-de-${dados.de}.png` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function mostrarCarta(dados) {
  const { carta } = criarCarta(dados);
  carta.classList.add('revelando');
  const guardar = el('div', { class: 'guardar' }, el('button', {
    type: 'button',
    class: 'botao botao-texto',
    onclick: () => guardarBilhete(dados),
  }, icones.baixar(), 'Guardar o bilhete como imagem'));
  conteudo.replaceChildren(el('div', { class: 'cena' }, carta, guardar));
  conteudo.focus({ preventScroll: true });
}

function mostrarEnvelope(dados) {
  document.title = `${dados.para}, tem um carinho de volta para você`;
  const envelope = criarEnvelope({
    para: dados.para,
    aoAbrir: async () => {
      botao.disabled = true;
      dica.hidden = true;
      botao.hidden = true;
      await abrirEnvelope(envelope);
      mostrarCarta(dados);
    },
  });
  const dica = el('p', { class: 'dica-toque', text: 'Toque no envelope' });
  const botao = el('button', {
    type: 'button',
    class: 'botao botao-principal',
    text: 'Abrir meu agradecimento',
    onclick: () => envelope.click(),
  });
  conteudo.replaceChildren(el('div', { class: 'cena' },
    el('h1', { class: 'cena-titulo', text: `${dados.para}, tem um carinho de volta para você.` }),
    el('p', { class: 'cena-de', text: `De ${dados.de}.` }),
    envelope,
    dica,
    el('div', { class: 'acoes acoes-fixas' }, botao)));
}

async function carregar() {
  const dados = await desempacotar(window.location.hash);
  if (dados) mostrarEnvelope(dados);
  else indisponivel();
}

window.addEventListener('hashchange', carregar);
brilhos();
carregar();
