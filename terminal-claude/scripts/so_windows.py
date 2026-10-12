"""A parte do terminais.py que é do Windows: Windows Terminal (wt.exe), janelas por Win32 e o
processo que cada janela roda.

Rodou num Windows de verdade em 12/10/2026, com um claude de mentira: é o teste_windows_real.py, que o
GitHub Actions roda a cada mudança. Mexeu aqui? Ele e o teste_windows_simulado.py têm de passar.
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


def hook(estado):
    # Com "args" o Claude Code chama o programa direto, sem shell. Sem eles o comando iria para o Git
    # Bash ou, sem ele, para o PowerShell, e não há jeito de escrever um caminho com espaço que valha
    # nos dois: o Git Bash come a barra invertida e o PowerShell não chama caminho entre aspas.
    return {"type": "command", "command": sys.executable, "args": [str(MOTOR), "marcar", estado]}


def marcar(a):
    """Chamado pelos hooks: grava o estado da trilha. Não escreve no terminal, pra não sujar a tela."""
    if destino := os.environ.get("TERMINAL_CLAUDE_ESTADO"):
        estado = os.environ.get("TERMINAL_CLAUDE_INICIO", "parada") if a.estado == "inicio" else a.estado
        Path(destino).write_text(estado, encoding="utf-8")


def achar_claude():
    """O claude.exe que a janela chama: o do PATH; o de dentro do pacote, quando o do PATH é o
    claude.cmd do npm; ou o do instalador oficial, que fica em %USERPROFILE%\\.local\\bin e não
    entra no PATH sozinho."""
    achado = shutil.which("claude")
    nativo = Path.home() / ".local/bin/claude.exe"
    if achado and achado.lower().endswith((".cmd", ".bat")):
        # O claude.cmd do npm só repassa ao claude.exe do pacote. Pelo .cmd o prompt passa pelo cmd e
        # chega só com a primeira linha (medido em 12/10/2026): vai direto ao .exe.
        exe = Path(achado).parent / "node_modules/@anthropic-ai/claude-code/bin/claude.exe"
        if exe.exists():
            return str(exe)
        if not nativo.exists():
            sys.exit(f"O claude deste computador é um .cmd ({achado}), e por ele o prompt de várias linhas "
                     "chega só com a primeira. Instale o claude nativo no PowerShell:\n"
                     "    irm https://claude.ai/install.ps1 | iex\n"
                     "e rode de novo (o outro pode ficar).")
        achado = None
    return achado or (str(nativo) if nativo.exists() else None)


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


def powershell(script):
    # Na saída padrão do console o acento de um caminho vinha trocado, e a linha de comando da janela
    # não batia mais com a do registro: em UTF-8 dos dois lados.
    r = subprocess.run(["powershell", "-NoProfile", "-Command",
                        "[Console]::OutputEncoding = [Text.Encoding]::UTF8; " + script], capture_output=True)
    return r.stdout.decode("utf-8", "replace")


def linha_de_comando(pid):
    """Como o processo foi chamado; vazio se não der pra saber."""
    return powershell(f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine")


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
    # O wt separa comandos por ";": sem o escape, o título "A; B" virava dois comandos.
    subprocess.Popen([wt, "-w", "new", "nt", "--title", t["titulo"].replace(";", "\\;"), "-d", str(t["pasta"]),
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
    try:
        subprocess.call(meta["args"], cwd=meta["pasta"],
                        env={**env, "TERMINAL_CLAUDE_ESTADO": a.base + ".estado", "TERMINAL_CLAUDE_INICIO": meta["inicio"]})
    except OSError as erro:
        print(f"Não consegui abrir o claude ({meta['args'][0]}): {erro}\n"
              "Confira no PowerShell com  claude --version . Se ele não existir, instale com:\n"
              "    irm https://claude.ai/install.ps1 | iex\n"
              "Depois feche esta janela e abra de novo pelo Claude.")
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
    saida = powershell('Get-CimInstance Win32_Process | ForEach-Object { "p $($_.ProcessId) $($_.ParentProcessId)" }; '
                       'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | '
                       'ForEach-Object { "l $($_.OwningProcess) $($_.LocalPort)" }')
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
        registro()  # a que fechou sai do registro já, como no Mac
