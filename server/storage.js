import fs from 'node:fs';
import path from 'node:path';

// Armazenamento privado dos áudios: a pasta nunca é servida diretamente.
// O acesso acontece apenas pela rota /api/mensagens/:id/audio, que confere a mensagem antes.
// Para usar um serviço de objetos (S3, R2, GCS), basta implementar as mesmas quatro funções.
export function criarArmazenamento(pasta) {
  fs.mkdirSync(pasta, { recursive: true, mode: 0o700 });
  const caminho = (chave) => {
    if (!/^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(chave)) throw new Error('Chave de arquivo inválida');
    return path.join(pasta, chave);
  };
  return {
    salvar: (chave, dados) => fs.promises.writeFile(caminho(chave), dados, { mode: 0o600, flag: 'wx' }),
    caminho,
    existe: (chave) => fs.existsSync(caminho(chave)),
    remover: (chave) => fs.promises.rm(caminho(chave), { force: true }),
  };
}
