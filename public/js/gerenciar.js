// Página de gerenciamento: quem criou o carinho pode excluí-lo antes do prazo.
// A chave fica depois do "#" no link, então nunca chega aos registros do servidor ao abrir a página.
import { el, api, formatarData, local } from './comum.js';

const conteudo = document.getElementById('conteudo');
const dialogo = document.getElementById('confirmar');
const id = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] ?? '');
const chave = new URLSearchParams(window.location.hash.slice(1)).get('chave') ?? '';

function mensagem(titulo, texto) {
  conteudo.replaceChildren(el('div', { class: 'cena' },
    el('h2', { text: titulo }),
    el('div', { class: 'filete', 'aria-hidden': 'true' }),
    el('p', { class: 'lead', text: texto }),
    el('div', { class: 'acoes' }, el('a', { class: 'botao botao-secundario', href: '/', text: 'Preparar um novo carinho' }))));
  conteudo.focus({ preventScroll: true });
}

function esquecerLocalmente() {
  local.gravar('carinhos', local.ler('carinhos', []).filter((c) => !c.link.endsWith(`/c/${id}`)));
}

async function excluir() {
  const botao = document.getElementById('confirmar-excluir');
  botao.disabled = true;
  try {
    const resposta = await api(`/api/mensagens/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ chave }),
    });
    dialogo.close();
    if (resposta.ok) {
      esquecerLocalmente();
      mensagem('Pronto. O carinho foi excluído.', 'O áudio ou bilhete foi apagado e o link não abre mais.');
    } else {
      mensagem('Não foi possível excluir.', resposta.dados?.erro ?? 'Tente novamente em instantes.');
    }
  } catch {
    dialogo.close();
    mensagem('A conexão oscilou.', 'Nada foi apagado. Confira a internet e abra este link de novo.');
  } finally {
    botao.disabled = false;
  }
}

async function carregar() {
  if (!chave) {
    mensagem('Link incompleto.', 'Use o link de gerenciamento completo que apareceu quando o carinho ficou pronto.');
    return;
  }
  let resposta;
  try {
    resposta = await api(`/api/mensagens/${encodeURIComponent(id)}`);
  } catch {
    mensagem('A conexão oscilou.', 'Confira a internet e tente de novo.');
    return;
  }
  if (!resposta.ok) {
    mensagem('Este carinho não está mais disponível.', 'Ele já foi excluído ou completou o prazo e foi apagado automaticamente.');
    return;
  }
  const m = resposta.dados;
  conteudo.replaceChildren(el('div', {},
    el('p', { class: 'olho', text: 'Gerenciar carinho' }),
    el('h2', { text: `Para ${m.para}, de ${m.de}` }),
    el('p', { class: 'lead', text: m.tipo === 'audio' ? 'Mensagem de voz' : 'Bilhete escrito' }),
    el('div', { class: 'aviso' },
      el('p', {}, 'Preparado em ', el('strong', { text: formatarData(m.criadaEm) }), '.'),
      el('p', {}, 'Disponível até ', el('strong', { text: formatarData(m.expiraEm) }), '. Depois disso, é apagado automaticamente.')),
    el('div', { class: 'acoes' },
      el('a', { class: 'botao botao-secundario', href: `/c/${encodeURIComponent(id)}`, text: 'Abrir o carinho' }),
      el('button', {
        type: 'button',
        class: 'botao botao-texto',
        text: 'Excluir agora',
        onclick: () => (typeof dialogo.showModal === 'function'
          ? dialogo.showModal()
          : window.confirm('Excluir este carinho? Não é possível desfazer.') && excluir()),
      }))));
  conteudo.focus({ preventScroll: true });
}

document.getElementById('confirmar-excluir').addEventListener('click', excluir);
document.getElementById('cancelar-excluir').addEventListener('click', () => dialogo.close());
carregar();
