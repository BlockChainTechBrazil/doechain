# 🏥 DoeChain - Sistema de Notificação de Óbitos com Potencial de Doação de Córneas

## 📋 Visão Geral

O **DoeChain** é uma solução inovadora desenvolvida para a Secretaria de Estado da Saúde de Goiás (SES-GO) no âmbito do CPSI (Contrato Público de Solução Inovadora) nº 01/2025.

A solução visa resolver o desafio da **baixa captação de córneas** no estado de Goiás, automatizando e otimizando o processo de notificação de óbitos com potencial de doação, utilizando tecnologia blockchain para garantir rastreabilidade, transparência e imutabilidade dos registros.

## 🎯 Problema Resolvido

- **Janela crítica de 6 horas**: A captação de córneas deve ocorrer em até 6 horas após o óbito
- **Subnotificação**: Muitos casos com potencial de doação não são notificados a tempo
- **Falta de rastreabilidade**: Dificuldade em auditar o processo de doação
- **Integração fragmentada**: Hospitais, IML, SVO e Banco de Olhos usam sistemas isolados

## ✨ Funcionalidades Principais

### 1. Notificação de Óbitos
- Formulário completo com dados do paciente e óbito
- Avaliação automática de contraindicações médicas e oculares
- Cálculo em tempo real da elegibilidade para doação
- Timer visual da janela crítica de 6 horas

### 2. Gestão de Elegibilidade para Doação de Córneas
- **Contraindicações Absolutas**: HIV, Hepatites, Raiva, Doenças Priônicas, etc.
- **Contraindicações Oculares**: Cirurgia refrativa, Ceratocone, Glaucoma, etc.
- **Condições para Avaliação**: Neoplasia, Diabetes, Uso de drogas IV
- Status individual para cada córnea (esquerda/direita)

### 3. Consentimento Familiar
- Registro do responsável familiar
- Status do consentimento (Autorizado/Recusado/Aguardando)
- Rastreabilidade completa do processo

### 4. Blockchain e Rastreabilidade
- Smart contracts na rede Ethereum (Sepolia/Mainnet)
- Transações gasless via meta-transactions (ERC-2771)
- Hash anonimizado do paciente (LGPD)
- Logs de auditoria imutáveis

### 5. Gestão Multi-institucional
- **Papéis**: Admin, Hospital, IML, SVO, Banco de Olhos, SES
- Cadastro de instituições (CNES, cidade, tipo)
- Controle de acesso baseado em perfis

## 🏗️ Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (PWA)                         │
│  • HTML5 + CSS3 + JavaScript Vanilla                        │
│  • Interface responsiva e acessível                         │
│  • Service Worker para cache de assets                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                        │
│  • Express.js + JWT Auth                                    │
│  • SQLite (sql.js - Pure JavaScript)                        │
│  • Relayer Service (Gasless Transactions)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   BLOCKCHAIN (Ethereum)                     │
│  • Smart Contract: DeathNotificationRegistry.sol            │
│  • Forwarder: Meta-transactions ERC-2771                    │
│  • Rede: Sepolia (Testnet) / Mainnet (Produção)            │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js >= 18.0.0
- NPM ou Yarn

### Instalação

```bash
# Clone o repositório
cd orgaos-hospitais

# Instale as dependências do backend
cd backend
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Inicialize o banco de dados
npm run init-db

# Crie o usuário admin
npm run create-admin

# Inicie o servidor
npm start
```

### Acesso
- URL: http://localhost:3001
- Login padrão: admin@doechain.gov.br / Admin@123

## 📁 Estrutura do Projeto

```
orgaos-hospitais/
├── backend/
│   ├── abi/                 # ABIs dos smart contracts
│   ├── config/              # Configurações (DB, networks, contracts)
│   ├── data/                # Banco de dados SQLite
│   ├── middleware/          # Autenticação JWT
│   ├── routes/              # Rotas da API
│   ├── scripts/             # Scripts de inicialização
│   ├── services/            # Serviços (Auth, Notification, Relayer)
│   └── server.js            # Servidor Express
├── contracts/
│   ├── DeathNotificationRegistry.sol   # Contrato principal
│   └── Forwarder.sol                   # Meta-transactions
├── frontend/
│   ├── assets/              # Ícones e imagens
│   ├── css/                 # Estilos
│   ├── js/                  # JavaScript (api.js, app.js)
│   └── index.html           # Página principal
└── installer/               # Scripts de instalação Windows
```

## 🔐 Segurança e LGPD

- **Anonimização**: CPF é hasheado (SHA-256) antes de ir para blockchain
- **Criptografia**: Dados sensíveis criptografados no banco local
- **Autenticação**: JWT com expiração configurável
- **Auditoria**: Todos os eventos são registrados com timestamp e usuário
- **Controle de Acesso**: RBAC (Role-Based Access Control)

## 📊 Critérios de Avaliação (Edital CPSI)

| Critério | Peso | Atendimento |
|----------|------|-------------|
| Potencial de resolução do problema | 35% | ✅ Resolve o desafio de subnotificação com janela crítica |
| Grau de desenvolvimento (TRL) | 30% | ✅ TRL 6-7 - Protótipo funcional testado |
| Viabilidade do modelo de negócio | 20% | ✅ Baixo custo de operação, sem dependências onerosas |
| Viabilidade econômica | 10% | ✅ Dentro do orçamento, custos mínimos de manutenção |
| Custo-benefício | 5% | ✅ Excelente relação vs soluções tradicionais |

## 🔗 Integrações Previstas

- [ ] Sistema de Prontuário Eletrônico (PEP)
- [ ] Central de Transplantes de Goiás
- [ ] Sistema Nacional de Transplantes (SNT)
- [ ] e-SUS Notifica

## 📈 Escalabilidade

A solução foi projetada para:
- Suportar múltiplas instituições simultaneamente
- Escalar horizontalmente (múltiplas instâncias do backend)
- Migrar para outras redes blockchain (Polygon, BSC, etc.)
- Adaptar-se a outros tipos de doação de órgãos

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript ES6+, PWA
- **Backend**: Node.js, Express.js, sql.js
- **Blockchain**: Solidity, Ethers.js, OpenZeppelin
- **Autenticação**: JWT, bcrypt
- **Database**: SQLite (sql.js - Pure JavaScript)

## 📞 Suporte

- **Email**: contato@blockchaintechbrazil.com.br
- **Empresa**: Blockchaintech Brazil LTDA
- **CNPJ**: XX.XXX.XXX/0001-XX

## 📄 Licença

Este projeto foi desenvolvido para a SES-GO no âmbito do CPSI nº 01/2025.
A propriedade intelectual será definida conforme negociação prevista no edital.

---

**DoeChain** - Salvando vidas através da tecnologia 🏥💙
