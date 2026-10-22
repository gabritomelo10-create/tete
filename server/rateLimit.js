// Limite simples em memória: no máximo `maximo` criações por IP dentro da janela.
// Para várias instâncias do servidor, troque por um armazenamento compartilhado (ex.: Redis).
export function criarLimitador({ maximo, janelaMs, agora = () => Date.now() }) {
  const registros = new Map();

  function limpar() {
    const limite = agora() - janelaMs;
    for (const [chave, tempos] of registros) {
      const recentes = tempos.filter((t) => t > limite);
      if (recentes.length) registros.set(chave, recentes);
      else registros.delete(chave);
    }
  }
  const timer = setInterval(limpar, Math.min(janelaMs, 10 * 60 * 1000));
  timer.unref();

  return {
    // Retorna 0 se permitido, ou quantos segundos faltam para tentar de novo.
    consumir(chave) {
      const limite = agora() - janelaMs;
      const tempos = (registros.get(chave) ?? []).filter((t) => t > limite);
      if (tempos.length >= maximo) {
        registros.set(chave, tempos);
        return Math.ceil((tempos[0] + janelaMs - agora()) / 1000);
      }
      tempos.push(agora());
      registros.set(chave, tempos);
      return 0;
    },
    parar: () => clearInterval(timer),
  };
}
