// Peças compartilhadas entre as páginas: envelope, carta, player, brilhos e utilidades.

export const reduzirMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (nome === 'class') elemento.className = valor;
    else if (nome === 'text') elemento.textContent = valor;
    else if (nome.startsWith('on')) elemento.addEventListener(nome.slice(2), valor);
    else elemento.setAttribute(nome, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho !== null && filho !== undefined && filho !== false) {
      elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
    }
  }
  return elemento;
}

// Ícones são marcação fixa (sem dados do usuário), por isso podem ser inseridos como HTML.
function svg(marcacao) {
  const tpl = document.createElement('template');
  tpl.innerHTML = marcacao.trim();
  return tpl.content.firstElementChild;
}
export const icones = {
  play: () => svg('<svg class="icone-play" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>'),
  pausa: () => svg('<svg class="icone-pausa" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>'),
  baixar: () => svg('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>'),
  repetir: () => svg('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.7h3.7"/></svg>'),
  compartilhar: () => svg('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4m0 0L8 8m4-4 4 4M6 11H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/></svg>'),
  copiar: () => svg('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg>'),
  voz: () => svg('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/></svg>'),
  ok: () => svg('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'),
};

const LACO = `
<svg class="env-laco" viewBox="0 0 140 100" aria-hidden="true">
  <defs>
    <linearGradient id="ouro-laco" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#A42634"/><stop offset=".38" stop-color="#7C1420"/>
      <stop offset=".62" stop-color="#5A0B14"/><stop offset=".85" stop-color="#8E1C28"/><stop offset="1" stop-color="#6A1019"/>
    </linearGradient>
    <linearGradient id="ouro-sombra" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFD9CF" stop-opacity=".28"/><stop offset=".5" stop-color="#FFD9CF" stop-opacity="0"/>
      <stop offset="1" stop-color="#2A0306" stop-opacity=".5"/>
    </linearGradient>
  </defs>
  <g class="ponta ponta-e"><path d="M64 50 L44 96 L53 91 L58 99 L72 54Z" fill="url(#ouro-laco)"/></g>
  <g class="ponta ponta-d"><path d="M76 50 L96 96 L87 91 L82 99 L68 54Z" fill="url(#ouro-laco)"/></g>
  <g class="alca alca-e">
    <path d="M70 48 C52 22 14 14 10 38 C7 60 44 62 70 48Z" fill="url(#ouro-laco)"/>
    <path d="M70 48 C52 30 26 26 20 38 C30 34 50 38 70 48Z" fill="url(#ouro-sombra)"/>
  </g>
  <g class="alca alca-d">
    <path d="M70 48 C88 22 126 14 130 38 C133 60 96 62 70 48Z" fill="url(#ouro-laco)"/>
    <path d="M70 48 C88 30 114 26 120 38 C110 34 90 38 70 48Z" fill="url(#ouro-sombra)"/>
  </g>
  <g class="no"><rect x="60" y="38" width="20" height="21" rx="7" fill="url(#ouro-laco)"/><rect x="60" y="38" width="20" height="21" rx="7" fill="url(#ouro-sombra)"/></g>
</svg>`;

