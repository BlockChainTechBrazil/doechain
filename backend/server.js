/**
 * DoeChain Backend - Servidor Express
 * Sistema de Notificação de Óbitos com Potencial de Doação de Córneas
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ========================================
// Inicialização Assíncrona
// ========================================

async function startServer() {
  try {
    // Inicializar banco de dados
    console.log('📦 Inicializando banco de dados...');
    await initDatabase();
    console.log('✅ Banco de dados pronto!');

    // Rotas (carregadas após DB estar pronto)
    const authRoutes = require('./routes/auth');
    const notificationRoutes = require('./routes/notifications');
    const institutionRoutes = require('./routes/institutions');
    const relayRoutes = require('./routes/relay');

    app.use('/api/auth', authRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/institutions', institutionRoutes);
    app.use('/api/relay', relayRoutes);

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
        res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
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
