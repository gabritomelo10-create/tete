import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function abrirBanco(arquivo) {
  if (arquivo !== ':memory:') fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS mensagens (
      id              TEXT PRIMARY KEY,
      para            TEXT NOT NULL,
      de              TEXT NOT NULL,
      tipo            TEXT NOT NULL CHECK (tipo IN ('audio', 'bilhete')),
      bilhete         TEXT,
      audio_chave     TEXT,
      audio_mime      TEXT,
      audio_bytes     INTEGER,
      duracao_ms      INTEGER,
      chave_gestao    TEXT NOT NULL,
      criada_em       INTEGER NOT NULL,
      expira_em       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS mensagens_expira_em ON mensagens (expira_em);
  `);

  const inserir = db.prepare(`
    INSERT INTO mensagens (id, para, de, tipo, bilhete, audio_chave, audio_mime, audio_bytes,
                           duracao_ms, chave_gestao, criada_em, expira_em)
    VALUES (:id, :para, :de, :tipo, :bilhete, :audio_chave, :audio_mime, :audio_bytes,
            :duracao_ms, :chave_gestao, :criada_em, :expira_em)
  `);
  const buscar = db.prepare('SELECT * FROM mensagens WHERE id = ?');
  const excluir = db.prepare('DELETE FROM mensagens WHERE id = ?');
  const expiradas = db.prepare('SELECT id, audio_chave FROM mensagens WHERE expira_em <= ?');

  return {
    inserir: (m) => inserir.run(m),
    buscar: (id) => buscar.get(id),
    excluir: (id) => excluir.run(id).changes > 0,
    expiradas: (agora) => expiradas.all(agora),
    fechar: () => db.close(),
  };
}
