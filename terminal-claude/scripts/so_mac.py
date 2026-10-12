"""A parte do terminais.py que é do macOS: Terminal.app por AppleScript, zsh e caffeinate."""
import fcntl
import os
import shlex
import subprocess
import sys
from pathlib import Path

STORAGES = [
    Path.home() / "Library/Application Support/Code - Insiders/User/workspaceStorage",
    Path.home() / "Library/Application Support/Code/User/workspaceStorage",
]
# id, tty, pasta, sessão que abriu, data, base dos arquivos da janela. O fechar-terminal.sh lê daqui.
REGISTRO = Path("/private/tmp/claude-terminais-abertos.tsv")
FECHAR = Path(__file__).with_name("fechar-terminal.sh")
# Por janela: <base>.sh (o que ela roda), <base>.estado (gravado pelos hooks), <base>.json e
# <base>.avisado (a parada que o esperar já contou).
CACHE = Path.home() / "Library/Caches/terminal-claude"

# O osascript passa o ambiente pro Terminal.app quando é ele que abre o app. Só vai o que o
# Dock passaria, pra não contaminar as janelas que o dono abrir depois na mão.
AMBIENTE_LIMPO = ["HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "SSH_AUTH_SOCK", "LANG",
                  "COMMAND_MODE", "__CF_USER_TEXT_ENCODING"]

ABRIR_AS = """
on run argv
  set cmd to item 1 of argv
  set b to {(item 2 of argv) as integer, (item 3 of argv) as integer, (item 4 of argv) as integer, (item 5 of argv) as integer}
  if application "Terminal" is running then
    tell application "Terminal"
      set antes to id of every window
      do script cmd
      repeat with w in windows
        if antes does not contain (id of w) then set nova to id of w
      end repeat
    end tell
  else
    tell application "Terminal"
      activate
      set tries to 0
      repeat while (count of windows) = 0 and tries < 50
        delay 0.1
        set tries to tries + 1
      end repeat
      if (count of windows) > 0 then
        do script cmd in window 1
      else
        do script cmd
      end if
      set nova to id of window 1
    end tell
  end if
  tell application "Terminal"
    set frame of window id nova to b
    return (nova as text) & " " & (tty of selected tab of window id nova)
  end tell
end run
"""

# Janela fechada continua na lista como objeto fantasma (visible falso, zero abas).
VIVAS_AS = """
tell application "Terminal"
  set out to ""
  repeat with w in windows
    try
      if (count of tabs of w) > 0 and (visible of w) then set out to out & (id of w) & " " & (tty of selected tab of w) & linefeed
    end try
  end repeat
  return out
end tell
"""


def subcomandos(sub):
    pass


def comando_hook(estado):
    # Só grava o arquivo. Escrever no terminal daqui (a marca no título, por exemplo) cai no meio do
    # desenho da tela do claude e suja a janela.
    valor = '"${TERMINAL_CLAUDE_INICIO:-parada}"' if estado == "inicio" else estado
    return f'[ -n "$TERMINAL_CLAUDE_ESTADO" ] && printf %s {valor} > "$TERMINAL_CLAUDE_ESTADO"; true'


def travar(arquivo):
    fcntl.flock(arquivo, fcntl.LOCK_EX)


def osa(*args):
    env = {k: os.environ[k] for k in AMBIENTE_LIMPO if k in os.environ}
    env["PATH"] = "/usr/bin:/bin:/usr/sbin:/sbin"
    r = subprocess.run(["osascript", *args], capture_output=True, text=True, env=env)
    if r.returncode != 0:
        erro = r.stderr.strip()
        if "-1743" in erro:
            sys.exit("O macOS bloqueou o controle do Terminal. Libera em Ajustes do Sistema > "
                     "Privacidade e Segurança > Automação > (o app desta sessão) > Terminal "
                     "e roda de novo.")
        sys.exit(f"Falhou ao falar com o Terminal: {erro}")
    return r.stdout


