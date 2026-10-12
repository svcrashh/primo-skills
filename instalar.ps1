# Liga cada skill deste repositório na pasta de skills do Claude (padrão: $HOME\.claude\skills).
# Usa junção, que não pede administrador. É ligação, não cópia: editar aqui já vale no Claude.
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