// Envelope creme com laço dourado. Ao tocar, chama aoAbrir().
export function criarEnvelope({ para, aoAbrir, rotulo }) {
  const envelope = el('button', {
    type: 'button',
    class: 'envelope',
    'aria-label': rotulo ?? `Abrir o envelope para ${para}`,
  },
  el('span', { class: 'env-costas' }),
  el('span', { class: 'env-carta' }),
  el('span', { class: 'env-frente' }),
  el('span', { class: 'env-aba' }),
  el('span', { class: 'env-fita-v' }),
  el('span', { class: 'env-fita-h' }),
  svg(LACO),
  el('span', { class: 'env-etiqueta', text: `Para ${para}` }));

  envelope.addEventListener('click', () => {
    if (envelope.classList.contains('abrindo')) return;
    aoAbrir?.();
  }, { once: false });
  return envelope;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Executa a animação de abertura e resolve quando a carta pode aparecer.
export async function abrirEnvelope(envelope) {
  const rapido = reduzirMovimento();
  envelope.classList.add('abrindo');
  envelope.parentElement?.classList.add('abrindo');
  envelope.disabled = true;
  await espera(rapido ? 50 : 1900);
  envelope.classList.add('aberto');
  await espera(rapido ? 50 : 380);
}

export function formatarTempo(segundos) {
  if (!Number.isFinite(segundos) || segundos < 0) segundos = 0;
  const s = Math.floor(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Player com controles próprios. Muitos navegadores informam duração "Infinity" para áudios
// recém-gravados em WebM; nesse caso usamos a duração medida durante a gravação.
export function criarPlayer(src, duracaoMs) {
  const audio = el('audio', { preload: 'metadata', src });
  const barra = el('input', {
    type: 'range', class: 'player-barra', min: '0', max: '1000', value: '0', step: '1',
    'aria-label': 'Posição do áudio',
  });
  const atual = el('span', { text: '0:00' });
  const total = el('span', { text: formatarTempo((duracaoMs ?? 0) / 1000) });
  const botao = el('button', { type: 'button', class: 'player-play', 'aria-label': 'Ouvir mensagem' }, icones.play(), icones.pausa());
  const player = el('div', { class: 'player', 'data-tocando': 'nao' },
    botao,
    el('div', { class: 'player-trilha' }, barra, el('div', { class: 'player-tempos' }, atual, total)),
    audio);

  let arrastando = false;
  const duracao = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (duracaoMs ?? 0) / 1000);
  const pintar = () => {
    const d = duracao();
    const fracao = d ? Math.min(audio.currentTime / d, 1) : 0;
    if (!arrastando) barra.value = String(Math.round(fracao * 1000));
    barra.style.setProperty('--p', `${fracao * 100}%`);
    atual.textContent = formatarTempo(audio.currentTime);
    if (d) total.textContent = formatarTempo(d);
  };

  botao.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  audio.addEventListener('play', () => {
    player.dataset.tocando = 'sim';
    botao.setAttribute('aria-label', 'Pausar');
  });
  audio.addEventListener('pause', () => {
    player.dataset.tocando = 'nao';
    botao.setAttribute('aria-label', 'Ouvir mensagem');
  });
  audio.addEventListener('timeupdate', pintar);
  audio.addEventListener('loadedmetadata', pintar);
  audio.addEventListener('durationchange', pintar);
  audio.addEventListener('ended', () => {
    player.dispatchEvent(new CustomEvent('terminou'));
    pintar();
  });
  barra.addEventListener('input', () => {
    arrastando = true;
    const d = duracao();
    if (d) audio.currentTime = (Number(barra.value) / 1000) * d;
    pintar();
  });
  barra.addEventListener('change', () => { arrastando = false; });

  return {
    elemento: player,
    audio,
    tocar: () => audio.play(),
    reiniciar: () => {
      audio.currentTime = 0;
      return audio.play();
    },
    parar: () => audio.pause(),
  };
}

// Carta revelada dentro do envelope: saudação, bilhete e/ou aviso do áudio, assinatura.
// `audioSrc` só existe na revisão de quem grava; quem recebe ganha o áudio na própria conversa.
export function criarCarta({ para, de, bilhete, comAudio, audioSrc, duracaoMs }) {
  const carta = el('article', { class: 'carta', 'aria-label': `Agradecimento de ${de}` },
    el('p', { class: 'carta-saudacao', text: `${para},` }));
  let player = null;
  if (bilhete) carta.append(el('p', { class: 'carta-bilhete', text: bilhete }));
  if (comAudio && audioSrc) {
    player = criarPlayer(audioSrc, duracaoMs);
    carta.append(el('div', { class: 'carta-audio' }, player.elemento));
  } else if (comAudio) {
    carta.append(el('div', { class: 'carta-voz' },
      icones.voz(),
      el('p', {},
        el('strong', { text: `${de} gravou uma mensagem de voz para você.` }),
        ' Ela chegou junto com este link, na sua conversa. Dê o play por lá.')));
  }
  carta.append(el('p', { class: 'carta-assinatura' }, 'Com carinho,', el('span', { class: 'nome', text: de })));
  return { carta, player };
}

export function brilhos(quantidade = 26) {
  if (reduzirMovimento()) return;
  const camada = el('div', { class: 'brilhos', 'aria-hidden': 'true' });
  for (let i = 0; i < quantidade; i += 1) {
    // Como nas peças da campanha: pontos de luz, estrelinhas de quatro pontas e bokeh desfocado.
    const tipo = i % 5 === 0 ? 'bokeh' : i % 3 === 0 ? 'estrela' : '';
    const ponto = el('span', { class: tipo || undefined });
    const tamanho = tipo === 'bokeh' ? 14 + Math.random() * 18 : tipo === 'estrela' ? 7 + Math.random() * 6 : 2 + Math.random() * 4;
    ponto.style.left = `${Math.random() * 100}%`;
    ponto.style.width = `${tamanho}px`;
    ponto.style.height = `${tamanho}px`;
    ponto.style.animationDuration = `${14 + Math.random() * 16}s`;
    ponto.style.animationDelay = `${-Math.random() * 30}s`;
    ponto.style.setProperty('--deriva', `${(Math.random() - 0.5) * 120}px`);
    camada.append(ponto);
  }
  document.body.prepend(camada);
}

let timerToast;
export function avisar(texto) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(toast);
  }
  toast.textContent = texto;
  toast.classList.add('visivel');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => toast.classList.remove('visivel'), 2400);
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Alternativa para navegadores dentro de aplicativos, que às vezes bloqueiam a área de transferência.
    const campo = el('textarea', { readonly: true });
    campo.value = texto;
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.append(campo);
    campo.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    campo.remove();
    return ok;
  }
}
