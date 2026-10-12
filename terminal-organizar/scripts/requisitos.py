#!/usr/bin/env python3
"""O que a terminal-organizar precisa nesta máquina, e o que fazer com o que faltar. O instalador roda
isto depois de ligar as skills e mostra a saída; quem instala roda de novo quando quiser conferir.

    python requisitos.py        (python3 no Mac)

✔ tem · ✖ falta e é obrigatório · ○ falta e é opcional; embaixo de cada falta, o que fazer neste sistema.
Sem rede, não grava nada. Sai com 0 quando nada obrigatório falta e com 1 quando falta.
"""
import shutil
import sys

WIN = sys.platform == "win32"
MAC = sys.platform == "darwin"


def relatorio():
    linhas = ["terminal-organizar — arruma as janelas de terminal em grade, cada monitor com a sua; a "
              "terminal-claude usa a mesma grade para as janelas que abre."]
    falta = [False]

    def item(marca, texto, passos=()):
        linhas.append(f"{marca} {texto}")
        linhas.extend("    " + p for p in passos)
        if marca == "✖":
            falta[0] = True

    if not (WIN or MAC):
        item("✖", "Mac ou Windows: a skill arruma janelas do Terminal.app ou do Windows Terminal, e neste sistema não roda.")
        return "\n".join(linhas), True

    v = sys.version_info
    if v >= (3, 8):
        item("✔", f"Python {v.major}.{v.minor}.{v.micro}")
    else:
        item("✖", f"Python 3.8 ou mais novo (este é o {v.major}.{v.minor})",
             ["No PowerShell:", "     winget install Python.Python.3.12"] if WIN else ["No Terminal:", "     brew install python"])

    if WIN:
        if shutil.which("wt"):
            item("✔", "Windows Terminal (wt)")
        else:
            item("✖", "Windows Terminal (wt): são as janelas dele que a skill arruma",
                 ["No PowerShell:", "     winget install Microsoft.WindowsTerminal",
                  "Depois feche e abra o PowerShell, para ele achar o wt."])
    else:
        item("✔", "Terminal.app (já vem no macOS)",
             ["Na primeira vez, o macOS pergunta se o app em que o Claude roda (Terminal, VS Code…) pode controlar "
              "o Terminal: clique em OK. Se negou, libere em Ajustes do Sistema > Privacidade e Segurança > Automação."])
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
