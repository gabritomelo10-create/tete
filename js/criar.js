// Caminho de quem agradece: nomes → bilhete → prévia → compartilhar.
import {
  el, icones, criarEnvelope, abrirEnvelope, criarCarta, brilhos, avisar, copiar, abertura,
} from './comum.js';
import { empacotar } from './pacote.js';

const SUGESTOES = [
  'Você lembrou de mim.',
  'Você sabe transformar pequenos gestos.',
  'Seu carinho chegou na hora certa.',
  'Quero agradecer do meu jeito.',
];

const estado = {
  para: '',
  de: '',
  bilhete: '',
  salvo: null, // { link } depois de "Está pronto"
};

const $ = (seletor) => document.querySelector(seletor);
const etapas = [...document.querySelectorAll('section[data-etapa]')];

// ---------- Navegação entre etapas (com suporte ao botão "voltar" do celular) ----------

function podeEntrar(nome) {
  if (nome === 'escrever') return Boolean(estado.para && estado.de);
  if (nome === 'previa') return Boolean(estado.para && estado.de && estado.bilhete.trim());
  if (nome === 'pronto') return Boolean(estado.salvo);
  return true;
}

function mostrar(nome) {
  if (!podeEntrar(nome)) nome = estado.para ? 'escrever' : 'inicio';
  if (estado.salvo && nome !== 'pronto' && nome !== 'inicio') nome = 'pronto';
  for (const etapa of etapas) {
    const ativa = etapa.dataset.etapa === nome;
    etapa.hidden = !ativa;
    etapa.classList.toggle('entrando', ativa);
  }
  document.body.dataset.etapa = nome;
  window.scrollTo({ top: 0 });
  etapas.find((e) => e.dataset.etapa === nome).focus({ preventScroll: true });
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
  if (estado.bilhete.trim() && !estado.salvo) evento.preventDefault();
});

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
  irPara('escrever');
});

// ---------- Bilhete ----------

const campoBilhete = $('#campo-bilhete');

for (const frase of SUGESTOES) {
  $('[data-sugestoes]').append(el('li', {},
    el('button', { type: 'button', class: 'sugestao', text: frase, onclick: () => inserirSugestao(frase) })));
}

function inserirSugestao(frase) {
  const atual = campoBilhete.value.trimEnd();
  campoBilhete.value = atual ? `${atual} ${frase}` : frase;
  campoBilhete.dispatchEvent(new Event('input'));
  campoBilhete.focus();
  campoBilhete.setSelectionRange(campoBilhete.value.length, campoBilhete.value.length);
}

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
  irPara('previa');
});

// ---------- Prévia ----------

const dadosDoCarinho = () => ({ para: estado.para, de: estado.de, bilhete: estado.bilhete.trim() });

function montarPrevia() {
  const cena = $('#cena-previa');
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

$('#editar').addEventListener('click', () => irPara('escrever'));

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
  const podeCompartilhar = typeof navigator.share === 'function';
  $('#compartilhar').replaceChildren(icones.compartilhar(), podeCompartilhar ? 'Compartilhar' : 'Enviar pelo WhatsApp');
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

// ---------- Início ----------

const aoEntrar = {
  nomes: () => {
    campoPara.value = estado.para;
    campoDe.value = estado.de;
    $('#previa-assinatura').textContent = estado.de || 'Ana';
  },
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

abertura();
brilhos();
mostrar('inicio');
