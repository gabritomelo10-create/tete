import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function inteiro(valor, padrao) {
  const n = Number.parseInt(valor ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

// Todas as opções podem ser ajustadas por variáveis de ambiente (ver README).
export function carregarConfig(env = process.env) {
  const pastaDados = path.resolve(raiz, env.DATA_DIR ?? 'data');
  return {
    raiz,
    porta: inteiro(env.PORT, 3000),
    // Endereço público usado para montar os links compartilhados (ex.: https://carinho.tete.com.br).
    urlPublica: (env.PUBLIC_URL ?? '').replace(/\/+$/, ''),
    pastaDados,
    arquivoBanco: path.join(pastaDados, 'carinhos.db'),
    pastaAudios: path.join(pastaDados, 'audios'),
    diasDisponivel: inteiro(env.RETENTION_DAYS, 90),
    maxBytesAudio: inteiro(env.MAX_AUDIO_BYTES, 3 * 1024 * 1024),
    maxSegundosAudio: 60,
    maxCaracteresNome: 40,
    maxCaracteresBilhete: 600,
    limiteCriacoes: inteiro(env.RATE_LIMIT_MAX, 10),
    janelaLimiteMs: inteiro(env.RATE_LIMIT_WINDOW_MINUTES, 60) * 60 * 1000,
    intervaloLimpezaMs: inteiro(env.CLEANUP_INTERVAL_MINUTES, 60) * 60 * 1000,
    // Número de proxies reversos à frente da aplicação (para ler o IP real do visitante).
    trustProxy: inteiro(env.TRUST_PROXY, 0),
    // Para onde o QR impresso na sacola (/sacola) aponta. Permite mudar sem reimprimir.
    destinoQr: env.QR_REDIRECT ?? '/',
    hsts: env.HSTS === '1',
  };
}
