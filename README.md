# Um carinho de volta

Site da **Tetê Atelier Sucré** para a campanha de Natal (*Noël Sucré*): quem recebe o presente escaneia o QR da sacola, grava um agradecimento (ou escreve um bilhete) e envia uma pequena experiência digital para quem presenteou.

Sem cadastro, sem catálogo, sem chamada de venda.

## Os dois caminhos

**Quem agradece** — escaneia o QR → informa os nomes → vê sugestões de palavras → grava (até 60 s) ou escreve → revisa no envelope → “Está pronto” → compartilha pelo próprio celular.

**Quem recebe** — abre o link → envelope creme com laço dourado e “Para Marina” → toca para abrir (o laço se desfaz, a aba abre, a carta sobe) → ouve ou lê → pode ouvir de novo e guardar o áudio (ou o bilhete como imagem).

| Endereço | Página |
|---|---|
| `/sacola` | Endereço fixo impresso no QR. Redireciona para a entrada (destino configurável em `QR_REDIRECT`, sem reimprimir). |
| `/` | Fluxo de quem agradece. |
| `/c/:id` | Envelope de quem recebe. |
| `/gerenciar/:id#chave=…` | Ver prazo e excluir. A chave fica depois do `#`, então não aparece em registros do servidor ao abrir. |

## Como rodar

Requer **Node.js 22.13+** (usa o SQLite embutido do Node).

```bash
npm install
npm start            # http://localhost:3000
npm test             # testes da API
npm run e2e -- capturas/   # percurso completo no Chromium com microfone simulado (+ capturas de tela)
```

> O microfone só funciona em **HTTPS** (ou `localhost`). Para testar no celular durante o desenvolvimento, use um túnel HTTPS.

### Configuração (variáveis de ambiente)

| Variável | Padrão | Para quê |
|---|---|---|
| `PUBLIC_URL` | endereço da requisição | Domínio usado nos links compartilhados e na imagem de prévia. **Defina em produção** (ex.: `https://carinho.tete.com.br`). |
| `PORT` | `3000` | Porta HTTP. |
| `DATA_DIR` | `data` | Pasta do banco e dos áudios (privada, nunca servida diretamente). |
| `RETENTION_DAYS` | `90` | Dias que cada carinho fica disponível. |
| `MAX_AUDIO_BYTES` | `3145728` | Tamanho máximo do áudio (3 MB; 60 s gravados a 64 kbps ocupam ~0,5 MB). |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MINUTES` | `10` / `60` | Criações permitidas por IP na janela. |
| `CLEANUP_INTERVAL_MINUTES` | `60` | Frequência da exclusão automática dos expirados. |
| `TRUST_PROXY` | `0` | Quantos proxies reversos há na frente (para ler o IP real no limite de criações). |
| `QR_REDIRECT` | `/` | Para onde `/sacola` aponta. |
| `HSTS` | — | `1` para enviar `Strict-Transport-Security`. |

### Produção

```bash
docker build -t carinho .
docker run -p 3000:3000 -v carinho-dados:/app/data \
  -e PUBLIC_URL=https://carinho.tete.com.br -e TRUST_PROXY=1 -e HSTS=1 carinho
