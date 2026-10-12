"""A parte do terminais.py que é do Windows: Windows Terminal (wt.exe), janelas por Win32 e o
processo que cada janela roda.

Escrito no Mac em 11/10/2026 e ainda não executado num Windows de verdade: a lógica foi exercitada
com as chamadas do sistema simuladas. Na primeira vez, rode `terminais.py abrir --dry-run`.
"""
import json
import msvcrt
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import janelas_win as win  # mora no terminal-organizar; o terminais.py põe a pasta no caminho

MOTOR = Path(__file__).with_name("terminais.py")
STORAGES = [
    Path(os.environ["APPDATA"]) / "Code - Insiders/User/workspaceStorage",
    Path(os.environ["APPDATA"]) / "Code/User/workspaceStorage",
]
# id da janela (hwnd), pid do processo que ela roda, pasta, sessão que abriu, data, base dos arquivos.
REGISTRO = Path(tempfile.gettempdir()) / "claude-terminais-abertos.tsv"
# Por janela: <base>.json (o que ela roda), <base>.pid, <base>.estado (gravado pelos hooks) e
# <base>.avisado (a parada que o esperar já contou).
CACHE = Path(os.environ["LOCALAPPDATA"]) / "terminal-claude"


def marcador(nome):
    # Com os marcadores da sessão que chamou (CLAUDE_CODE_CHILD_SESSION etc.) o claude novo vira
    # sessão-filha e não salva a conversa.
    return nome.upper().startswith("CLAUDE") or nome.upper() == "AI_AGENT"


def subcomandos(sub):
    rodar_ = sub.add_parser("rodar")
    rodar_.add_argument("base")
    rodar_.set_defaults(func=rodar)
    marcar_ = sub.add_parser("marcar")
    marcar_.add_argument("estado")
    marcar_.set_defaults(func=marcar)


def comando_hook(estado):
    # O hook pode rodar em bash, cmd ou PowerShell. Caminho sem aspas vale nos três; com aspas o
    # PowerShell não chama, então elas só entram quando há espaço no caminho.
    def q(caminho):
        caminho = Path(caminho).as_posix()
        return f'"{caminho}"' if " " in caminho else caminho
    return f"{q(sys.executable)} {q(MOTOR)} marcar {estado}"


def marcar(a):
    """Chamado pelos hooks: grava o estado da trilha. Não escreve no terminal, pra não sujar a tela."""
    if destino := os.environ.get("TERMINAL_CLAUDE_ESTADO"):
        estado = os.environ.get("TERMINAL_CLAUDE_INICIO", "parada") if a.estado == "inicio" else a.estado
        Path(destino).write_text(estado, encoding="utf-8")


def travar(arquivo):
    # O LK_LOCK desiste depois de 10 s, e abrir um lote demora mais que isso: insiste.
    while True:
        try:
            msvcrt.locking(arquivo.fileno(), msvcrt.LK_LOCK, 1)
            return
        except OSError:
            pass


def vivas():
    return None


def linha_de_comando(pid):
    """Como o processo foi chamado; vazio se não der pra saber."""
    ps = f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine"
    return subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True).stdout


def viva(_abertas, linha):
    hwnd, pid, base = int(linha[0]), int(linha[1]), linha[5]
    if not win.processo_vivo(pid):
        return False
    # O Windows reaproveita o número da janela e o do processo: os dois juntos são a janela. Não ver
    # a janela não basta para esquecê-la (a aba pode ter ido para outra): com o número do processo
    # ainda em uso, ela só morreu se quem o usa já não for o `rodar` desta trilha.
    return win.existe(hwnd) or linha_de_comando(pid).strip().strip('"').endswith(base)


def esperar(olhar, o_que, segundos=20):
    fim = time.time() + segundos
    while time.time() < fim:
        if (achou := olhar()) is not None:
            return achou
        time.sleep(0.1)
    sys.exit(f"Abri o Windows Terminal, mas não vi {o_que} em {segundos} s.")


def abrir(t, base, cfg, args, destino):
    """Abre a janela da trilha e a põe no quadrado dela. Devolve (hwnd, pid do processo da janela)."""
    wt = shutil.which("wt")
    if not wt:
        sys.exit("Não achei o Windows Terminal (wt.exe). Instala com: winget install Microsoft.WindowsTerminal")
    antes = {j[0] for j in win.janelas()}
    # Se for este o primeiro Windows Terminal aberto, as janelas que o dono abrir depois na mão
    # herdam o ambiente daqui: vai sem os marcadores desta sessão.
    limpo = {k: v for k, v in os.environ.items() if not marcador(k)}
    subprocess.Popen([wt, "-w", "new", "nt", "--title", t["titulo"], "-d", str(t["pasta"]),
                      sys.executable, str(MOTOR), "rodar", base], env=limpo)
    hwnd = esperar(lambda: next(iter({j[0] for j in win.janelas()} - antes), None), "a janela nova")
    pid = esperar(lambda: (Path(base + ".pid").read_text().strip() or None)
                  if Path(base + ".pid").exists() else None, "o processo da janela começar")
    win.mover(hwnd, *destino)
    return hwnd, pid


