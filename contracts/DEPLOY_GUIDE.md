# 🚀 Guia de Deploy do DeathNotificationRegistry

## Ferramentas Recomendadas para Deploy

### 1. **Remix IDE** (Mais Fácil - Recomendado)
- URL: https://remix.ethereum.org
- Não precisa instalar nada
- Interface gráfica intuitiva

### 2. **Hardhat** (Mais Profissional)
- Precisa Node.js instalado
- Melhor para automação

### 3. **Foundry** (Mais Rápido)
- Linha de comando
- Testes mais rápidos

---

## 📋 Deploy via Remix (Recomendado)

### Passo 1: Preparar o Contrato

1. Acesse https://remix.ethereum.org
2. Crie um novo arquivo: `DeathNotificationRegistry.sol`
3. Cole o código do contrato (de `contracts/DeathNotificationRegistry.sol`)

### Passo 2: Instalar Dependências OpenZeppelin

No Remix, as dependências são importadas automaticamente via:
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
```

### Passo 3: Compilar

1. Vá na aba "Solidity Compiler"
2. Selecione versão **0.8.20** ou superior
3. Clique em "Compile DeathNotificationRegistry.sol"

### Passo 4: Deploy

1. Vá na aba "Deploy & Run Transactions"
2. Selecione **Environment**: "Injected Provider - MetaMask"
3. Conecte sua MetaMask na **Sepolia Testnet**
4. Selecione o contrato: **DeathNotificationRegistry**
5. Preencha os parâmetros do constructor:
   - `initialOwner`: Seu endereço MetaMask (será o admin)
   - `trustedForwarder`: `0x1Bf44d835d9695c36B0640A5B06f356fe52694B5` (Forwarder do PetID)
6. Clique em "Deploy"
7. Confirme a transação na MetaMask

### Passo 5: Salvar o Endereço

Após o deploy, copie o endereço do contrato e atualize:

**Arquivo:** `backend/.env`
```
DEATH_NOTIFICATION_ADDRESS=0xSEU_ENDERECO_AQUI
```

---

## 🔧 Deploy via Hardhat

### Passo 1: Instalar Hardhat (se não tiver)

```bash
cd orgaos-hospitais
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

### Passo 2: Configurar hardhat.config.js

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: ["0x4c2a27080a075b1179788fb491ec041809c22d8e0705241827ad7c23c74a4f9d"]
    }
  }
};
```

### Passo 3: Criar Script de Deploy

```javascript
// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const forwarder = "0x1Bf44d835d9695c36B0640A5B06f356fe52694B5";
  
  const DeathNotification = await hre.ethers.getContractFactory("DeathNotificationRegistry");
  const contract = await DeathNotification.deploy(deployer.address, forwarder);
  
  await contract.waitForDeployment();
  
  console.log("DeathNotificationRegistry deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Passo 4: Deploy

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## ✅ Checklist Pós-Deploy

- [ ] Copiar endereço do contrato deployado
- [ ] Atualizar `backend/.env` com `DEATH_NOTIFICATION_ADDRESS`
- [ ] Verificar contrato no Etherscan (opcional mas recomendado)
- [ ] Testar chamada de função no Remix ou Etherscan

---

## 🔗 Parâmetros do Constructor

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `initialOwner` | Seu endereço | Será o Admin do sistema |
| `trustedForwarder` | `0x1Bf44d835d9695c36B0640A5B06f356fe52694B5` | Forwarder já deployado (PetID) |

---

## 💰 Custo Estimado

- **Gas estimado:** ~2.500.000 gas
- **Custo na Sepolia:** 0 (testnet - ETH grátis)
- **Custo na Mainnet:** ~$50-150 (dependendo do gas)

### Obter ETH de Teste (Sepolia)

- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucet.quicknode.com/ethereum/sepolia

---

## 🔄 Após o Deploy

1. **Atualize o `.env`:**
```env
DEATH_NOTIFICATION_ADDRESS=0xNOVO_ENDERECO
```

2. **Reinicie o servidor:**
```bash
cd backend
npm start
```

3. **Teste a integração:**
- Faça login no sistema
- Crie uma notificação de óbito
- Verifique se aparece a opção de enviar para blockchain

---

## ⚠️ Importante

O sistema DoeChain funciona **100% offline** (sem blockchain) usando apenas o banco SQLite local. A blockchain é **opcional** e serve para:

- Auditoria imutável
- Rastreabilidade pública
- Transparência para a SES-GO

Se o contrato não estiver deployado ou configurado, o sistema continua funcionando normalmente!
