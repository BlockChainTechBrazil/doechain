/**
 * Script para gerar ícones PNG do DoeChain PWA
 * Execute: node generate-icons.js
 * 
 * Este script cria ícones PNG simples usando Canvas
 * Para produção, substitua por ícones profissionais
 */

const fs = require('fs');
const path = require('path');

// Tamanhos necessários para PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Diretório de saída
const outputDir = path.join(__dirname, '..', 'frontend', 'assets', 'icons');

// Criar diretório se não existir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Gerar um PNG simples placeholder (em base64)
// Isso é um ícone azul simples com "DC" no centro
function generatePlaceholderIcon(size) {
  // SVG template
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2563eb"/>
          <stop offset="100%" style="stop-color:#1d4ed8"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#bg)"/>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size * 0.35}" 
            font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">DC</text>
      <circle cx="${size * 0.75}" cy="${size * 0.25}" r="${size * 0.08}" fill="#10b981"/>
    </svg>
  `.trim();

  return svg;
}

console.log('🎨 Gerando ícones PWA do DoeChain...\n');

sizes.forEach(size => {
  const svg = generatePlaceholderIcon(size);
  const filename = `icon-${size}.svg`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, svg);
  console.log(`✅ Criado: ${filename}`);
});

// Também criar favicon.svg
const faviconSvg = generatePlaceholderIcon(32);
fs.writeFileSync(path.join(outputDir, 'favicon.svg'), faviconSvg);
console.log('✅ Criado: favicon.svg');

console.log('\n📌 Ícones SVG gerados com sucesso!');
console.log('\n⚠️  NOTA: Para PWA funcionar corretamente, converta para PNG:');
console.log('   - Use uma ferramenta online como https://svgtopng.com');
console.log('   - Ou instale sharp: npm install sharp');
console.log('   - Renomeie de .svg para .png mantendo os tamanhos\n');

// Criar arquivo de instrução
const instructions = `
# Ícones PWA do DoeChain

Os arquivos SVG foram gerados nesta pasta.

## Para converter em PNG:

### Opção 1 - Online:
1. Acesse https://svgtopng.com
2. Converta cada SVG para PNG
3. Mantenha os nomes (icon-72.png, icon-96.png, etc.)

### Opção 2 - Sharp (Node.js):
\`\`\`bash
npm install sharp
node -e "
const sharp = require('sharp');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(s => {
  sharp('icon-' + s + '.svg').png().toFile('icon-' + s + '.png');
});
"
\`\`\`

### Opção 3 - Inkscape CLI:
\`\`\`bash
for size in 72 96 128 144 152 192 384 512; do
  inkscape icon-$size.svg -w $size -h $size -o icon-$size.png
done
\`\`\`

## Ícones necessários:
- icon-72.png  (72x72)
- icon-96.png  (96x96)
- icon-128.png (128x128)
- icon-144.png (144x144)
- icon-152.png (152x152)
- icon-192.png (192x192) - Principal
- icon-384.png (384x384)
- icon-512.png (512x512) - Splash screen
`;

fs.writeFileSync(path.join(outputDir, 'README.md'), instructions);
console.log('📝 Instruções salvas em README.md');
