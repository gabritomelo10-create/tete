// Página de quem recebe: envelope personalizado → abrir → ouvir ou ler → guardar.
import {
  el, icones, criarEnvelope, abrirEnvelope, criarCarta, brilhos, api, formatarData,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const id = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] ?? '');

function indisponivel(expirou) {
  document.title = 'Um carinho de volta';
  conteudo.replaceChildren(el('div', { class: 'cena' },
    el('h2', { text: expirou ? 'Este carinho já completou seu tempo por aqui.' : 'Não encontramos este carinho.' }),
    el('div', { class: 'filete', 'aria-hidden': 'true' }),
    el('p', {
      class: 'lead',
      text: expirou
        ? 'Os agradecimentos ficam disponíveis por um período e depois são apagados com cuidado.'
        : 'O link pode estar incompleto, ou a mensagem foi excluída por quem a preparou.',
    }),
    el('p', { class: 'nota', text: 'Se quiser, peça para quem enviou preparar outro.' })));
}

function falhaConexao() {
  conteudo.replaceChildren(el('div', { class: 'cena' },
    el('h2', { text: 'A conexão oscilou.' }),
    el('p', { class: 'lead', text: 'Seu carinho continua guardado. Confira a internet e tente de novo.' }),
    el('div', { class: 'acoes' },
      el('button', { type: 'button', class: 'botao botao-principal', text: 'Tentar de novo', onclick: carregar }))));
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

// Gera uma imagem do bilhete para guardar no celular.
async function guardarBilhete(dados) {
  await Promise.all([
    document.fonts.load('80px "Pinyon Script"'),
    document.fonts.load('44px "Cormorant Garamond"'),
    document.fonts.load('italic 36px "Cormorant Garamond"'),
  ]).catch(() => {});
  const L = 1080;
  const margem = 120;
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = '46px "Cormorant Garamond", serif';
  const linhas = quebrarLinhas(medir, dados.bilhete, L - margem * 2);
  const A = Math.max(1350, 520 + linhas.length * 66 + 360);

  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fcf8f0';
  ctx.fillRect(0, 0, L, A);
  ctx.strokeStyle = 'rgba(184,145,74,.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, L - 80, A - 80);
  ctx.strokeRect(52, 52, L - 104, A - 104);

  ctx.fillStyle = '#8a672b';
  ctx.textAlign = 'center';
  ctx.font = '500 30px "Cormorant Garamond", serif';
  ctx.letterSpacing = '10px';
  ctx.fillText('TETÊ', L / 2, 150);
  ctx.letterSpacing = '0px';
  ctx.font = '40px "Pinyon Script", cursive';
  ctx.fillStyle = '#b8914a';
  ctx.fillText('Atelier Sucré', L / 2, 200);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#4a3a2a';
  ctx.font = '84px "Pinyon Script", cursive';
  ctx.fillText(`${dados.para},`, margem, 360);
  ctx.font = '46px "Cormorant Garamond", serif';
  let y = 460;
  for (const linha of linhas) {
    ctx.fillText(linha, margem, y);
    y += 66;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7b6650';
  ctx.font = 'italic 38px "Cormorant Garamond", serif';
  ctx.fillText('Com carinho,', L - margem, y + 60);
  ctx.fillStyle = '#4a3a2a';
  ctx.font = '72px "Pinyon Script", cursive';
  ctx.fillText(dados.de, L - margem, y + 140);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7b6650';
  ctx.font = 'italic 32px "Cormorant Garamond", serif';
  ctx.fillText('Celebre o que torna a vida mais doce.', L / 2, A - 110);

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: `bilhete-de-${dados.de}.png` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function mostrarCarta(dados) {
  const { carta, player } = criarCarta({ ...dados, audioSrc: dados.audioUrl });
  carta.classList.add('revelando');
  const guardar = el('div', { class: 'guardar' });

  if (player) {
    const ouvirDeNovo = el('button', { type: 'button', class: 'botao botao-secundario', hidden: true },
      icones.repetir(), 'Ouvir de novo');
    ouvirDeNovo.addEventListener('click', () => player.reiniciar().catch(() => {}));
    player.elemento.addEventListener('terminou', () => { ouvirDeNovo.hidden = false; });
    guardar.append(
      ouvirDeNovo,
      el('a', { class: 'botao botao-texto', href: `${dados.audioUrl}?baixar`, download: '' },
        icones.baixar(), 'Guardar o áudio no celular'),
    );
    // O toque em "abrir" conta como gesto do usuário; se o navegador ainda assim bloquear, basta tocar no play.
    player.tocar().catch(() => {});
  } else {
    guardar.append(el('button', {
      type: 'button',
      class: 'botao botao-texto',
      onclick: () => guardarBilhete(dados),
    }, icones.baixar(), 'Guardar o bilhete como imagem'));
  }

  conteudo.replaceChildren(
    el('div', { class: 'cena' },
      carta,
      guardar,
      el('p', { class: 'validade', text: `Disponível para ${player ? 'ouvir' : 'ler'} e guardar até ${formatarData(dados.expiraEm)}.` })),
  );
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
    el('div', { class: 'acoes' }, botao)));
}

async function carregar() {
  try {
    const resposta = await api(`/api/mensagens/${encodeURIComponent(id)}`);
    if (resposta.ok) mostrarEnvelope(resposta.dados);
    else if (resposta.status === 410) indisponivel(true);
    else if (resposta.status === 404 || resposta.status === 400) indisponivel(false);
    else falhaConexao();
  } catch {
    falhaConexao();
  }
}

brilhos(10);
carregar();
