import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { abrirBanco } from './db.js';
import { criarArmazenamento } from './storage.js';
import { identificarAudio } from './audio.js';
import { criarLimitador } from './rateLimit.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const FORMATO_ID = /^[A-Za-z0-9_-]{22}$/;

const FONTES = {
  'cormorant-400.woff2': '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2',
  'cormorant-400-italic.woff2': '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2',
  'cormorant-500.woff2': '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2',
  'cormorant-600.woff2': '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2',
  'pinyon-400.woff2': '@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff2',
  'jost-400.woff2': '@fontsource/jost/files/jost-latin-400-normal.woff2',
  'jost-500.woff2': '@fontsource/jost/files/jost-latin-500-normal.woff2',
};

const novoId = () => crypto.randomBytes(16).toString('base64url'); // 128 bits, 22 caracteres
const novaChave = () => crypto.randomBytes(32).toString('base64url');
const resumo = (texto) => crypto.createHash('sha256').update(texto).digest();

// Remove caracteres de controle e espaços repetidos; devolve null se ficar vazio ou longo demais.
function limparTexto(valor, max, { multilinha = false } = {}) {
  if (typeof valor !== 'string') return null;
  let texto = valor.normalize('NFC');
  texto = multilinha
    ? texto.replace(/\r\n?/g, '\n').replace(/[^\P{C}\n]/gu, '').replace(/\n{3,}/g, '\n\n')
    : texto.replace(/\p{C}/gu, '').replace(/\s+/g, ' ');
  texto = texto.trim();
  if (!texto || [...texto].length > max) return null;
  return texto;
}

