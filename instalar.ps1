# Liga cada skill deste repositório na pasta de skills do Claude (padrão: $HOME\.claude\skills).
# Usa junção, que não pede administrador. É ligação, não cópia: editar aqui já vale no Claude.
# No fim, cada skill que tem scripts\requisitos.mjs (roda com node) ou scripts\requisitos.py (roda com python) diz o que
# precisa nesta maquina e o que falta (chave de API, ffmpeg, Node, Python), com o que fazer. Rodar de novo nao desfaz
# nada: serve para conferir depois de arrumar.
# As mensagens daqui vao sem acento: o Windows PowerShell 5.1 le este arquivo como ANSI e trocaria os caracteres.
# Uso: instalar.ps1 [pasta de skills de outro perfil]
param([string]$Destino = (Join-Path $HOME ".claude\skills"))
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$skills = Get-ChildItem -Directory $PSScriptRoot | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") }
foreach ($skill in $skills) {
    $alvo = Join-Path $Destino $skill.Name
    # Get-Item, e nao Test-Path: a juncao que aponta para uma pasta que nao existe mais (repositorio movido) ainda esta la.
    $atual = Get-Item -LiteralPath $alvo -Force -ErrorAction SilentlyContinue
    if ($atual) {
        if (-not $atual.LinkType) {
            Write-Host "$($skill.Name): ja existe uma pasta de verdade em $alvo. Nao mexi: renomeie ou apague e rode de novo."
            continue
        }
        $atual.Delete()
    }
    New-Item -ItemType Junction -Path $alvo -Target $skill.FullName | Out-Null
    Write-Host "$($skill.Name) -> $alvo"
}

$requisitos = foreach ($skill in $skills) {
    $mjs = Join-Path $skill.FullName "scripts\requisitos.mjs"
    $py = Join-Path $skill.FullName "scripts\requisitos.py"
    if (Test-Path $mjs) { [pscustomobject]@{ Skill = $skill.Name; Arquivo = $mjs; Programa = "node" } }
    elseif (Test-Path $py) { [pscustomobject]@{ Skill = $skill.Name; Arquivo = $py; Programa = "python" } }
}
if ($requisitos) {
    Write-Host ""
    Write-Host "O que cada skill precisa nesta maquina:"
    $programas = @{ node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 }
    # O Windows traz um python.exe de mentira, o atalho da Microsoft Store: ele aparece no PATH, mas so diz
    # "Python was not found" e sai com 9009. Conta como Python so o que roda de verdade.
    $python = Get-Command python -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $pythonDaLoja = $false
    if ($python) {
        & $python.Source -c "import sys; sys.exit(sys.version_info[0] != 3)" 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { $python = $null; $pythonDaLoja = $true }
    }
    $programas.python = $python

    # A saida dos requisitos tem acento e os sinais de cada item, em UTF-8. Quando ela vai para outro programa (o Claude
    # rodando este instalador, por exemplo), sem isto o 5.1 troca os caracteres e o Python pode parar com erro.
    # Tudo volta como estava no fim.
    $saidaAntes = [Console]::OutputEncoding
    $ioAntes = $env:PYTHONIOENCODING
    try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}
    $env:PYTHONIOENCODING = "utf-8"
    # Na janela antiga do console (a do Windows 10), as fontes dela (Consolas, Lucida Console) nao tem os sinais de
    # "tem" e "falta" (U+2714 e U+2716): os dois viram o mesmo quadradinho. Ali, e so ali, eles viram os que essas fontes
    # tem (U+221A e U+00D7). O Windows Terminal e o VS Code acham o sinal em outra fonte e mostram o original.
    $consoleAntigo = -not [Console]::IsOutputRedirected -and -not $env:WT_SESSION -and -not $env:TERM_PROGRAM
    $semPrograma = @{ node = @(); python = @() }
    try {
        foreach ($r in $requisitos) {
            $programa = $programas[$r.Programa]
            if (-not $programa) { $semPrograma[$r.Programa] += $r.Skill; continue }
            Write-Host ""
            if ($consoleAntigo) {
                & $programa.Source $r.Arquivo | ForEach-Object { $_.Replace([string][char]0x2714, [string][char]0x221A).Replace([string][char]0x2716, [string][char]0x00D7) }
            } else {
                & $programa.Source $r.Arquivo
            }
        }
    } finally {
        try { [Console]::OutputEncoding = $saidaAntes } catch {}
        $env:PYTHONIOENCODING = $ioAntes
    }

    if ($semPrograma.node) {
        Write-Host ""
        Write-Host "Falta o Node (18 ou mais novo), e sem ele nao da para conferir nem usar: $($semPrograma.node -join ', ')."
        Write-Host "    winget install OpenJS.NodeJS.LTS"
        Write-Host "    Se o winget perguntar se voce aceita os termos, digite Y e Enter."
        Write-Host "    Depois feche e abra o PowerShell e rode este instalador de novo."
    }
    if ($semPrograma.python) {
        Write-Host ""
        if ($pythonDaLoja) {
            Write-Host "Falta o Python 3: o python que existe aqui e o atalho da Microsoft Store, que nao roda nada. Sem o Python nao da para conferir nem usar: $($semPrograma.python -join ', ')."
        } else {
            Write-Host "Falta o Python 3, e sem ele nao da para conferir nem usar: $($semPrograma.python -join ', ')."
        }
        Write-Host "    winget install Python.Python.3.12"
        Write-Host "    Se o winget perguntar se voce aceita os termos, digite Y e Enter."
        Write-Host "    Depois feche e abra o PowerShell e rode este instalador de novo."
    }
    Write-Host ""
    Write-Host "Arrumou algo? Rode o instalador de novo para conferir."
}
