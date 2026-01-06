@echo off
chcp 65001 >nul
title DoeChain - Sistema de Notificação de Óbitos

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                                                           ║
echo ║   🏥 DoeChain - Sistema de Notificação de Óbitos          ║
echo ║      Plataforma Blockchain para Doação de Córneas         ║
echo ║                                                           ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

:: Definir diretório base (onde está o .bat)
set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"

:: ========================================
:: Verificar Node.js
:: ========================================
echo [1/5] Verificando Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ ERRO: Node.js não encontrado!
    echo.
    echo Por favor, instale o Node.js em: https://nodejs.org
    echo Versão mínima recomendada: 18.0.0
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo    ✅ Node.js %NODE_VERSION%

:: ========================================
:: Verificar npm
:: ========================================
echo [2/5] Verificando npm...
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo    ❌ npm não encontrado!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo    ✅ npm %NPM_VERSION%

:: ========================================
:: Verificar se precisa instalar
:: ========================================
echo [3/5] Verificando instalação...

cd /d "%BACKEND_DIR%"
if %ERRORLEVEL% neq 0 (
    echo    ❌ Pasta backend não encontrada!
    pause
    exit /b 1
)

set "NEEDS_INSTALL=0"

:: Verificar node_modules
if not exist "node_modules" (
    set "NEEDS_INSTALL=1"
    echo    ⚠️  Dependências não instaladas
)

:: Verificar .env
if not exist ".env" (
    set "NEEDS_INSTALL=1"
    echo    ⚠️  Arquivo .env não configurado
)

:: Verificar banco de dados
if not exist "data\doechain.db" (
    set "NEEDS_INSTALL=1"
    echo    ⚠️  Banco de dados não inicializado
)

:: ========================================
:: Instalar se necessário
:: ========================================
if "%NEEDS_INSTALL%"=="1" (
    echo.
    echo ════════════════════════════════════════════════════════════
    echo    PRIMEIRA EXECUÇÃO - Instalando sistema...
    echo ════════════════════════════════════════════════════════════
    echo.
    
    :: Instalar dependências
    if not exist "node_modules" (
        echo 📦 Instalando dependências do Node.js...
        call npm install
        if %ERRORLEVEL% neq 0 (
            echo    ❌ Erro ao instalar dependências!
            pause
            exit /b 1
        )
        echo    ✅ Dependências instaladas
    )
    
    :: Criar .env
    if not exist ".env" (
        echo 📝 Criando arquivo de configuração...
        copy ".env.example" ".env" >nul
        echo    ✅ Arquivo .env criado
        echo    ℹ️  Usando mesmas configs do PetID ^(Infura + Forwarder^)
        echo.
    )
    
    :: Criar pasta data se não existir
    if not exist "data" (
        mkdir "data"
    )
    
    :: Inicializar banco de dados
    if not exist "data\doechain.db" (
        echo 🗄️  Inicializando banco de dados...
        call npm run init-db
        if %ERRORLEVEL% neq 0 (
            echo    ❌ Erro ao inicializar banco!
            pause
            exit /b 1
        )
        
        echo 👤 Criando usuário administrador...
        call npm run create-admin
        echo    ✅ Banco de dados pronto
    )
    
    echo.
    echo ════════════════════════════════════════════════════════════
    echo    ✅ Instalação concluída!
    echo ════════════════════════════════════════════════════════════
    echo.
) else (
    echo    ✅ Sistema já instalado
)

:: ========================================
:: Iniciar servidor
:: ========================================
echo [4/5] Iniciando servidor...

:: Verificar se já está rodando na porta 3001
netstat -ano | findstr :3001 | findstr LISTENING >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo    ⚠️  Servidor já está rodando na porta 3001
    echo    Abrindo navegador...
    start http://localhost:3001
    echo.
    echo Pressione qualquer tecla para fechar esta janela.
    pause >nul
    exit /b 0
)

:: Iniciar servidor em uma nova janela minimizada
start /min "DoeChain Server" cmd /c "node server.js"

:: Aguardar servidor iniciar
echo    ⏳ Aguardando servidor...
set "ATTEMPTS=0"

:wait_server
timeout /t 1 /nobreak >nul
set /a ATTEMPTS+=1

:: Tentar conectar ao servidor
curl -s http://localhost:3001/api/health >nul 2>nul
if %ERRORLEVEL% equ 0 goto server_ready

:: Timeout após 30 segundos
if %ATTEMPTS% geq 30 (
    echo    ❌ Timeout ao iniciar servidor!
    pause
    exit /b 1
)
goto wait_server

:server_ready
echo    ✅ Servidor iniciado!

:: ========================================
:: Abrir navegador
:: ========================================
echo [5/5] Abrindo navegador...
start http://localhost:3001

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                                                           ║
echo ║   ✅ Sistema rodando em: http://localhost:3001            ║
echo ║                                                           ║
echo ║   Credenciais padrão:                                     ║
echo ║   📧 Email: admin@doechain.gov.br                         ║
echo ║   🔑 Senha: admin123456                                   ║
echo ║                                                           ║
echo ║   ⚠️  Altere a senha após o primeiro login!               ║
echo ║                                                           ║
echo ║   Pressione qualquer tecla para ENCERRAR o sistema.       ║
echo ║                                                           ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

pause >nul

:: ========================================
:: Encerrar servidor
:: ========================================
echo.
echo Encerrando servidor...

:: Encerrar pela janela
taskkill /fi "WINDOWTITLE eq DoeChain Server*" /f >nul 2>nul

:: Encerrar por porta (backup)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING 2^>nul') do (
    taskkill /pid %%a /f >nul 2>nul
)

echo ✅ Sistema encerrado. Até logo!
timeout /t 2 >nul
