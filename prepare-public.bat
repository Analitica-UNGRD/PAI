@echo off
REM Este script prepara la carpeta public para el despliegue en Vercel

echo "Preparando carpeta public para despliegue..."

REM Crear carpeta public si no existe
if not exist "public" mkdir public

REM Limpiar carpeta public
echo "Limpiando carpeta public..."
del /q /s public\*

REM Copiar contenido de src a public
echo "Copiando archivos de src a public..."
xcopy /e /i /y src public\src

REM Copiar API
echo "Copiando API..."
xcopy /e /i /y api public\api

echo "Preparación completada."