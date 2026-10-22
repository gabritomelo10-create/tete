// Caminho de quem agradece: nomes → palavras → gravar/escrever → prévia → salvar → compartilhar.
import {
  el, icones, criarEnvelope, abrirEnvelope, criarCarta, criarPlayer, brilhos,
  avisar, copiar, formatarTempo,
} from './comum.js';
import { empacotar } from './pacote.js';

const LIMITE_MS = 60_000;
const MINIMO_MS = 1_000;
const SUGESTOES = [
  'Você lembrou de mim.',
  'Você sabe transformar pequenos gestos.',
  'Seu carinho chegou na hora certa.',
  'Quero agradecer do meu jeito.',
];

const estado = {
  para: '',
  de: '',
  tipo: null, // 'audio' | 'bilhete'
  audio: null, // { blob, url, duracaoMs }
  bilhete: '',
  salvo: null, // { link } depois de "Está pronto"
};

const $ = (seletor) => document.querySelector(seletor);
const etapas = [...document.querySelectorAll('section[data-etapa]')];

// ---------- Navegação entre etapas (com suporte ao botão "voltar" do celular) ----------

function podeEntrar(nome) {
  if (['palavras', 'gravar', 'escrever'].includes(nome)) return Boolean(estado.para && estado.de);
  if (nome === 'previa') return Boolean(estado.para && estado.de && estado.tipo);
  if (nome === 'pronto') return Boolean(estado.salvo);
  return true;
}

function mostrar(nome) {
  if (!podeEntrar(nome)) nome = estado.para ? 'palavras' : 'inicio';
  if (estado.salvo && nome !== 'pronto' && nome !== 'inicio') nome = 'pronto';
  if (nome !== 'gravar') gravador.cancelar();
  for (const etapa of etapas) {
    const ativa = etapa.dataset.etapa === nome;
    etapa.hidden = !ativa;
    etapa.classList.toggle('entrando', ativa);
  }
  document.body.dataset.etapa = nome;
  window.scrollTo({ top: 0 });
  const atual = etapas.find((e) => e.dataset.etapa === nome);
  atual.focus({ preventScroll: true });
  aoEntrar[nome]?.();
  return nome;
}

function irPara(nome) {
  const destino = mostrar(nome);
  history.pushState({ etapa: destino }, '', '');
}

window.addEventListener('popstate', (evento) => mostrar(evento.state?.etapa ?? 'inicio'));
history.replaceState({ etapa: 'inicio' }, '', '');

document.addEventListener('click', (evento) => {
  const alvo = evento.target.closest('[data-ir]');
  if (alvo) irPara(alvo.dataset.ir);
});

window.addEventListener('beforeunload', (evento) => {
  const temConteudo = estado.audio || estado.bilhete.trim();
  if (temConteudo && !estado.salvo) evento.preventDefault();
});

// ---------- Sugestões ----------

for (const lista of document.querySelectorAll('[data-sugestoes]')) {
  const comoBotao = lista.dataset.sugestoes === 'botoes';
  for (const frase of SUGESTOES) {
    lista.append(el('li', {},
      comoBotao
        ? el('button', { type: 'button', class: 'sugestao', text: frase, onclick: () => inserirSugestao(frase) })
        : el('p', { class: 'sugestao', text: frase })));
  }
}

function inserirSugestao(frase) {
  const campo = $('#campo-bilhete');
  const atual = campo.value.trimEnd();
  campo.value = atual ? `${atual} ${frase}` : frase;
  campo.dispatchEvent(new Event('input'));
  campo.focus();
  campo.setSelectionRange(campo.value.length, campo.value.length);
}

// ---------- Nomes ----------

const campoPara = $('#campo-para');
const campoDe = $('#campo-de');
const limparNome = (valor) => valor.replace(/\s+/g, ' ').trim();

campoDe.addEventListener('input', () => {
  $('#previa-assinatura').textContent = limparNome(campoDe.value) || 'Ana';
});

$('#form-nomes').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const para = limparNome(campoPara.value);
  const de = limparNome(campoDe.value);
  const erro = $('#erro-nomes');
  if (!para || !de) {
    erro.textContent = !para ? 'Conte para quem vai esse carinho.' : 'Conte como você quer assinar.';
    erro.hidden = false;
    (!para ? campoPara : campoDe).focus();
    return;
  }
  erro.hidden = true;
  estado.para = para;
  estado.de = de;
  for (const alvo of document.querySelectorAll('[data-nome="para"]')) alvo.textContent = para;
  irPara(estado.tipo === 'audio' && estado.audio ? 'gravar' : estado.tipo === 'bilhete' ? 'escrever' : 'palavras');
});

