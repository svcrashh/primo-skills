"""A parte do terminais.py que é do macOS: Terminal.app por AppleScript, zsh e caffeinate."""
import fcntl
import os
import shlex
import shutil
import signal
import subprocess
import sys
import time
from contextlib import suppress
from pathlib import Path

STORAGES = [
    Path.home() / "Library/Application Support/Code - Insiders/User/workspaceStorage",
    Path.home() / "Library/Application Support/Code/User/workspaceStorage",
]
# id, tty, pasta, sessão que abriu, data, base dos arquivos da janela. O fechar-terminal.sh lê daqui.
REGISTRO = Path("/private/tmp/claude-terminais-abertos.tsv")
FECHAR = Path(__file__).with_name("fechar-terminal.sh")
# Por janela: <base>.sh (o que ela roda), <base>.tty (gravado por ela ao nascer), <base>.estado
# (gravado pelos hooks), <base>.json e <base>.avisado (a parada que o esperar já contou).
CACHE = Path.home() / "Library/Caches/terminal-claude"
APP_TERMINAL = "/Terminal.app/Contents/MacOS/Terminal"
# Quanto o abrir espera a janela gravar o tty dela quando o Terminal falha no meio (o zsh dela ainda lê
# o .zshrc), e quanto procura a janela por esse tty.
ESPERA_TTY, ESPERA_JANELA = 5, 3

# O osascript passa o ambiente pro Terminal.app quando é ele que abre o app. Só vai o que o
# Dock passaria, pra não contaminar as janelas que o dono abrir depois na mão.
AMBIENTE_LIMPO = ["HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "SSH_AUTH_SOCK", "LANG",
                  "COMMAND_MODE", "__CF_USER_TEXT_ENCODING"]

