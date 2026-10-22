// Gera o QR code da sacola em SVG (vetor, ideal para a gráfica).
// Uso: npm run qr -- https://seu-dominio.com.br/sacola [arquivo.svg]
import fs from 'node:fs';
import QRCode from 'qrcode';

const [url, saida = 'qr-sacola.svg'] = process.argv.slice(2);
if (!url) {
  console.error('Informe o endereço: npm run qr -- https://seu-dominio.com.br/sacola');
  process.exit(1);
}
const svg = await QRCode.toString(url, {
  type: 'svg',
  errorCorrectionLevel: 'Q', // tolera pequenas falhas de impressão e dobras
  margin: 4, // zona livre obrigatória ao redor do código
  color: { dark: '#3b2e20', light: '#ffffff' },
});
fs.writeFileSync(saida, svg);
console.log(`QR salvo em ${saida} → ${url}`);