// ---------- Gravação ----------

function escolherFormato() {
  if (typeof MediaRecorder === 'undefined') return null;
  // MP4 (AAC) primeiro: é o formato que o WhatsApp e os celulares abrem melhor como arquivo de áudio.
  const opcoes = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return opcoes.find((tipo) => MediaRecorder.isTypeSupported?.(tipo)) ?? '';
}

const gravador = (() => {
  const caixa = $('#gravador');
  const botao = $('#botao-gravar');
  const anel = $('#anel');
  const tempo = $('#tempo-atual');
  const ponto = $('#ponto-rec');
  const rotulo = $('#rotulo-gravacao');
  const erro = $('#erro-microfone');
  const revisao = $('#revisao');
  const continuar = $('#continuar-audio');
  let fluxo = null;
  let gravacao = null;
  let partes = [];
  let inicio = 0;
  let quadro = 0;
  let cancelada = false;
  let player = null;

  function definirEstado(novo) {
    caixa.dataset.estado = novo;
    caixa.hidden = novo === 'gravado';
    revisao.hidden = novo !== 'gravado';
    continuar.hidden = novo !== 'gravado';
    ponto.hidden = novo !== 'gravando';
    $('#cola-gravacao').hidden = novo === 'gravado';
    botao.setAttribute('aria-label', novo === 'gravando' ? 'Parar gravação' : 'Começar a gravar');
    rotulo.textContent = {
      pronto: 'Toque para começar a gravar',
      pedindo: 'Permita o uso do microfone para gravar',
      gravando: 'Gravando… toque para parar',
      gravado: '',
    }[novo];
    if (novo !== 'gravando') anel.style.setProperty('--progresso', '0');
    if (novo === 'pronto') tempo.textContent = '0:00';
  }

  function mostrarErro(texto) {
    $('#erro-microfone-texto').textContent = texto;
    erro.hidden = false;
  }

  function soltarMicrofone() {
    fluxo?.getTracks().forEach((faixa) => faixa.stop());
    fluxo = null;
  }

  function marcarTempo() {
    const decorrido = performance.now() - inicio;
    tempo.textContent = formatarTempo(decorrido / 1000);
    anel.style.setProperty('--progresso', String(Math.min(decorrido / LIMITE_MS, 1)));
    if (decorrido >= LIMITE_MS) {
      parar();
      return;
    }
    quadro = requestAnimationFrame(marcarTempo);
  }

  async function comecar() {
    erro.hidden = true;
    const formato = escolherFormato();
    if (formato === null || !navigator.mediaDevices?.getUserMedia) {
      mostrarErro('Este navegador não permite gravar áudio. Se você abriu pelo Instagram ou outro app, tente abrir no navegador do celular (Safari ou Chrome) — ou escreva um bilhete.');
      return;
    }
    definirEstado('pedindo');
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (falha) {
      definirEstado('pronto');
      const negado = falha?.name === 'NotAllowedError' || falha?.name === 'SecurityError';
      mostrarErro(negado
        ? 'Sem acesso ao microfone, não conseguimos gravar. Você pode liberar o microfone nas configurações do navegador e tentar de novo — ou escrever um bilhete.'
        : 'Não encontramos um microfone disponível. Que tal escrever um bilhete?');
      return;
    }

    partes = [];
    cancelada = false;
    try {
      gravacao = new MediaRecorder(fluxo, { ...(formato ? { mimeType: formato } : {}), audioBitsPerSecond: 64_000 });
    } catch {
      gravacao = new MediaRecorder(fluxo);
    }
    gravacao.addEventListener('dataavailable', (e) => { if (e.data?.size) partes.push(e.data); });
    gravacao.addEventListener('stop', finalizar);
    gravacao.start(250);
    inicio = performance.now();
    definirEstado('gravando');
    quadro = requestAnimationFrame(marcarTempo);
  }

  function parar() {
    cancelAnimationFrame(quadro);
    if (gravacao?.state === 'recording') {
      estado.duracaoGravada = Math.min(performance.now() - inicio, LIMITE_MS);
      gravacao.stop();
    }
  }

  function finalizar() {
    soltarMicrofone();
    if (cancelada) {
      definirEstado('pronto');
      return;
    }
    const duracaoMs = estado.duracaoGravada;
    const blob = new Blob(partes, { type: gravacao.mimeType || partes[0]?.type || 'audio/webm' });
    gravacao = null;
    if (duracaoMs < MINIMO_MS || !blob.size) {
      definirEstado('pronto');
      rotulo.textContent = 'Ficou curtinho demais. Toque e fale um pouco mais.';
      return;
    }
    descartar();
    estado.audio = { blob, url: URL.createObjectURL(blob), duracaoMs };
    mostrarRevisao();
  }

  function mostrarRevisao() {
    player = criarPlayer(estado.audio.url, estado.audio.duracaoMs);
    $('#revisao-player').replaceChildren(player.elemento);
    definirEstado('gravado');
  }

  function descartar() {
    player?.parar();
    player = null;
    if (estado.audio) URL.revokeObjectURL(estado.audio.url);
    estado.audio = null;
    if (estado.tipo === 'audio') estado.tipo = null;
  }

  botao.addEventListener('click', () => {
    if (caixa.dataset.estado === 'gravando') parar();
    else if (caixa.dataset.estado === 'pronto') comecar();
  });
  $('#tentar-microfone').addEventListener('click', comecar);
  $('#regravar').addEventListener('click', () => {
    descartar();
    definirEstado('pronto');
    botao.focus();
  });
  continuar.addEventListener('click', () => {
    player?.parar();
    estado.tipo = 'audio';
    irPara('previa');
  });

  return {
    entrar() {
      erro.hidden = true;
      if (estado.audio) mostrarRevisao();
      else definirEstado('pronto');
    },
    // Ao sair da etapa no meio da gravação, descarta e libera o microfone.
    cancelar() {
      player?.parar();
      if (gravacao?.state === 'recording') {
        cancelada = true;
        parar();
      } else {
        soltarMicrofone();
      }
    },
  };
})();