# Devolve "<id> <tty>" da janela que abriu, com 0 no id quando não a achou. Depois do "do script" a
# janela já existe, e nada ali pode derrubar o script: percorrer as janelas dava -1719 ("não é possível
# obter item N of every window") quando uma sumia ou era fantasma no meio do caminho, e a janela ficava
# fora do registro (três vezes em 24/10/2026). A janela é achada pelo tty da aba que o "do script"
# devolve, cada uma num try, e o laço tenta de novo.
ABRIR_AS = """
on run argv
  set cmd to item 1 of argv
  set b to {(item 2 of argv) as integer, (item 3 of argv) as integer, (item 4 of argv) as integer, (item 5 of argv) as integer}
  if application "Terminal" is running then
    tell application "Terminal" to set aba to do script cmd
  else
    tell application "Terminal"
      activate
      set tries to 0
      repeat while (count of windows) = 0 and tries < 50
        delay 0.1
        set tries to tries + 1
      end repeat
      if (count of windows) > 0 then
        set aba to do script cmd in window 1
      else
        set aba to do script cmd
      end if
    end tell
  end if
  set alvo to ""
  set nova to 0
  repeat 50 times
    tell application "Terminal"
      if alvo is "" then
        try
          set alvo to tty of aba
        end try
      end if
      if alvo is not "" then
        try
          set ids to id of every window
        on error
          set ids to {}
        end try
        repeat with i in ids
          try
            if (tty of every tab of window id (contents of i)) contains alvo then set nova to contents of i
          end try
        end repeat
      end if
    end tell
    if nova is not 0 then exit repeat
    delay 0.1
  end repeat
  if nova is not 0 then
    try
      tell application "Terminal" to set frame of window id nova to b
    end try
  end if
  return (nova as text) & " " & alvo
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


def hook(estado):
    # Só grava o arquivo. Escrever no terminal daqui (a marca no título, por exemplo) cai no meio do
    # desenho da tela do claude e suja a janela.
    valor = '"${TERMINAL_CLAUDE_INICIO:-parada}"' if estado == "inicio" else estado
    return {"type": "command",
            "command": f'[ -n "$TERMINAL_CLAUDE_ESTADO" ] && printf %s {valor} > "$TERMINAL_CLAUDE_ESTADO"; true'}


def travar(arquivo):
    fcntl.flock(arquivo, fcntl.LOCK_EX)


def achar_claude():
    # Sem ele no PATH desta sessão, a janela chama "claude" e o zsh dela acha pelo PATH de lá.
    return shutil.which("claude")


def chamar_osa(*args):
    env = {k: os.environ[k] for k in AMBIENTE_LIMPO if k in os.environ}
    env["PATH"] = "/usr/bin:/bin:/usr/sbin:/sbin"
    return subprocess.run(["osascript", *args], capture_output=True, text=True, env=env)


def sair(erro):
    if "-1743" in erro:
        sys.exit("O macOS bloqueou o controle do Terminal. Libera em Ajustes do Sistema > "
                 "Privacidade e Segurança > Automação > (o app desta sessão) > Terminal "
                 "e roda de novo.")
    sys.exit(f"Falhou ao falar com o Terminal: {erro}")


def osa(*args):
    r = chamar_osa(*args)
    if r.returncode != 0:
        sair(r.stderr.strip())
    return r.stdout


def terminal_aberto():
    """O Terminal.app está rodando. Pelo ps, que dá o caminho do programa: o pgrep -x Terminal não o acha
    neste macOS (medido em 24/10/2026 no 26.6.2), e o vivas não lia janela nenhuma."""
    ps = subprocess.run(["ps", "-axo", "comm="], capture_output=True, text=True).stdout
    return any(linha.endswith(APP_TERMINAL) for linha in ps.splitlines())


def vivas():
    """id → tty de cada janela que a leitura do Terminal enxerga agora. Se ele não responder, nenhuma: a
    prova pelo tty (viva) segura as janelas do registro do mesmo jeito."""
    # Sem o Terminal aberto não chama o AppleScript: um "tell" abriria o app.
    if not terminal_aberto():
        return {}
    r = chamar_osa("-e", VIVAS_AS)
    if r.returncode != 0:
        return {}
    return {int(i): tty for i, tty in (l.split() for l in r.stdout.splitlines() if l.strip())}


def ttys_do_terminal():
    """ttys que ainda são de uma aba do Terminal: o login de cada aba é filho direto do app."""
    ps = subprocess.run(["ps", "-axo", "pid=,ppid=,tty=,comm="], capture_output=True, text=True).stdout
    procs = [p for p in (linha.split(None, 3) for linha in ps.splitlines()) if len(p) == 4]
    terminal = {pid for pid, _, _, comm in procs if comm.endswith(APP_TERMINAL)}
    return {"/dev/" + tty for _, pai, tty, _ in procs if pai in terminal}


def viva(abertas, linha):
    jid, tty = int(linha[0]), linha[1]
    # Confere o tty junto: o Terminal recomeça a contagem dos ids quando reabre, e um id velho no
    # registro faria o fechar-terminal.sh fechar a janela errada.
    if abertas.get(jid) == tty:
        return True
    # Aberta sem o Terminal dizer o id (veja o abrir): ganha o id da janela que tem o tty dela.
    if jid == 0 and tty in abertas.values():
        linha[0] = str(next(i for i, t in abertas.items() if t == tty))
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
        # É por ele que o abrir acha a janela quando o Terminal não diz qual abriu.
        f"tty > {q(base + '.tty')} 2>/dev/null",
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


def tty_da_janela(base):
    """O tty que a janela gravou ao nascer, ou "" se ela não gravou em ESPERA_TTY segundos."""
    arquivo, fim = Path(base + ".tty"), time.time() + ESPERA_TTY
    while time.time() < fim:
        if arquivo.exists() and (tty := arquivo.read_text().strip()).startswith("/dev/"):
            return tty
        time.sleep(0.1)
    return ""


def abrir(t, base, cfg, args, destino):
    """Abre a janela da trilha já no quadrado dela. Devolve (id, tty).

    Janela aberta sempre entra no registro. Se o AppleScript falha ou não acha a janela, ela é achada
    pelo tty que gravou ao nascer; se nem assim o Terminal disser o id, ela entra com id 0 e ganha o dela
    na primeira leitura que a enxergar (viva). Só sai com erro quando nenhuma janela abriu."""
    Path(base + ".sh").write_text(lancador(t, base, cfg, args))
    Path(base + ".tty").unlink(missing_ok=True)  # só vale o que esta janela gravar
    r = chamar_osa("-e", ABRIR_AS, f" . {shlex.quote(base + '.sh')}", *map(str, destino))
    if r.returncode != 0 and "-1743" in r.stderr:
        sair(r.stderr.strip())  # sem permissão o "do script" nem rodou
    partes = r.stdout.split() if r.returncode == 0 else []
    jid = int(partes[0]) if partes and partes[0].isdigit() else 0
    tty = partes[1] if len(partes) > 1 else ""
    if jid and tty:
        return jid, tty
    if not (tty := tty or tty_da_janela(base)):
        sair(r.stderr.strip() or "o Terminal não disse qual janela abriu, e nenhuma janela nova rodou a trilha")
    fim = time.time() + ESPERA_JANELA
    while not jid and time.time() < fim:
        jid = next((i for i, aberta in vivas().items() if aberta == tty), 0)
        if not jid:
            time.sleep(0.2)
    if jid:
        chamar_osa("-e", f'tell application "Terminal" to set frame of window id {jid} to {{{", ".join(map(str, destino))}}}')
    else:
        print(f"Aviso: o Terminal abriu a janela ({tty}) sem dizer o id dela: ela entrou no registro pelo tty e "
              "ganha o id na próxima leitura.")
    return jid, tty


def comando(t, base, cfg, args):
    """O que o terminal do Cory roda: o mesmo lancador da janela, num zsh de login e interativo como o
    do Terminal, e um shell na pasta quando o claude sai. O sh da frente grava o pid antes de o zsh ler os
    arquivos de inicialização, e o exec mantém o número. O --session-id do fim o sh não usa: é onde o Cory
    procura a sessão que roda no terminal."""
    Path(base + ".sh").write_text(lancador(t, base, cfg, args))
    q = shlex.quote
    zsh = f". {q(base + '.sh')}; /bin/zsh -l -i"
    return ["/bin/sh", "-c", f"echo $$ > {q(base + '.pid')}; exec /bin/zsh -l -i -c {q(zsh)}",
            "terminal-claude", "--session-id", t["sessao"]]


def processo_da_trilha(pid, base):
    """O processo ainda roda e é o do terminal desta trilha: o número pode ter passado a outro programa."""
    ps = subprocess.run(["ps", "-o", "stat=,command=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return bool(ps) and not ps.startswith("Z") and base + ".sh" in ps


def pais():
    ps = subprocess.run(["ps", "-axo", "pid=,ppid="], capture_output=True, text=True).stdout
    return {int(c[0]): int(c[1]) for c in (linha.split() for linha in ps.splitlines()) if len(c) == 2}


def processos():
    """(pai de cada processo, [(processo, porta em escuta)]), como no Windows."""
    lsof = subprocess.run(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"], capture_output=True, text=True).stdout
    escuta, dono = [], None
    for linha in lsof.splitlines():
        if linha.startswith("p"):
            dono = int(linha[1:])
        elif linha.startswith("n") and dono and (porta := linha.rsplit(":", 1)[-1]).isdigit():
            escuta.append((dono, int(porta)))
    return pais(), escuta


def matar(pid):
    """Encerra o processo e tudo que nasceu dele: primeiro pedindo, depois à força. O pedido vai como o
    do terminal que fecha (HUP, que o zsh interativo atende; TERM ele ignora) e como o do kill (TERM)."""
    pai, arvore = pais(), {pid}
    while novos := {p for p, pp in pai.items() if pp in arvore} - arvore:
        arvore |= novos
    for sinais in ((signal.SIGHUP, signal.SIGTERM), (signal.SIGKILL,)):
        for p in arvore:
            for sinal in sinais:
                with suppress(OSError):
                    os.kill(p, sinal)
        fim = time.time() + 2
        while time.time() < fim:
            ps = subprocess.run(["ps", "-o", "stat=", "-p", ",".join(map(str, arvore))], capture_output=True, text=True).stdout
            if not any(st.strip() and not st.strip().startswith("Z") for st in ps.splitlines()):
                return
            time.sleep(0.1)


def ativar(_ids):
    osa("-e", 'tell application "Terminal" to activate')


def tela(jid):
    return osa("-e", f'tell application "Terminal" to return contents of selected tab of window id {jid}').rstrip()


def fechar(args, registro, _sessao):
    codigo = subprocess.run(["/bin/zsh", str(FECHAR), *args]).returncode
    # O script só lê o registro. A janela que ele fechou sai aqui, com a trava.
    registro()
    sys.exit(codigo)
