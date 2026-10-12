#!/usr/bin/env python3
"""O que a terminal-claude precisa nesta máquina, e o que fazer com o que faltar. O instalador roda isto
depois de ligar as skills e mostra a saída; quem instala roda de novo quando quiser conferir.

    python requisitos.py        (python3 no Mac)

✔ tem · ✖ falta e é obrigatório · ○ falta e é opcional; embaixo de cada falta, o que fazer neste sistema.
Sem rede, não grava nada. Sai com 0 quando nada obrigatório falta e com 1 quando falta.
"""
import os
import shutil
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
WIN = sys.platform == "win32"
MAC = sys.platform == "darwin"


def curto(caminho):
    casa = str(Path.home())
    caminho = str(caminho)
    if caminho.lower().startswith(casa.lower()):
        return ("%USERPROFILE%" if WIN else "~") + caminho[len(casa):]
    return caminho


def instalar_claude():
    if WIN:
        return ["No PowerShell:",
                "     irm https://claude.ai/install.ps1 | iex",
                "Ele instala em %USERPROFILE%\\.local\\bin\\claude.exe, mas não põe essa pasta no PATH. Ponha com:",
                "     " + PATH_WIN,
                "Depois feche e abra o PowerShell (e o VS Code, se o Claude roda nele)."]
    return ["No Terminal:",
            "     curl -fsSL https://claude.ai/install.sh | bash",
            "Se no fim ele disser que ~/.local/bin não está no PATH:",
            "     echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.zshrc",
            "Depois feche e abra o Terminal."]


PATH_WIN = ("[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') "
            "+ ';' + $env:USERPROFILE + '\\.local\\bin', 'User')")


def relatorio():
    linhas = ["terminal-claude — abre janelas de terminal com o Claude, uma por trilha, acompanha cada uma "
              "e fecha quando ela termina."]
    falta = [False]

    def item(marca, texto, passos=()):
        linhas.append(f"{marca} {texto}")
        linhas.extend("    " + p for p in passos)
        if marca == "✖":
            falta[0] = True

    if not (WIN or MAC):
        item("✖", "Mac ou Windows: a skill abre janelas do Terminal.app ou do Windows Terminal, e neste sistema não roda.")
        return "\n".join(linhas), True

    v = sys.version_info
    if v >= (3, 8):
        item("✔", f"Python {v.major}.{v.minor}.{v.micro}")
    else:
        item("✖", f"Python 3.8 ou mais novo (este é o {v.major}.{v.minor})",
             ["No PowerShell:", "     winget install Python.Python.3.12"] if WIN else ["No Terminal:", "     brew install python"])

    # A mesma busca do terminais.py (achar_claude no so_windows.py e no so_mac.py).
    achado = shutil.which("claude")
    nativo = Path.home() / (".local/bin/claude.exe" if WIN else ".local/bin/claude")
    npm = None
    if WIN and achado and achado.lower().endswith((".cmd", ".bat")):
        npm = Path(achado).parent / "node_modules" / "@anthropic-ai" / "claude-code" / "bin" / "claude.exe"
        achado = None
    if achado:
        item("✔", f"claude ({curto(achado)})")
    elif npm and npm.exists():
        item("✔", "claude (o do npm: a skill chama direto o claude.exe que vem no pacote)")
    elif WIN and nativo.exists():
        item("✔", f"claude ({curto(nativo)}): a skill acha ele lá, mesmo fora do PATH",
             ["Para o comando claude valer também no PowerShell, ponha a pasta no PATH:", "     " + PATH_WIN])
    elif npm:
        item("✖", "claude: o do PATH é um claude.cmd, e por ele o prompt de várias linhas chega só com a primeira. "
                  "A skill precisa do claude nativo.", instalar_claude())
    elif nativo.exists():
        item("✖", f"claude: está em {curto(nativo)}, mas essa pasta não está no PATH, e a janela não acha ele",
             ["No Terminal:", "     echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.zshrc",
              "Depois feche e abra o Terminal."])
    else:
        item("✖", "claude: não achei no PATH. É ele que roda em cada janela.", instalar_claude())

    if WIN:
        if shutil.which("wt"):
            item("✔", "Windows Terminal (wt)")
        else:
            item("✖", "Windows Terminal (wt): é nele que as janelas abrem",
                 ["No PowerShell:", "     winget install Microsoft.WindowsTerminal",
                  "Depois feche e abra o PowerShell, para ele achar o wt."])
    else:
        item("✔", "Terminal.app (já vem no macOS)",
             ["Na primeira janela, o macOS pergunta se o app em que o Claude roda (Terminal, VS Code…) pode controlar "
              "o Terminal: clique em OK. Se negou, libere em Ajustes do Sistema > Privacidade e Segurança > Automação."])

    if (AQUI.parents[1] / "terminal-organizar" / "scripts" / "organizar.py").exists():
        item("✔", "terminal-organizar ao lado (a grade das janelas)")
    else:
        item("✖", "terminal-organizar: a terminal-claude usa a grade dela e precisa dela na pasta ao lado",
             ["Instale as duas juntas, pelo instalador do repositório."])
    return "\n".join(linhas), falta[0]


if __name__ == "__main__":
    for saida in (sys.stdout, sys.stderr):
        try:
            saida.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    texto, faltou = relatorio()
    print(texto)
    sys.exit(1 if faltou else 0)