// ---------- Bilhete ----------

const campoBilhete = $('#campo-bilhete');
campoBilhete.addEventListener('input', () => {
  estado.bilhete = campoBilhete.value;
  $('#contador-bilhete').textContent = `${[...campoBilhete.value].length}/600`;
  $('#erro-bilhete').hidden = true;
});
$('#continuar-bilhete').addEventListener('click', () => {
  if (!campoBilhete.value.trim()) {
    const erro = $('#erro-bilhete');
    erro.textContent = 'Escreva algumas palavras para seguir.';
    erro.hidden = false;
    campoBilhete.focus();
    return;
  }
  estado.tipo = 'bilhete';
  irPara('previa');
});

// ---------- Prévia ----------

function dadosDoCarinho() {
  const comAudio = estado.tipo === 'audio';
  return {
    para: estado.para,
    de: estado.de,
    bilhete: comAudio ? '' : estado.bilhete.trim(),
    comAudio,
  };
}

function montarPrevia() {
  $('#aviso-bilhete').hidden = estado.tipo === 'audio';
  $('#aviso-audio').hidden = estado.tipo !== 'audio';
  const cena = $('#cena-previa');
  // A prévia mostra exatamente o que a pessoa vai ver: o áudio chega à parte, na conversa.
  const dados = dadosDoCarinho();
  const envelope = criarEnvelope({
    para: estado.para,
    rotulo: 'Toque para ver como o envelope se abre',
    aoAbrir: async () => {
      await abrirEnvelope(envelope);
      const { carta } = criarCarta(dados);
      carta.classList.add('revelando');
      cena.replaceChildren(
        carta,
        el('button', { type: 'button', class: 'botao botao-texto', text: 'Ver o envelope de novo', onclick: montarPrevia }),
      );
    },
  });
  cena.replaceChildren(
    el('h2', { class: 'cena-titulo', text: `${estado.para}, tem um carinho de volta para você.` }),
    el('p', { class: 'cena-de', text: `De ${estado.de}.` }),
    envelope,
    el('p', { class: 'dica-toque', text: 'Toque no envelope para ver como ele se abre' }),
  );
}

$('#editar').addEventListener('click', () => irPara(estado.tipo === 'audio' ? 'gravar' : 'escrever'));

