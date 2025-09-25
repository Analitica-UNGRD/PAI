<#
Start-local.ps1

Script para iniciar el proyecto Login_predeterminado en Windows PowerShell.

Qué hace:
- Comprueba que Node.js y npm estén disponibles.
- Si falta node_modules pregunta para ejecutar `npm install`.
- Ejecuta `npm run start` en una nueva ventana (por defecto) o en la ventana actual con -Inline.
- Intenta abrir la URL del frontend cuando el script detecte que el servidor está listo.

Uso:
    ./start-local.ps1            # abre nueva ventana (por defecto, puede solicitar UAC si el sistema lo requiere)
    ./start-local.ps1 -Inline   # ejecuta en la terminal actual (sin pedir elevación)
    ./start-local.ps1 -NoElev   # abre nueva ventana sin pedir elevación

#>

Set-StrictMode -Version Latest

param(
    [switch]$Inline,
    [switch]$NoElev
)

function Check-Command($cmd) {
    try {
        $null = Get-Command $cmd -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

Write-Host "Iniciando start-local.ps1 para Login_predeterminado..."

if (-not (Check-Command node)) {
    Write-Error "Node.js no está instalado o no está en PATH. Instale Node.js (https://nodejs.org/) y vuelva a intentarlo."
    exit 1
}

if (-not (Check-Command npm)) {
    Write-Error "npm no está disponible. Asegúrese de que Node.js y npm estén instalados correctamente."
    exit 1
}

$projRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projRoot

Write-Host "Directorio del proyecto: $projRoot"

if (-not (Test-Path (Join-Path $projRoot 'node_modules'))) {
    Write-Host "node_modules no encontrado. ¿Desea ejecutar 'npm install'? (Y/N)"
    $ans = Read-Host
    if ($ans -match '^[Yy]') {
        Write-Host "Ejecutando npm install..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "npm install falló. Revise los errores anteriores."
            exit $LASTEXITCODE
        }
    } else {
        Write-Warning "Continuando sin instalar dependencias. Esto puede fallar al iniciar el servidor."
    }
}

# Lanzar npm run start en una nueva ventana de PowerShell para mantener la ejecución y mostrar logs
$title = "Login_predeterminado - servidores"
# Evitar secuencias de escape inválidas: usar comillas simples y un mensaje sin \n (newline opcional)
$startCmd = 'npm run start; Write-Host "Presione Enter para cerrar esta ventana..."; Read-Host'

if ($Inline) {
    Write-Host "Ejecutando en la terminal actual: npm run start"
    # Ejecutar en la sesión actual y mantener la salida visible
    Invoke-Expression $startCmd
} else {
    Write-Host "Abriendo nueva ventana de PowerShell y ejecutando: npm run start"
    # Usar Start-Process para abrir nueva ventana
    $argsList = @("-NoExit","-NoProfile","-Command","cd `"$projRoot`"; $startCmd")
    if ($NoElev) {
        # Abrir sin solicitar elevación
        Start-Process powershell -ArgumentList $argsList -WindowStyle Normal
    } else {
        # Por defecto, intentar abrir con elevación (RunAs) — si el usuario no tiene permisos, puede usar -Inline
        Start-Process powershell -ArgumentList $argsList -WindowStyle Normal -Verb RunAs
        Write-Host "Si la UAC solicita permisos, acepte para permitir abrir la ventana de servidor. Si no desea UAC, vuelva a ejecutar con -Inline o -NoElev." 
    }
}

Write-Host "Esperando unos segundos para que los servidores inicien..."
Start-Sleep -Seconds 3

# Intentar abrir la página de login en el navegador si existe el puerto predeterminado en package.json
try {
    $pkg = Get-Content -Raw -Path (Join-Path $projRoot 'package.json') | ConvertFrom-Json
    # start-all.js intenta elegir puertos libres; la URL final puede variar. Abriremos http://localhost:8080/src/pages/login.html como primera opción
    $tryUrls = @('http://127.0.0.1:8080/src/pages/login.html','http://127.0.0.1:8081/src/pages/login.html','http://127.0.0.1:8082/src/pages/login.html')
    foreach ($u in $tryUrls) {
        try {
            $r = Invoke-WebRequest -Uri $u -UseBasicParsing -Method Head -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {
                Start-Process $u
                Write-Host "Abriendo navegador en $u"
                break
            }
        } catch {
            # ignorar
        }
    }
} catch {
    # si falla leer package.json simplemente no abrir
}

Write-Host "Hecho. Revise la nueva ventana de PowerShell para los logs del servidor."
