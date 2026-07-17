$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$arguments = @(
    'run'
    'dev'
    '--'
    '--host'
    '127.0.0.1'
    '--port'
    '4175'
)

$process = Start-Process `
    -FilePath $npmCommand `
    -ArgumentList $arguments `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru

Write-Output "dev_server_pid=$($process.Id)"

$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    try {
        $response = Invoke-WebRequest `
            -Uri 'http://127.0.0.1:4175' `
            -UseBasicParsing `
            -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}

if (-not $ready) {
    throw 'Development server did not become ready.'
}

Write-Output 'dev_server_ready=true'