export function criarApp(config, { agora = () => Date.now() } = {}) {
  const db = abrirBanco(config.arquivoBanco);
  const armazenamento = criarArmazenamento(config.pastaAudios);
  const limitador = criarLimitador({ maximo: config.limiteCriacoes, janelaMs: config.janelaLimiteMs, agora });
  const pastaPublica = path.join(config.raiz, 'public');
  const pastaModulos = path.join(config.raiz, 'node_modules');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    if (config.hsts) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  function urlBase(req) {
    return config.urlPublica || `${req.protocol}://${req.get('host')}`;
  }

  function apagarMensagem(msg) {
    db.excluir(msg.id);
    if (msg.audio_chave) return armazenamento.remover(msg.audio_chave);
  }

  // Busca a mensagem e já trata o caso de expiração (apaga na hora, sem esperar a limpeza periódica).
  async function mensagemValida(id, res) {
    const msg = FORMATO_ID.test(id) ? db.buscar(id) : undefined;
    if (!msg) {
      res.status(404).json({ erro: 'Não encontramos este carinho.' });
      return null;
    }
    if (msg.expira_em <= agora()) {
      await apagarMensagem(msg);
      res.status(410).json({ erro: 'Este carinho já completou seu tempo por aqui.' });
      return null;
    }
    return msg;
  }

  // ---------- Páginas ----------

  // Endereço fixo impresso no QR da sacola.
  app.get('/sacola', (req, res) => {
    res.set('Cache-Control', 'no-store').redirect(302, config.destinoQr);
  });

  // As páginas levam o endereço absoluto da imagem de prévia (exigido pelo WhatsApp e redes sociais).
  const paginas = new Map();
  const enviarPagina = (arquivo, privada) => (req, res) => {
    if (!paginas.has(arquivo)) paginas.set(arquivo, fs.readFileSync(path.join(pastaPublica, arquivo), 'utf8'));
    res.set('Cache-Control', 'no-cache');
    if (privada) res.set('X-Robots-Tag', 'noindex, nofollow');
    const base = urlBase(req).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
    res.type('html').send(paginas.get(arquivo).replaceAll('{{URL_BASE}}', base));
  };
  app.get('/', enviarPagina('index.html', false));
  app.get('/c/:id', enviarPagina('carinho.html', true));
  app.get('/gerenciar/:id', enviarPagina('gerenciar.html', true));

  app.get('/fonts/:arquivo', (req, res, next) => {
    const origem = FONTES[req.params.arquivo];
    if (!origem) return next();
    res.sendFile(path.join(pastaModulos, origem), { maxAge: '365d', immutable: true });
  });

  app.use(express.static(pastaPublica, { index: false, maxAge: '1h' }));

  // ---------- API ----------

  const api = express.Router();
  api.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    next();
  });
  // Base64 ocupa ~4/3 do arquivo original; folga para os demais campos.
  api.use(express.json({ limit: Math.ceil(config.maxBytesAudio * 1.4) + 16 * 1024 }));

  api.post('/mensagens', async (req, res) => {
    const espera = limitador.consumir(req.ip);
    if (espera) {
      res.set('Retry-After', String(espera));
      return res.status(429).json({ erro: 'Muitos carinhos em pouco tempo. Tente novamente daqui a pouco.' });
    }

    const corpo = req.body ?? {};
    const para = limparTexto(corpo.para, config.maxCaracteresNome);
    const de = limparTexto(corpo.de, config.maxCaracteresNome);
    if (!para) return res.status(400).json({ erro: 'Conte para quem vai esse carinho.' });
    if (!de) return res.status(400).json({ erro: 'Conte como você quer assinar.' });

    const id = novoId();
    const chave = novaChave();
    const criadaEm = agora();
    const registro = {
      id, para, de,
      tipo: corpo.tipo,
      bilhete: null,
      audio_chave: null,
      audio_mime: null,
      audio_bytes: null,
      duracao_ms: null,
      chave_gestao: resumo(chave).toString('hex'),
      criada_em: criadaEm,
      expira_em: criadaEm + config.diasDisponivel * DIA_MS,
    };

    if (corpo.tipo === 'bilhete') {
      registro.bilhete = limparTexto(corpo.bilhete, config.maxCaracteresBilhete, { multilinha: true });
      if (!registro.bilhete) {
        return res.status(400).json({ erro: `Escreva um bilhete com até ${config.maxCaracteresBilhete} caracteres.` });
      }
    } else if (corpo.tipo === 'audio') {
      if (typeof corpo.audio !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(corpo.audio)) {
        return res.status(400).json({ erro: 'Não recebemos o áudio. Tente gravar novamente.' });
      }
      const dados = Buffer.from(corpo.audio, 'base64');
      if (dados.length > config.maxBytesAudio) {
        return res.status(413).json({ erro: 'O áudio ficou grande demais. Tente uma mensagem um pouco mais curta.' });
      }
      const formato = identificarAudio(dados);
      if (!formato) return res.status(415).json({ erro: 'Não reconhecemos o formato deste áudio.' });
      const duracao = Number(corpo.duracaoMs);
      registro.duracao_ms = Number.isFinite(duracao) && duracao > 0
        ? Math.min(Math.round(duracao), config.maxSegundosAudio * 1000)
        : null;
      registro.audio_chave = `${id}.${formato.extensao}`;
      registro.audio_mime = formato.mime;
      registro.audio_bytes = dados.length;
      await armazenamento.salvar(registro.audio_chave, dados);
    } else {
      return res.status(400).json({ erro: 'Escolha entre áudio ou bilhete.' });
    }

    try {
      db.inserir(registro);
    } catch (erro) {
      if (registro.audio_chave) await armazenamento.remover(registro.audio_chave);
      throw erro;
    }

    const base = urlBase(req);
    res.status(201).json({
      id,
      link: `${base}/c/${id}`,
      linkGerenciar: `${base}/gerenciar/${id}#chave=${chave}`,
      expiraEm: new Date(registro.expira_em).toISOString(),
    });
  });

  api.get('/mensagens/:id', async (req, res) => {
    const msg = await mensagemValida(req.params.id, res);
    if (!msg) return;
    res.json({
      para: msg.para,
      de: msg.de,
      tipo: msg.tipo,
      bilhete: msg.bilhete ?? undefined,
      audioUrl: msg.audio_chave ? `/api/mensagens/${msg.id}/audio` : undefined,
      duracaoMs: msg.duracao_ms ?? undefined,
      criadaEm: new Date(msg.criada_em).toISOString(),
      expiraEm: new Date(msg.expira_em).toISOString(),
    });
  });

  api.get('/mensagens/:id/audio', async (req, res) => {
    const msg = await mensagemValida(req.params.id, res);
    if (!msg) return;
    if (!msg.audio_chave || !armazenamento.existe(msg.audio_chave)) {
      return res.status(404).json({ erro: 'Este carinho não tem áudio.' });
    }
    const extensao = path.extname(msg.audio_chave);
    if ('baixar' in req.query) {
      const nome = `carinho-de-${msg.de}`.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase();
      res.attachment(`${nome}${extensao}`);
    }
    // sendFile responde a requisições Range, exigidas pelo Safari para tocar o áudio.
    res.sendFile(armazenamento.caminho(msg.audio_chave), {
      headers: { 'Content-Type': msg.audio_mime, 'Cache-Control': 'private, no-store' },
      dotfiles: 'deny',
    });
  });

  api.delete('/mensagens/:id', async (req, res) => {
    const msg = FORMATO_ID.test(req.params.id) ? db.buscar(req.params.id) : undefined;
    const chave = req.body?.chave;
    if (msg && typeof chave === 'string'
        && crypto.timingSafeEqual(resumo(chave), Buffer.from(msg.chave_gestao, 'hex'))) {
      await apagarMensagem(msg);
      return res.status(204).end();
    }
    // A mesma resposta para "não existe" e "chave errada", para não revelar quais links existem.
    res.status(404).json({ erro: 'Não foi possível excluir: o link de gerenciamento não confere ou o carinho já foi apagado.' });
  });

  api.use((req, res) => res.status(404).json({ erro: 'Endereço não encontrado.' }));

  api.use((erro, req, res, next) => {
    if (erro.type === 'entity.too.large') {
      return res.status(413).json({ erro: 'O áudio ficou grande demais. Tente uma mensagem um pouco mais curta.' });
    }
    if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados inválidos.' });
    console.error(erro);
    res.status(500).json({ erro: 'Algo não saiu como esperado. Tente novamente em instantes.' });
  });

  app.use('/api', api);

  app.use((req, res) => {
    res.status(404).set('Cache-Control', 'no-cache').sendFile(path.join(pastaPublica, '404.html'));
  });

  async function limparExpiradas() {
    const lista = db.expiradas(agora());
    for (const msg of lista) await apagarMensagem(msg);
    return lista.length;
  }

  function encerrar() {
    limitador.parar();
    db.fechar();
  }

  return { app, limparExpiradas, encerrar };
}
