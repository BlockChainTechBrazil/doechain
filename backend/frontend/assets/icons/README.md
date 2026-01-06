
# Ícones PWA do DoeChain

Os arquivos SVG foram gerados nesta pasta.

## Para converter em PNG:

### Opção 1 - Online:
1. Acesse https://svgtopng.com
2. Converta cada SVG para PNG
3. Mantenha os nomes (icon-72.png, icon-96.png, etc.)

### Opção 2 - Sharp (Node.js):
```bash
npm install sharp
node -e "
const sharp = require('sharp');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(s => {
  sharp('icon-' + s + '.svg').png().toFile('icon-' + s + '.png');
});
"
```

### Opção 3 - Inkscape CLI:
```bash
for size in 72 96 128 144 152 192 384 512; do
  inkscape icon-$size.svg -w $size -h $size -o icon-$size.png
done
```

## Ícones necessários:
- icon-72.png  (72x72)
- icon-96.png  (96x96)
- icon-128.png (128x128)
- icon-144.png (144x144)
- icon-152.png (152x152)
- icon-192.png (192x192) - Principal
- icon-384.png (384x384)
- icon-512.png (512x512) - Splash screen