$('#salvar').addEventListener('click', async () => {
  const erro = $('#erro-salvar');
  erro.hidden = true;
  try {
    const pacote = await empacotar(dadosDoCarinho());
    estado.salvo = { link: new URL(`c/#${pacote}`, window.location.href).href };
    irPara('pronto');
    history.replaceState({ etapa: 'pronto' }, '', '');
  } catch {
    erro.textContent = 'Não conseguimos montar o carinho. Confira os nomes e a mensagem e tente de novo.';
    erro.hidden = false;
  }
});

// ---------- Pronto / compartilhar ----------

const EXTENSOES = { 'audio/mp4': 'm4a', 'audio/webm': 'weba', 'audio/ogg': 'ogg' };

function arquivoDeAudio() {
  const tipo = (estado.audio.blob.type || 'audio/mp4').split(';')[0];
  const nome = `carinho-para-${estado.para}`.normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/-$/, '').toLowerCase();
  return new File([estado.audio.blob], `${nome}.${EXTENSOES[tipo] ?? 'm4a'}`, { type: tipo });
}

function textoCompleto() {
  const texto = $('#texto-envio').value.trim();
  return texto ? `${texto}\n${estado.salvo.link}` : estado.salvo.link;
}

function montarPronto() {
  const comAudio = estado.tipo === 'audio';
  $('#selo-ok').replaceChildren(icones.ok());
  for (const parte of document.querySelectorAll('[data-com-audio]')) parte.hidden = !comAudio;
  const texto = $('#texto-envio');
  if (!texto.value) {
    texto.value = `${estado.para}, seu presente deixou meu dia mais doce. Preparei um carinho de volta para você 💛`;
  }
  const podeCompartilhar = typeof navigator.share === 'function';
  $('#compartilhar').replaceChildren(icones.compartilhar(), podeCompartilhar ? 'Compartilhar' : 'Enviar pelo WhatsApp');
  $('#copiar-link').replaceChildren(icones.copiar(), 'Copiar link');

  if (comAudio) {
    const arquivo = arquivoDeAudio();
    const podeEnviarArquivo = navigator.canShare?.({ files: [arquivo] }) === true;
    const baixar = $('#baixar-audio');
    baixar.href = estado.audio.url;
    baixar.download = arquivo.name;
    baixar.replaceChildren(icones.baixar(), podeEnviarArquivo ? 'Ou baixe o áudio para anexar' : 'Baixar o áudio');
    $('#compartilhar-audio').hidden = !podeEnviarArquivo;
    $('#compartilhar-audio').replaceChildren(icones.compartilhar(), 'Compartilhar o áudio');
    $('#dica-audio').textContent = podeEnviarArquivo
      ? 'Escolha a mesma pessoa. O áudio chega logo abaixo do envelope.'
      : 'Baixe o áudio e anexe na mesma conversa, logo depois do envelope.';
  }
}

$('#compartilhar').addEventListener('click', async () => {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: textoCompleto() });
    } catch (falha) {
      if (falha?.name !== 'AbortError') {
        if (await copiar(textoCompleto())) avisar('Mensagem copiada. É só colar na conversa.');
      }
    }
    return;
  }
  // Sem o menu de compartilhar do sistema: abre o WhatsApp para a pessoa escolher o contato.
  window.open(`https://wa.me/?text=${encodeURIComponent(textoCompleto())}`, '_blank', 'noopener');
});

$('#compartilhar-audio').addEventListener('click', async () => {
  try {
    await navigator.share({ files: [arquivoDeAudio()] });
  } catch (falha) {
    if (falha?.name !== 'AbortError') avisar('Não deu para compartilhar. Use “baixar o áudio”.');
  }
});

$('#copiar-link').addEventListener('click', async () => {
  avisar(await copiar(estado.salvo.link) ? 'Link copiado' : 'Não deu para copiar. Toque e segure o link.');
});

// ---------- Início ----------

const aoEntrar = {
  nomes: () => {
    campoPara.value = estado.para;
    campoDe.value = estado.de;
    $('#previa-assinatura').textContent = estado.de || 'Ana';
  },
  gravar: () => gravador.entrar(),
  escrever: () => {
    campoBilhete.value = estado.bilhete;
    campoBilhete.dispatchEvent(new Event('input'));
  },
  previa: () => {
    $('#erro-salvar').hidden = true;
    montarPrevia();
  },
  pronto: montarPronto,
};

$('#novo-carinho').addEventListener('click', (evento) => {
  evento.preventDefault();
  window.location.assign(window.location.pathname);
});

brilhos();
mostrar('inicio');
