# Um carinho de volta

Site da **Tetê Atelier Sucré** para a campanha de Natal (*Noël Sucré*): quem recebe o presente escaneia o QR da sacola, escreve um bilhete ou grava um agradecimento, e devolve o carinho para quem presenteou.

Sem cadastro, catálogo ou chamada de venda. **Sem servidor e sem contas:** o site é estático e roda no GitHub Pages.

**Endereço:** https://gabritomelo10-create.github.io/tete/
**QR da sacola:** https://gabritomelo10-create.github.io/tete/sacola/

## Como funciona

**Quem agradece:** escaneia o QR → informa os nomes → vê sugestões de palavras → escreve um bilhete ou grava a voz (até 60 s) → revisa no envelope → "Está pronto" → envia pelo próprio celular.

**Quem recebe:** toca no link → envelope creme com laço dourado e "Para Marina" → toca para abrir (o laço se desfaz, a aba abre, a carta sobe) → lê o bilhete (e pode guardá-lo como imagem) ou vê o aviso de que há uma mensagem de voz na conversa.

### Onde fica cada carinho

| Tipo | Como chega |
|---|---|
| **Bilhete** | Vai **dentro do próprio link**, depois do `#`, comprimido. Nada é salvo em servidor, e a parte depois do `#` nem é enviada ao GitHub quando o link é aberto. |
| **Áudio** | A pessoa envia **duas coisas na mesma conversa**: 1) o link do envelope (com os nomes) e 2) o arquivo de áudio, pelo menu de compartilhar do celular (ou baixando e anexando). |

Consequências dessa escolha:
- **Não há prazo nem exclusão:** o carinho existe enquanto o link existir na conversa.
- Qualquer pessoa com o link pode abrir. O site avisa isso antes de concluir.
- Os nomes não aparecem legíveis no endereço, mas também não são criptografados.
- Um áudio de 1 minuto não cabe num link de WhatsApp, por isso vai como arquivo.

Se no futuro quiserem o áudio tocando dentro do envelope, link curto e exclusão, é preciso um serviço de armazenamento. A versão com servidor está no histórico do git (commit `e68d884`).

## Estrutura

| Arquivo | Para quê |
|---|---|
| `index.html`, `js/criar.js` | Caminho de quem agradece (nomes, sugestões, gravação com MediaRecorder, bilhete, prévia, compartilhar). |
| `c/index.html`, `js/carinho.js` | Envelope de quem recebe. |
| `js/pacote.js` | Põe o carinho dentro do link e lê de volta, com validação. |
| `js/comum.js` | Envelope, carta, player, brilhos, cópia. |
| `sacola/index.html` | Endereço fixo do QR. Redireciona para a entrada; troque o `url=` para mudar o destino sem reimprimir. |
| `css/estilo.css` | Identidade visual. As cores são variáveis no topo do arquivo. |
| `fonts/` | Bodoni Moda e Manrope, servidas pelo próprio site (licença OFL em `fonts/LICENSE-OFL.txt`). |
| `.nojekyll` | Faz o GitHub Pages publicar os arquivos como estão. |

## Desenvolvimento

```bash
npm install
npm start                 # http://127.0.0.1:8080/tete/  (imita o GitHub Pages)
npm test                  # testes do formato do link
npm run e2e -- capturas/  # percurso completo no Chromium com microfone simulado
npm run qr -- https://gabritomelo10-create.github.io/tete/sacola/ qr-sacola.svg
npm run imagem-compartilhar   # regenera img/compartilhar.png (prévia do link)
```

O microfone só funciona em HTTPS (o GitHub Pages já usa) ou em `localhost`.

**Domínio próprio:** se configurarem um domínio no Pages, troquem o endereço do `og:image` em `index.html` e `c/index.html` e gerem o QR com o novo endereço.

## Identidade visual

Segue a identidade da campanha **Noël Sucré** e a sua proporção cromática:

| Cor | Proporção | Onde aparece |
|---|---|---|
| Rouge Noël | 35% | Topo com brilhos e faixas de losangos, envelope, botões principais |
| Crème | 25% | Papel de fundo do conteúdo |
| Vert Sapin | 15% | Rodapé com faixa de losangos, avisos, números dos passos |
| Blanc | 15% | Carta, campos, cartões |
| Or Noël | 10% | Marca, trama de losangos, filetes, estrelas, ilhós |

- **Tipografia:** **Bodoni Moda** nos títulos, nomes e no bilhete; **Manrope** nos textos e botões.
- **Elementos:** a bola de Natal com a estrela pendurada sobre "Noël Sucré"; a trama de losangos facetados (`img/losangos.svg`); o envelope em Rouge Noël com faixa dourada, laço de cetim e etiqueta Crème; a frase "Celebre o que torna a vida mais *doce*."

Cores e fontes são variáveis no topo de `css/estilo.css`. A marca no topo é uma recriação com fonte e SVG (`img/bola.svg`); se houver o logo oficial em SVG, basta trocar. A imagem de prévia do link (`img/compartilhar.png`) é gerada a partir do próprio envelope com `npm run imagem-compartilhar`. Quem tem "reduzir movimento" ativado no celular vê a abertura instantânea.

## QR da sacola

O QR aponta para `…/tete/sacola/`. Antes de imprimir:
- Teste o QR **impresso no tamanho e acabamento reais**, com celulares diferentes.
- Mantenha a área livre ao redor e afaste o código das emendas e dobras da base.
- Use contraste escuro sobre claro; evite QR em dourado metálico.

## Roteiro de testes antes de imprimir

- [ ] Escanear a base da sacola (iPhone e Android; câmera nativa e leitores dentro do Instagram/WhatsApp).
- [ ] Escrever um bilhete, compartilhar e abrir em outro celular; guardar como imagem.
- [ ] Gravar, ouvir, regravar; enviar o link e depois o áudio para a mesma pessoa; conferir se o WhatsApp mostra o áudio com play.
- [ ] Negar o microfone e seguir pelo bilhete.
- [ ] Abrir um link incompleto e ver a mensagem amigável.

`npm run e2e` cobre esses percursos no Chromium. iPhone/Safari e navegadores dentro de apps precisam de teste em aparelho real.
