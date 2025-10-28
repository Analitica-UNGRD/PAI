@echo off
REM start-local.bat - inicia el proxy local y el servidor estático en ventanas separadas
REM Esto evita bloquear la ventana actual y deja los logs visibles para depuración

cd /d "%~dp0"

echo Iniciando servidor estático en nueva ventana (puerto 8080)...
start "Static" cmd /k "cd /d "%~dp0" && npx http-server src -c-1 -p 8080"

echo Esperando unos segundos para que el servidor arranque...
timeout /t 2 /nobreak >nul

echo Abre tu navegador en: http://127.0.0.1:8080/pages/login.html
echo Presiona cualquier tecla para cerrar esta ventana (el servidor permanecera abierto en su ventana).
pause >nul