def vivas():
    """id → tty de cada janela que a leitura do Terminal enxerga agora."""
    # Sem o Terminal aberto não chama o AppleScript: um "tell" abriria o app.
    if subprocess.run(["pgrep", "-xq", "Terminal"]).returncode != 0:
        return {}
    return {int(i): tty for i, tty in (l.split() for l in osa("-e", VIVAS_AS).splitlines() if l.strip())}


def ttys_do_terminal():
    """ttys que ainda são de uma aba do Terminal: o login de cada aba é filho direto do app."""
    ps = subprocess.run(["ps", "-axo", "pid=,ppid=,tty=,comm="], capture_output=True, text=True).stdout
    procs = [p for p in (linha.split(None, 3) for linha in ps.splitlines()) if len(p) == 4]
    terminal = {pid for pid, _, _, comm in procs if comm.endswith("/Terminal.app/Contents/MacOS/Terminal")}
    return {"/dev/" + tty for _, pai, tty, _ in procs if pai in terminal}


def viva(abertas, linha):
    jid, tty = int(linha[0]), linha[1]
    # Confere o tty junto: o Terminal recomeça a contagem dos ids quando reabre, e um id velho no
    # registro faria o fechar-terminal.sh fechar a janela errada.
    if abertas.get(jid) == tty:
        return True
    # A leitura não ver a janela não prova que ela fechou: o AppleScript erra ou dá "visible" falso
    # por um instante, e em 12/10/2026 uma janela foi esquecida assim com o claude dela rodando. Ela
    # só morreu se outra janela já usa o tty ou se ele não é mais de aba nenhuma do Terminal.
    return tty not in abertas.values() and tty in ttys_do_terminal()


def lancador(t, base, cfg, args):
    """O que a janela roda. Vai num arquivo e a janela só recebe ". <arquivo>": prompt longo, com
    aspas ou com várias linhas chega inteiro, sem depender de digitar tudo no shell."""
    q = shlex.quote
    return "\n".join([
        f"cd -- {q(str(t['pasta']))} || return",
        # Com os marcadores da sessão que chamou (CLAUDE_CODE_CHILD_SESSION etc.) o claude novo vira
        # sessão-filha e não salva a conversa. Sai tudo que é CLAUDE*; o perfil volta na linha seguinte.
        "for v in $(env | sed -n 's/^\\(CLAUDE[A-Za-z0-9_]*\\)=.*/\\1/p') AI_AGENT; do unset \"$v\"; done; unset v",
        # Só exporta se a sessão tem: CLAUDE_CONFIG_DIR=~/.claude faria o claude ler outro .claude.json.
        *([f"export CLAUDE_CONFIG_DIR={q(cfg)}"] if cfg else []),
        f"export TERMINAL_CLAUDE_ESTADO={q(base + '.estado')} "
        f"TERMINAL_CLAUDE_INICIO={'trabalhando' if t.get('prompt') else 'parada'}",
        "clear",
        "caffeinate -ims " + " ".join(map(q, args)),
        # O claude já saiu e não desenha mais nada: aqui dá pra escrever o título sem sujar a tela.
        f"printf encerrada > \"$TERMINAL_CLAUDE_ESTADO\"; printf '\\033]0;%s\\007' {q(t['titulo'] + ' · encerrada')}",
        "unset TERMINAL_CLAUDE_ESTADO TERMINAL_CLAUDE_INICIO",
    ]) + "\n"


def abrir(t, base, cfg, args, destino):
    """Abre a janela da trilha já no quadrado dela. Devolve (id, tty)."""
    Path(base + ".sh").write_text(lancador(t, base, cfg, args))
    jid, tty = osa("-e", ABRIR_AS, f" . {shlex.quote(base + '.sh')}", *map(str, destino)).split()
    return int(jid), tty


def ativar(_ids):
    osa("-e", 'tell application "Terminal" to activate')


def tela(jid):
    return osa("-e", f'tell application "Terminal" to return contents of selected tab of window id {jid}').rstrip()


def fechar(args, registro, _sessao):
    codigo = subprocess.run(["/bin/zsh", str(FECHAR), *args]).returncode
    # O script só lê o registro. A janela que ele fechou sai aqui, com a trava.
    registro()
    sys.exit(codigo)
