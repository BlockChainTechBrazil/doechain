// Endereços dos contratos deployados
// Usando o mesmo Forwarder do PetID (já deployado na Sepolia)

const contracts = {
  // MinimalForwarder para meta-transactions (gasless)
  // Mesmo endereço usado pelo PetID - já tem saldo no relayer
  forwarder: process.env.FORWARDER_ADDRESS || '0x1Bf44d835d9695c36B0640A5B06f356fe52694B5',

  // Registro de notificações de óbito (atualizar após deploy)
  deathNotification: process.env.DEATH_NOTIFICATION_ADDRESS || ''
};

module.exports = contracts;
