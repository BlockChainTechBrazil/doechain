/**
 * DoeChain Backend - Servidor Express
 * Sistema de Notificação de Óbitos com Potencial de Doação de Córneas
 */

// Configurações padrão (sem necessidade de .env)
const CONFIG = {
  PORT: 3001,
  NODE_ENV: 'development',
  JWT_SECRET: 'doechain_jwt_secret_key_2026_blockchaintech_brazil',
  JWT_EXPIRES_IN: '24h',
  RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  CHAIN_ID: 11155111,
  RELAYER_PRIVATE_KEY: '0x4c2a27080a075b1179788fb491ec041809c22d8e0705241827ad7c23c74a4f9d',
  FORWARDER_ADDRESS: '0x1Bf44d835d9695c36B0640A5B06f356fe52694B5',
  DEATH_NOTIFICATION_ADDRESS: '0x690fD2Ee2BAdD99C543b89eEAB9C73C1d8F94E54',
  ADMIN_EMAIL: 'admin@doechain.gov.br',
  ADMIN_PASSWORD: 'admin123456',
  ADMIN_NAME: 'Administrador Sistema'
};

// Exportar configurações globalmente
global.CONFIG = CONFIG;

// Compatibilidade com process.env
Object.keys(CONFIG).forEach(key => {
  if (!process.env[key]) {
    process.env[key] = CONFIG[key];
  }
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./config/database');

const app = express();
const PORT = CONFIG.PORT;

// ========================================
// Middlewares
// ========================================

// Segurança
app.use(helmet({
  contentSecurityPolicy: false, // Permitir CDNs no frontend
  crossOriginEmbedderPolicy: false
}));

// CORS - permitir frontend local
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://localhost:8080'],
  credentials: true
}));

// Parser JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logs de requisições
app.use(morgan('dev'));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..', 'pages')));

// ========================================
// Inicialização Assíncrona
// ========================================

async function startServer() {
  try {
    // Inicializar banco de dados
    console.log('📦 Inicializando banco de dados...');
    await initDatabase();
    console.log('✅ Banco de dados pronto!');

    // Opcional: rota de depuração para listar tabelas do DB
    // Ative definindo a variável de ambiente EXPOSE_DEBUG_DB=1 (remova em produção)
    if (process.env.EXPOSE_DEBUG_DB === '1') {
      try {
        const { getDatabase } = require('./config/database');
        const db = getDatabase();
        app.get('/internal/db-tables', (req, res) => {
          try {
            const result = db._db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            const tables = (result[0] && result[0].values) ? result[0].values.map(r => r[0]) : [];
            res.json({ tables });
          } catch (err) {
            res.status(500).json({ error: String(err) });
          }
        });
        console.log('[DEBUG] /internal/db-tables route enabled');
      } catch (err) {
        console.warn('[DEBUG] Could not enable /internal/db-tables route:', err.message || err);
      }
    }

    // Rotas (carregadas após DB estar pronto)
    const authRoutes = require('./routes/auth');
    const notificationRoutes = require('./routes/notifications');
    const institutionRoutes = require('./routes/institutions');
    const relayRoutes = require('./routes/relay');
    const mvRoutes = require('./routes/mv');

    app.use('/api/auth', authRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/institutions', institutionRoutes);
    app.use('/api/relay', relayRoutes);
    app.use('/api/mv', mvRoutes);

    // ========================================
    // Rota de Health Check
    // ========================================

    app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'DoeChain API'
      });
    });

    // ========================================
    // Rota para SPA (Single Page Application)
    // ========================================

    app.get('*', (req, res) => {
      // Se não for API, servir o frontend
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'pages', 'index.html'));
      } else {
        res.status(404).json({ error: 'Endpoint não encontrado' });
      }
    });

    // ========================================
    // Error Handler Global
    // ========================================

    app.use((err, req, res, next) => {
      console.error('❌ Erro:', err);

      res.status(err.status || 500).json({
        error: err.message || 'Erro interno do servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });

    // ========================================
    // Inicialização do Servidor
    // ========================================

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏥 DoeChain - Sistema de Notificação de Óbitos          ║
║                                                           ║
║   Servidor rodando em: http://localhost:${PORT}             ║
║                                                           ║
║   Endpoints:                                              ║
║   • API:      http://localhost:${PORT}/api                  ║
║   • Frontend: http://localhost:${PORT}                      ║
║   • Health:   http://localhost:${PORT}/api/health           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

  } catch (err) {
    console.error('❌ Erro fatal ao iniciar servidor:', err);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();

module.exports = app;