```

Coloque atrás de um proxy com HTTPS (Caddy, Nginx, Cloudflare, Render, Railway, Fly.io…). O volume `/app/data` precisa ser persistente e ter backup.

## Estrutura

| Parte | Onde | O que faz |
|---|---|---|
| Interface para celular | `public/` | Formulário, gravação (MediaRecorder), envelope animado, player e compartilhamento. HTML/CSS/JS sem framework. |
| Servidor | `server/app.js` | Valida os dados, salva mensagens, gera links, serve o áudio com suporte a *Range* (exigido pelo Safari). |
| Banco de dados | `server/db.js` | SQLite: nomes, tipo, identificador, datas, *hash* da chave de gerenciamento. |
| Armazenamento privado | `server/storage.js` | Arquivos de áudio fora da pasta pública. Troque por S3/R2/GCS implementando as mesmas 4 funções. |

### O que é salvo

| Informação | Finalidade |
|---|---|
| Nome de quem recebe | Personalizar o envelope |
| Nome de quem envia | Assinar a mensagem |
| Áudio ou bilhete | Conteúdo do agradecimento |
| Identificador aleatório (128 bits) | Endereço difícil de adivinhar, sem nomes ou telefones na URL |
| Data de criação e expiração | Controlar a disponibilidade (90 dias) |
| *Hash* SHA-256 da chave de gerenciamento | Permitir excluir (a chave em si não fica guardada) |

Nada de telefone, e-mail, contatos ou IP é gravado. O formato do áudio é conferido pelos próprios bytes (WebM/Ogg do Android e Chrome, MP4 do iPhone), não pelo que o navegador declara.

### Segurança e cuidado

- Links com identificador aleatório; aviso explícito, antes de concluir, de que **qualquer pessoa com o link pode abrir**.
- Áudio só sai pela rota `/api/mensagens/:id/audio`, que confere se o carinho existe e não expirou (`Cache-Control: no-store`).
- Expirados são apagados na primeira tentativa de abertura e pela limpeza periódica (banco **e** arquivo).
- Limite de criações por IP, limite de tamanho, `Content-Security-Policy` restritiva, `Referrer-Policy: no-referrer`, páginas de carinho com `noindex`.
- Fontes servidas pelo próprio site (sem Google Fonts nem rastreadores de terceiros).
- O site **não envia mensagens**: o botão “Compartilhar” abre o menu do celular; sem ele, abre o WhatsApp para a pessoa escolher o contato.

## Identidade visual

Creme, dourado, textura suave de papel e movimento delicado, seguindo a sacola e a campanha *Noël Sucré*. Tipografia: **Cormorant Garamond** (títulos e bilhete), **Pinyon Script** (nomes e assinatura) e **Jost** (interface). Todas as cores estão como variáveis no topo de `public/css/estilo.css` — para ajustar aos tons exatos da apresentação de Natal, basta trocar os valores de `--creme`, `--dourado` e afins. A imagem de prévia do link (`public/img/compartilhar.png`) é gerada a partir do próprio envelope com `node scripts/imagem-compartilhar.js`.

Quem tem `prefers-reduced-motion` ativo vê a abertura instantânea, sem brilhos caindo.

## QR da sacola

```bash
npm run qr -- https://carinho.tete.com.br/sacola qr-sacola.svg
```

Gera um SVG vetorial com correção de erro nível Q e a zona livre obrigatória ao redor. Antes de imprimir:

- Teste o QR **impresso no tamanho e acabamento reais** (papel, laminação, dourado), com celulares diferentes.
- Mantenha a área livre ao redor e afaste o código das emendas e dobras da base.
- Contraste escuro sobre claro; evite imprimir o QR em dourado metálico.

## Roteiro de testes antes de imprimir

- [ ] Escanear a base da sacola (iPhone e Android, câmera nativa e leitores dentro do Instagram/WhatsApp).
- [ ] Gravar, ouvir, apagar e gravar de novo; revisar; compartilhar.
- [ ] Abrir o link em outro celular; ouvir, ouvir de novo, baixar.
- [ ] Excluir pelo link de gerenciamento e confirmar que o link deixou de abrir.
- [ ] Negar o microfone e seguir pelo bilhete.
- [ ] Internet lenta (o envio mostra “Preparando seu carinho…” e permite tentar de novo).
- [ ] Link expirado (`RETENTION_DAYS` baixo em ambiente de teste).

O script `npm run e2e` cobre automaticamente gravação, bilhete, microfone negado, recebimento, download e exclusão no Chromium; os testes em iPhone/Safari e navegadores dentro de apps precisam ser feitos em aparelhos reais.
