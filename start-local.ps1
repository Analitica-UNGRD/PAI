<#
start-local.ps1

Script auxiliar para levantar el frontend Login_predeterminado en Windows PowerShell.

Acciones:
- Verifica que node y npm existan.
- Pregunta por npm install si faltan dependencias.
- Ejecuta `npm run start` en la misma ventana (por defecto) o en una nueva con -NewWindow.
- Abre el login en el navegador cuando detecta que el servidor respondio.

Uso:
  ./start-local.ps1            # ejecuta npm run start en la terminal actual
  ./start-local.ps1 -NewWindow # abre una nueva consola (usar -NoElev para evitar UAC)
  ./start-local.ps1 -Inline    # equivalente al comportamiento por defecto
#>

[CmdletBinding()]
param(
    [switch]$Inline,
    [switch]$NewWindow,
    [switch]$NoElev
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-CommandExists {
    param([Parameter(Mandatory)][string]$Name)
    try {
        Get-Command -Name $Name -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Resolve-PowerShellExecutable {
    try {
        if ($PSVersionTable.PSEdition -eq "Desktop" -or $IsWindows) {
            $cmd = Get-Command -Name powershell.exe -ErrorAction SilentlyContinue
            if ($cmd) { return $cmd.Path }
        }
        $pwshCmd = Get-Command -Name pwsh -ErrorAction SilentlyContinue
        if ($pwshCmd) { return $pwshCmd.Path }
    } catch {
        # ignorar
    }
    try {
        return (Get-Process -Id $PID).Path
    } catch {
        return 'powershell'
    }
}

function ShouldForceInline {
    param([bool]$InlineAlready)
    if ($InlineAlready) { return $false }
    if ($env:VSCODE_PID) { return $true }
    if ($Host.Name -like '*Visual Studio Code*') { return $true }
    return $false
}

$tryUrls = @(
    'http://127.0.0.1:8080/src/pages/login.html',
    'http://127.0.0.1:8081/src/pages/login.html',
    'http://127.0.0.1:8082/src/pages/login.html'
)

function Start-BrowserWatcher {
    param(
        [string[]]$Urls,
        [int]$InitialDelaySeconds = 2,
        [int]$TimeoutSeconds = 45
    )

    try {
        return Start-Job -Name 'PAI_OpenBrowser' -ArgumentList @($Urls, $InitialDelaySeconds, $TimeoutSeconds) -ScriptBlock {
            param($urls, $initialDelay, $timeoutSeconds)

            Start-Sleep -Seconds $initialDelay

            foreach ($url in $urls) {
                $deadline = (Get-Date).AddSeconds($timeoutSeconds)
                while ((Get-Date) -lt $deadline) {
                    try {
                        $request = [System.Net.WebRequest]::Create($url)
                        $request.Method = 'HEAD'
                        $request.Timeout = 2000
                        $response = $request.GetResponse()
                        try {
                            if ($response) { $response.Close() }
                        } catch { }

                        Start-Process $url | Out-Null
                        return
                    } catch {
                        Start-Sleep -Milliseconds 500
                    }
                }
            }
        }
    } catch {
        Write-Warning "No fue posible iniciar el monitor del navegador: $($_.Exception.Message)"
        return $null
    }
}

Write-Host 'Iniciando start-local.ps1 para Login_predeterminado...'

if (-not (Test-CommandExists -Name 'node')) {
    Write-Error 'Node.js no esta instalado o no esta en PATH. Instale Node.js (https://nodejs.org/) y vuelva a intentarlo.'
    exit 1
}

if (-not (Test-CommandExists -Name 'npm')) {
    Write-Error 'npm no esta disponible. Asegurese de que Node.js y npm esten instalados correctamente.'
    exit 1
}

$projRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projRoot
Write-Host "Directorio del proyecto: $projRoot"

if (-not (Test-Path -LiteralPath (Join-Path $projRoot 'node_modules'))) {
    Write-Host "node_modules no encontrado. Desea ejecutar 'npm install'? (Y/N)"
    $ans = Read-Host
    if ($ans -match '^[Yy]') {
        Write-Host 'Ejecutando npm install...'
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error 'npm install fallo. Revise los errores anteriores.'
            exit $LASTEXITCODE
        }
    } else {
        Write-Warning 'Continuando sin instalar dependencias. Esto puede fallar al iniciar el servidor.'
    }
}

$runInline = $true
if ($PSBoundParameters.ContainsKey('NewWindow')) { $runInline = $false }
elseif ($PSBoundParameters.ContainsKey('Inline')) { $runInline = $Inline.IsPresent }

if (ShouldForceInline -InlineAlready:$runInline) {
    Write-Warning 'Entorno detectado dentro de VSCode/EditorServices. Ejecutando en modo Inline para evitar errores de EditorServices.'
    $runInline = $true
}

$startCmd = 'npm run start; Write-Host "Presione Enter para cerrar esta ventana..."; Read-Host'

Write-Host 'Abriremos el navegador automaticamente cuando el servidor responda correctamente.'
$browserJob = Start-BrowserWatcher -Urls $tryUrls -InitialDelaySeconds 2 -TimeoutSeconds 60
if ($browserJob) { Write-Host ("Monitor del login ejecutandose (JobId: {0})" -f $browserJob.Id) }

if ($runInline) {
    Write-Host 'Ejecutando en la terminal actual: npm run start'
    Invoke-Expression $startCmd
} else {
    Write-Host 'Abriendo nueva ventana de PowerShell y ejecutando: npm run start'
    $shellExe = Resolve-PowerShellExecutable
    $cmd = "Set-Location -LiteralPath '$projRoot'; $startCmd"
    $argsList = @('-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-Command', $cmd)
    try {
        if ($NoElev) {
            Start-Process -FilePath $shellExe -ArgumentList $argsList -WindowStyle Normal
        } else {
            try {
                Start-Process -FilePath $shellExe -ArgumentList $argsList -WindowStyle Normal -Verb RunAs
            } catch {
                Write-Warning 'No se pudo solicitar elevacion (RunAs). Reintentando sin elevacion.'
                Start-Process -FilePath $shellExe -ArgumentList $argsList -WindowStyle Normal
            }
        }
    } catch {
        Write-Warning "No se pudo abrir una nueva ventana: $($_.Exception.Message). Ejecutando en modo Inline."
        Invoke-Expression $startCmd
        return
    }

    Write-Host 'Hecho. Revise la nueva ventana de PowerShell para los logs del servidor.'
}
