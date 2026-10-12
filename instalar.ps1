# Liga cada skill deste repositório na pasta de skills do Claude (padrão: $HOME\.claude\skills).
# Usa junção, que não pede administrador. É ligação, não cópia: editar aqui já vale no Claude.
# No fim, cada skill que tem scripts\requisitos.mjs diz o que precisa nesta maquina e o que falta (chave de API,
# ffmpeg, Node), com o que fazer. Rodar de novo nao desfaz nada: serve para conferir depois de arrumar.
# Uso: instalar.ps1 [pasta de skills de outro perfil]
param([string]$Destino = (Join-Path $HOME ".claude\skills"))
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
Get-ChildItem -Directory $PSScriptRoot | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") } | ForEach-Object {
    $alvo = Join-Path $Destino $_.Name
    if (Test-Path $alvo) {
        $atual = Get-Item $alvo -Force
        if (-not $atual.LinkType) {
            Write-Host "$($_.Name): ja existe uma pasta de verdade em $alvo. Nao mexi: renomeie ou apague e rode de novo."
            return
        }
        $atual.Delete()
    }
    New-Item -ItemType Junction -Path $alvo -Target $_.FullName | Out-Null
    Write-Host "$($_.Name) -> $alvo"
}

$requisitos = Get-ChildItem -Directory $PSScriptRoot | ForEach-Object { Join-Path $_.FullName "scripts\requisitos.mjs" } | Where-Object { Test-Path $_ }
if ($requisitos) {
    Write-Host ""
    Write-Host "O que cada skill precisa nesta maquina:"
    if (Get-Command node -ErrorAction SilentlyContinue) {
        # A saida dos requisitos tem acento e simbolos: sem isto o console do Windows pode trocar os caracteres.
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        foreach ($r in $requisitos) {
            Write-Host ""
            & node $r
        }
    } else {
        Write-Host ""
        Write-Host "Falta o Node (18 ou mais novo), e sem ele nao da para conferir nem usar as skills que dependem dele."
        Write-Host "    winget install OpenJS.NodeJS.LTS"
        Write-Host "    Depois rode este instalador de novo."
    }
    Write-Host ""
    Write-Host "Arrumou algo? Rode o instalador de novo para conferir."
}
