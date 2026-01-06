@echo off
chcp 65001 >nul
title DoeChain - Build Executável

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║     DoeChain - Criando Executável Standalone              ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js não encontrado!
    pause
    exit /b 1
)

:: Instalar dependências na raiz
echo [1/4] Instalando dependências...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro ao instalar dependências
    pause
    exit /b 1
)

:: Instalar pkg globalmente se não existir
echo [2/4] Verificando pkg...
where pkg >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo     Instalando pkg globalmente...
    call npm install -g pkg
)

:: Preparar build
echo [3/4] Preparando arquivos...
node build/prepare.js

:: Criar executável
echo [4/4] Criando executável...
echo     Isso pode demorar alguns minutos...
call pkg . --targets node18-win-x64 --output dist/DoeChain.exe --compress GZip

if %ERRORLEVEL% equ 0 (
    echo.
    echo ╔═══════════════════════════════════════════════════════════╗
    echo ║     ✅ Build concluído com sucesso!                       ║
    echo ║                                                           ║
    echo ║     Executável: dist\DoeChain.exe                         ║
    echo ╚═══════════════════════════════════════════════════════════╝
    echo.
    
    :: Copiar arquivos adicionais para dist
    if not exist "dist\data" mkdir "dist\data"
    copy "backend\.env.example" "dist\.env.example" >nul 2>nul
    
    explorer "dist"
) else (
    echo.
    echo ❌ Erro ao criar executável
)

pause