def rodar(a):
    """O que cada janela roda: o claude da trilha e, quando ele sai, um shell na pasta dela.

    É o Python que chama o claude, com os argumentos lidos do <base>.json: prompt longo, com aspas
    ou com várias linhas chega inteiro, sem passar pela linha de comando do PowerShell.
    """
    meta = json.loads(Path(a.base + ".json").read_text(encoding="utf-8"))
    Path(a.base + ".pid").write_text(str(os.getpid()))
    env = {k: v for k, v in os.environ.items() if not marcador(k)}
    # Só define se a sessão tinha: CLAUDE_CONFIG_DIR apontando pro perfil padrão muda o que o claude lê.
    if meta["config"]:
        env["CLAUDE_CONFIG_DIR"] = meta["config"]
    win.manter_acordado()
    subprocess.call(meta["args"], cwd=meta["pasta"],
                    env={**env, "TERMINAL_CLAUDE_ESTADO": a.base + ".estado", "TERMINAL_CLAUDE_INICIO": meta["inicio"]})
    win.manter_acordado(False)
    Path(a.base + ".estado").write_text("encerrada", encoding="utf-8")
    subprocess.call([shutil.which("pwsh") or "powershell", "-NoLogo"], cwd=meta["pasta"], env=env)


def ativar(ids):
    if ids:
        win.trazer_para_frente(ids[-1])


def tela(_jid):
    return None  # o Windows Terminal não deixa ler a tela de fora


def processos():
    """(pai de cada processo, [(processo, porta em escuta)]), numa consulta só."""
    ps = ('Get-CimInstance Win32_Process | ForEach-Object { "p $($_.ProcessId) $($_.ParentProcessId)" }; '
          'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | '
          'ForEach-Object { "l $($_.OwningProcess) $($_.LocalPort)" }')
    saida = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True).stdout
    pai, escuta = {}, []
    for c in (linha.split() for linha in saida.splitlines()):
        if len(c) == 3 and c[0] == "p":
            pai[int(c[1])] = int(c[2])
        elif len(c) == 3 and c[0] == "l":
            escuta.append((int(c[1]), int(c[2])))
    return pai, escuta


def servidores(pid, pai, escuta):
    """Portas em escuta de processos nascidos dentro da janela (dev server, proxy, watcher)."""
    def nasceu_dentro(p):
        for _ in range(50):
            if p == pid:
                return True
            p = pai.get(p)
            if not p:
                return False
        return False
    return sorted({porta for dono, porta in escuta if nasceu_dentro(dono)})


def fechar(args, registro, sessao):
    """Fecha as janelas desta sessão (ou os ids dados; --todas, --listar e --forcar como no Mac)."""
    opcoes = {x for x in args if x.startswith("--")}
    if sobra := opcoes - {"--todas", "--listar", "--forcar"}:
        sys.exit(f"Opção desconhecida: {', '.join(sorted(sobra))}. Valem --todas, --listar e --forcar.")
    ids = {x for x in args if not x.startswith("--")}
    alvo = [c for c in registro() if (c[0] in ids if ids else "--todas" in opcoes or c[3] == sessao)]
    if not alvo:
        print("nenhuma janela registrada para fechar")
        return
    pai, escuta = processos()
    fechadas = 0
    for c in alvo:
        hwnd, pid = int(c[0]), int(c[1])
        # O servidor nasce dentro da janela e morre com ela.
        if (portas := servidores(pid, pai, escuta)) and "--forcar" not in opcoes:
            print(f"janela {hwnd}: segura servidor na porta {', '.join(map(str, portas))} — não fechei.\n"
                  "   relance o servidor fora da janela antes, ou use --forcar para derrubar junto.")
        elif "--listar" in opcoes:
            print(f"fecharia janela {hwnd}")
        else:
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
            win.pedir_para_fechar(hwnd)
            fim = time.time() + 5
            while win.existe(hwnd) and time.time() < fim:
                time.sleep(0.1)
            print(f"janela {hwnd} " + ("NÃO fechou" if win.existe(hwnd) else "fechada"))
            fechadas += not win.existe(hwnd)
    if "--listar" not in opcoes:
        print(f"{fechadas} janela(s) fechada(s)")
