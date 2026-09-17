@echo off
title AutoFace TIC - Servidor de Sincronizacion
color 0b
echo ========================================================
echo       ALCALDIA DE ACACIAS - OFICINA TIC
echo         Iniciando Servidor AutoFace TIC
echo ========================================================
echo.
echo Conectando con Google Sheets y preparando el sistema...
echo.
cd /d "%~dp0"
npm run start
pause
