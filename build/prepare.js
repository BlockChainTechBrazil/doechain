/**
 * Script de preparação do build
 * Copia arquivos necessários e prepara estrutura
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('🔧 Preparando build...\n');

// Criar pasta dist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copiar .env.example como referência
const envExample = path.join(rootDir, 'backend', '.env.example');
const envDist = path.join(distDir, '.env.example');

if (fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envDist);
  console.log('✅ .env.example copiado');
}

// Criar README para distribuição
const readmeDist = `# DoeChain - Executável Standalone

## Como usar

1. Execute o arquivo DoeChain.exe
2. O navegador abrirá automaticamente em http://localhost:3001
3. Faça login com:
   - Email: admin@doechain.gov.br
   - Senha: admin123456

## Configuração

Na primeira execução, um arquivo .env será criado automaticamente.
Para configurar o Relayer (envio para blockchain), edite o .env e adicione:

\`\`\`
RELAYER_PRIVATE_KEY=sua_chave_privada_aqui
\`\`\`

## Dados

Os dados são salvos na pasta "data" ao lado do executável.
Faça backup regular do arquivo doechain.db

## Requisitos

- Windows 10/11 64-bit
- Conexão com internet (para blockchain)

---
DoeChain v1.0.0 - Blockchaintech Brazil
`;

fs.writeFileSync(path.join(distDir, 'README.txt'), readmeDist);
console.log('✅ README.txt criado');

console.log('\n✅ Preparação concluída!');
console.log('Execute: npm run build:pkg\n');
