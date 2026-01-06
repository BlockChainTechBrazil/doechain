// Configuração das redes blockchain suportadas
// Mesmas configurações do PetID para reutilizar o relayer

const networks = {
  sepolia: {
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    name: 'Ethereum Sepolia Testnet',
    rpcUrl: process.env.RPC_URL || 'https://sepolia.infura.io/v3/fac9aafe063248408e5e7872785db784',
    blockExplorer: 'https://sepolia.etherscan.io',
    currency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18
    }
  }
};

// Rede atual em uso
const currentNetwork = networks.sepolia;

module.exports = {
  networks,
  currentNetwork
};
