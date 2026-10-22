import { carregarConfig } from './config.js';
import { criarApp } from './app.js';

const config = carregarConfig();
const { app, limparExpiradas, encerrar } = criarApp(config);

async function limpar() {
  try {
    const total = await limparExpiradas();
    if (total) console.log(`Limpeza: ${total} carinho(s) expirado(s) apagado(s).`);
  } catch (erro) {
    console.error('Falha na limpeza de carinhos expirados', erro);
  }
}
limpar();
const timer = setInterval(limpar, config.intervaloLimpezaMs);

const servidor = app.listen(config.porta, () => {
  console.log(`Um carinho de volta em http://localhost:${config.porta}`);
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    clearInterval(timer);
    servidor.close(() => {
      encerrar();
      process.exit(0);
    });
  });
}
