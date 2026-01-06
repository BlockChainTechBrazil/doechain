/**
 * Script para configurar o Relayer no contrato DeathNotificationRegistry
 * 
 * Este script:
 * 1. Verifica se o relayer já tem role no contrato
 * 2. Se não tiver, registra uma instituição "Sistema DoeChain"
 * 3. Atribui role de Hospital ao relayer com essa instituição
 * 
 * Executar: node src/services/scripts/setup-relayer-role.js
 */

const { ethers } = require('ethers');
const deathNotificationABI = require('../abi/DeathNotificationRegistryABI.json');
const contracts = require('../config/contracts');
const { currentNetwork } = require('../config/networks');

// Roles do contrato
const Roles = {
  None: 0,
  Admin: 1,
  Hospital: 2,
  IML: 3,
  SVO: 4,
  BancoOlhos: 5,
  SES: 6
};

async function main() {
  console.log('🔧 Configurando Relayer no Contrato DeathNotificationRegistry\n');

  // Configurações embutidas
  const RELAYER_PRIVATE_KEY = '0x4c2a27080a075b1179788fb491ec041809c22d8e0705241827ad7c23c74a4f9d';

  if (!contracts.deathNotification) {
    console.error('❌ DEATH_NOTIFICATION_ADDRESS não configurado');
    process.exit(1);
  }

  console.log(`📡 Rede: ${currentNetwork.name} (${currentNetwork.chainId})`);
  console.log(`📜 Contrato: ${contracts.deathNotification}`);

  // Conectar ao provider
  const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
  const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

  console.log(`🔐 Relayer: ${wallet.address}`);

  // Verificar saldo
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Saldo: ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.error('❌ Relayer sem saldo! Adicione ETH de teste.');
    process.exit(1);
  }

  // Conectar ao contrato
  const contract = new ethers.Contract(
    contracts.deathNotification,
    deathNotificationABI,
    wallet
  );

  // Verificar owner do contrato
  const owner = await contract.owner();
  console.log(`👑 Owner do contrato: ${owner}`);

  const isOwner = owner.toLowerCase() === wallet.address.toLowerCase();
  console.log(`   Relayer é owner? ${isOwner ? '✅ Sim' : '❌ Não'}\n`);

  if (!isOwner) {
    console.error('❌ O relayer NÃO é owner do contrato!');
    console.error('   Você precisa usar a wallet que fez o deploy para configurar.');
    console.error(`   Owner: ${owner}`);
    console.error(`   Relayer: ${wallet.address}`);
    console.error('\n💡 Opções:');
    console.error('   1. Use o Remix/Etherscan com a wallet owner para chamar:');
    console.error('      - registerInstitution("Sistema DoeChain", 2)');
    console.error(`      - assignRole("${wallet.address}", 2, 1)`);
    console.error('   2. Ou transfira ownership para o relayer');
    process.exit(1);
  }

  // Verificar role atual do relayer
  const currentRole = await contract.userRoles(wallet.address);
  console.log(`📋 Role atual do relayer: ${currentRole} (${getRoleName(Number(currentRole))})`);

  if (Number(currentRole) !== Roles.None) {
    // Já tem role, verificar instituição
    const userInstitution = await contract.userInstitution(wallet.address);
    console.log(`🏥 Instituição do relayer: ${userInstitution}`);

    if (Number(userInstitution) > 0) {
      console.log('\n✅ Relayer já está configurado corretamente!');
      console.log('   Pode usar o sistema normalmente.');
      process.exit(0);
    }
  }

  // Verificar quantas instituições existem
  const institutionCount = await contract.institutionCount();
  console.log(`\n🏥 Instituições no contrato: ${institutionCount}`);

  let institutionId;

  if (Number(institutionCount) === 0) {
    // Criar instituição
    console.log('\n📝 Criando instituição "Sistema DoeChain"...');

    const txInst = await contract.registerInstitution('Sistema DoeChain', Roles.Hospital);
    console.log(`   TX: ${txInst.hash}`);

    const receipt = await txInst.wait();
    console.log(`   ✅ Confirmada no bloco ${receipt.blockNumber}`);

    institutionId = 1;
  } else {
    // Usar primeira instituição existente
    institutionId = 1;
    const institution = await contract.institutions(institutionId);
    console.log(`   Usando instituição existente: ${institution.name}`);
  }

  // Verificar se precisa atribuir role
  if (Number(currentRole) === Roles.None) {
    console.log(`\n📝 Atribuindo role Hospital ao relayer...`);

    const txRole = await contract.assignRole(wallet.address, Roles.Hospital, institutionId);
    console.log(`   TX: ${txRole.hash}`);

    const receipt = await txRole.wait();
    console.log(`   ✅ Confirmada no bloco ${receipt.blockNumber}`);
  } else {
    // Tem role mas não tem instituição - precisa reatribuir
    console.log(`\n📝 Reatribuindo role com instituição...`);

    const txRole = await contract.assignRole(wallet.address, Number(currentRole), institutionId);
    console.log(`   TX: ${txRole.hash}`);

    const receipt = await txRole.wait();
    console.log(`   ✅ Confirmada no bloco ${receipt.blockNumber}`);
  }

  // Verificar configuração final
  const finalRole = await contract.userRoles(wallet.address);
  const finalInstitution = await contract.userInstitution(wallet.address);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ CONFIGURAÇÃO CONCLUÍDA!');
  console.log('═══════════════════════════════════════════════════');
  console.log(`   Relayer: ${wallet.address}`);
  console.log(`   Role: ${getRoleName(Number(finalRole))}`);
  console.log(`   Instituição ID: ${finalInstitution}`);
  console.log('\n🎉 Agora você pode enviar notificações para a blockchain!');
}

function getRoleName(role) {
  const names = ['None', 'Admin', 'Hospital', 'IML', 'SVO', 'BancoOlhos', 'SES'];
  return names[role] || 'Unknown';
}

main().catch((error) => {
  console.error('\n❌ Erro:', error.message);
  process.exit(1);
});
