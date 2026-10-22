// Caminho de quem agradece: nomes → palavras → gravar/escrever → prévia → salvar → compartilhar.
import {
  el, icones, criarEnvelope, abrirEnvelope, criarCarta, criarPlayer, brilhos,
  avisar, copiar, local, api, formatarTempo, formatarData,
} from './comum.js';

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
  salvo: null, // resposta do servidor
};

const $ = (seletor) => document.querySelector(seletor);
const etapas = [...document.querySelectorAll('[data-etapa]')];

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
  const opcoes = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
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

function montarPrevia() {
  const cena = $('#cena-previa');
  const dados = {
    para: estado.para,
    de: estado.de,
    tipo: estado.tipo,
    bilhete: estado.bilhete.trim(),
    audioSrc: estado.audio?.url,
    duracaoMs: estado.audio?.duracaoMs,
  };
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

function lerComoBase64(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] ?? '');
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

$('#salvar').addEventListener('click', async () => {
  const botao = $('#salvar');
  const erro = $('#erro-salvar');
  erro.hidden = true;
  botao.disabled = true;
  botao.textContent = 'Preparando seu carinho…';
  try {
    const corpo = { para: estado.para, de: estado.de, tipo: estado.tipo };
    if (estado.tipo === 'audio') {
      corpo.audio = await lerComoBase64(estado.audio.blob);
      corpo.duracaoMs = Math.round(estado.audio.duracaoMs);
    } else {
      corpo.bilhete = estado.bilhete.trim();
    }
    const resposta = await api('/api/mensagens', { method: 'POST', body: JSON.stringify(corpo) });
    if (!resposta.ok) throw new Error(resposta.dados?.erro ?? 'Não conseguimos salvar agora. Tente novamente.');
    estado.salvo = resposta.dados;
    lembrarCarinho();
    irPara('pronto');
    history.replaceState({ etapa: 'pronto' }, '', '');
  } catch (falha) {
    erro.textContent = falha instanceof TypeError
      ? 'Parece que a internet oscilou. Confira a conexão e toque em “Está pronto” de novo.'
      : falha.message;
    erro.hidden = false;
  } finally {
    botao.disabled = false;
    botao.textContent = 'Está pronto';
  }
});

// ---------- Pronto / compartilhar ----------

function textoCompleto() {
  const texto = $('#texto-envio').value.trim();
  return texto ? `${texto}\n${estado.salvo.link}` : estado.salvo.link;
}

function montarPronto() {
  $('#selo-ok').replaceChildren(icones.ok());
  const texto = $('#texto-envio');
  if (!texto.value) {
    texto.value = `${estado.para}, seu presente deixou meu dia mais doce. Preparei um carinho de volta para você 💛`;
  }
  $('#data-expira').textContent = formatarData(estado.salvo.expiraEm);
  $('#link-gerenciar').textContent = estado.salvo.linkGerenciar;
  const compartilhar = $('#compartilhar');
  const podeCompartilhar = typeof navigator.share === 'function';
  compartilhar.replaceChildren(icones.compartilhar(), podeCompartilhar ? 'Compartilhar' : 'Enviar pelo WhatsApp');
  $('#copiar-link').replaceChildren(icones.copiar(), 'Copiar link');
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

$('#copiar-link').addEventListener('click', async () => {
  avisar(await copiar(estado.salvo.link) ? 'Link copiado' : 'Não deu para copiar. Toque e segure o link.');
});
$('#copiar-gerenciar').addEventListener('click', async () => {
  avisar(await copiar(estado.salvo.linkGerenciar) ? 'Link de gerenciamento copiado' : 'Não deu para copiar. Toque e segure o link.');
});

// ---------- Carinhos preparados neste aparelho ----------

const CHAVE_LOCAL = 'carinhos';

function lembrarCarinho() {
  const lista = local.ler(CHAVE_LOCAL, []);
  lista.unshift({
    para: estado.para,
    link: estado.salvo.link,
    linkGerenciar: estado.salvo.linkGerenciar,
    expiraEm: estado.salvo.expiraEm,
  });
  local.gravar(CHAVE_LOCAL, lista.slice(0, 20));
}

function listarCarinhos() {
  const lista = local.ler(CHAVE_LOCAL, []).filter((c) => new Date(c.expiraEm) > new Date());
  local.gravar(CHAVE_LOCAL, lista);
  const destino = $('#lista-meus-carinhos');
  destino.replaceChildren(...lista.map((c) => el('li', { class: 'sugestao' },
    `Para ${c.para} · `,
    el('a', { href: c.link, text: 'abrir' }),
    ' · ',
    el('a', { href: c.linkGerenciar, text: 'gerenciar' }))));
  $('#meus-carinhos').hidden = lista.length === 0;
}

// ---------- Início ----------

const aoEntrar = {
  inicio: listarCarinhos,
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
  window.location.assign('/');
});

brilhos();
mostrar('inicio');
