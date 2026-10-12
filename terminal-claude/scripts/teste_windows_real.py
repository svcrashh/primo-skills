#!/usr/bin/env python3
"""O terminal-claude e o terminal-organizar num Windows de verdade: janelas do Windows Terminal de
verdade, com um claude de mentira no lugar do de verdade. É o que roda no GitHub Actions
(windows-latest); não roda no Mac.

O claude de mentira é um claude.exe (o lançador que o pip põe nos programas de linha de comando), e
assim recebe os argumentos pelo mesmo caminho do de verdade. Ele faz o que a skill usa do de verdade:
aceita os argumentos que o terminais.py passa, roda os hooks do --settings nas horas certas (início,
prompt, parada, pergunta), grava a resposta no transcript onde o `ver` procura, fica vivo esperando o
próximo prompt e morre com a janela. O que ele faz em cada trilha vem em linhas do prompt:
"espera a vez" (só segue quando o teste mandar), "servidor", "pergunta", "sai" e "responde: <texto>".

    python teste_windows_real.py [--artefatos PASTA]

Abre, move e fecha janelas do Windows Terminal: não rode numa máquina em uso. As janelas do Windows
Terminal que já estavam abertas são minimizadas no começo (ficam fora da grade e da captura da tela)
e não são fechadas.
"""
import ctypes, json, os, re, shutil, socket, subprocess, sys, tempfile, time
from ctypes import wintypes
from pathlib import Path

AQUI = Path(__file__).resolve().parent
T = AQUI / "terminais.py"
ORGANIZAR = AQUI.parents[1] / "terminal-organizar/scripts/organizar.py"

FALSO = r'''
import json, os, re, shutil, subprocess, sys, time, uuid
from pathlib import Path

REGISTROS = Path(@REGISTROS@)
COM_VALOR = {"--settings", "--name", "--session-id", "--model", "--effort", "--worktree", "--resume", "--permission-mode"}
SOZINHAS = {"--dangerously-skip-permissions", "--fork-session"}
SERVIDOR = ("import socket, sys, time\ns = socket.socket(); s.bind(('127.0.0.1', 0)); s.listen()\n"
            "open(sys.argv[1] + '.novo', 'w').write(str(s.getsockname()[1]))\n"
            "__import__('os').replace(sys.argv[1] + '.novo', sys.argv[1])\ntime.sleep(3600)")

a, valor, prompt, extras, i = sys.argv[1:], {}, None, [], 0
while i < len(a):
    x = a[i]
    if x in COM_VALOR:
        valor[x] = a[i + 1]; i += 2
    elif x in SOZINHAS:
        valor[x] = True; i += 1
    elif x == "--add-dir":
        extras = a[i + 1:]; break
    elif x.startswith("--"):
        sys.exit(f"claude de mentira: opção desconhecida {x}")
    elif prompt is None:
        prompt = x; i += 1
    else:
        sys.exit("claude de mentira: dois prompts na linha de comando")
sid = str(uuid.UUID(valor["--session-id"]))  # o de verdade exige um UUID
estado = os.environ.get("TERMINAL_CLAUDE_ESTADO")
registro = REGISTROS / (sid + ".json")
dados = {"argv": a, "prompt": prompt, "cwd": os.getcwd(), "pid": os.getpid(), "config": os.environ.get("CLAUDE_CONFIG_DIR"),
         "env": sorted(k for k in os.environ if k.upper().startswith(("CLAUDE", "TERMINAL_CLAUDE", "AI_AGENT"))),
         "hooks": [], "porta": None}
settings = json.loads(Path(valor["--settings"]).read_text(encoding="utf-8"))
config = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
transcript = config / "projects" / re.sub(r"[^A-Za-z0-9]", "-", os.getcwd()) / (sid + ".jsonl")


def salvar():
    novo = registro.with_suffix(".novo")
    for _ in range(100):
        try:
            novo.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
            os.replace(novo, registro)
            return
        except PermissionError:  # o teste está lendo
            time.sleep(0.05)


def evento(nome, alvo=None, **campos):
    """Roda os hooks do evento como o Claude Code: com "args", o programa direto, sem shell; sem eles,
    a string no Git Bash, que é o shell dos hooks no Windows quando ele está instalado."""
    for grupo in settings.get("hooks", {}).get(nome, []):
        if alvo is not None and grupo.get("matcher") and not re.fullmatch(grupo["matcher"], alvo):
            continue
        for h in grupo["hooks"]:
            entrada = json.dumps({"session_id": sid, "transcript_path": str(transcript), "cwd": os.getcwd(),
                                  "hook_event_name": nome, **campos})
            if "args" in h:
                argv = [h["command"], *h["args"]]
            else:
                argv = [r"C:\Program Files\Git\bin\bash.exe", "-c", h["command"]]
            r = subprocess.run(argv, input=entrada, capture_output=True, text=True, encoding="utf-8",
                               errors="replace", timeout=60)
            dados["hooks"].append({"evento": nome, "forma": "exec" if "args" in h else "shell", "codigo": r.returncode,
                                   "erro": r.stderr[-800:],
                                   "estado": Path(estado).read_text(encoding="utf-8") if estado else None})
            salvar()
            print(f"[hook {nome}] código {r.returncode}" + (f": {r.stderr.strip()[-300:]}" if r.returncode else ""), flush=True)


def vez(nome):
    sinal = REGISTROS / f"{sid}.{nome}"
    while not sinal.exists():
        time.sleep(0.2)


def turno(texto):
    linhas = texto.splitlines()
    evento("UserPromptSubmit", prompt=texto)
    print("trabalhando…", flush=True)
    if "servidor" in linhas:
        porta = REGISTROS / (sid + ".porta")
        subprocess.Popen([sys.executable, "-c", SERVIDOR, str(porta)])
        while not porta.exists():
            time.sleep(0.1)
        dados["porta"] = int(porta.read_text())
        salvar()
        print(f"servidor escutando na porta {dados['porta']}", flush=True)
    if "espera a vez" in linhas:
        vez("segue")
    if "sai" in linhas:  # o claude sai (como no /exit): sobra o shell da janela
        return True
    if "pergunta" in linhas:
        evento("PreToolUse", "AskUserQuestion", tool_name="AskUserQuestion", tool_input={})
        print("Pergunta: qual caminho seguir? (responda aqui)", flush=True)
        resposta = sys.stdin.readline()
        evento("PostToolUse", "AskUserQuestion", tool_name="AskUserQuestion", tool_input={}, tool_response=resposta)
    resposta = next((l[len("responde: "):] for l in linhas if l.startswith("responde: ")), "feito")
    transcript.parent.mkdir(parents=True, exist_ok=True)
    with transcript.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"type": "user", "message": {"role": "user", "content": texto}}, ensure_ascii=False) + "\n")
        f.write(json.dumps({"type": "assistant", "isSidechain": False, "message": {"role": "assistant",
                "content": [{"type": "text", "text": resposta}]}}, ensure_ascii=False) + "\n")
    print(resposta, flush=True)
    evento("Stop")


print(f"claude de mentira · {valor.get('--name')}", flush=True)
salvar()
evento("SessionStart", "startup", source="startup")
if prompt is not None and turno(prompt):
    sys.exit(0)
for linha in sys.stdin:
    if turno(linha.strip()):
        break
'''


def executavel(pasta, fonte, python=None):
    """Um programa chamado claude que roda `fonte`: no Windows um claude.exe de verdade (o lançador do
    pip, que recebe os argumentos como qualquer .exe), no Mac e no Linux um script."""
    pasta = Path(pasta)
    pasta.mkdir(parents=True, exist_ok=True)
    python = python or sys.executable
    if os.name != "nt":
        alvo = pasta / "claude"
        alvo.write_text(f"#!{python}\n{fonte}", encoding="utf-8")
        alvo.chmod(0o755)
        return str(alvo)
    from pip._vendor.distlib.scripts import ScriptMaker
    fontes = pasta / "fontes"
    fontes.mkdir(exist_ok=True)
    (fontes / "claude").write_text("#!python\n" + fonte, encoding="utf-8")
    m = ScriptMaker(str(fontes), str(pasta))
    m.executable = python
    feitos = m.make("claude")
    return next(f for f in feitos if f.lower().endswith(".exe"))


# --- Win32 do que o teste olha por fora --------------------------------------------------------------
if os.name == "nt":
    sys.path.insert(0, str(ORGANIZAR.parent))
    import janelas_win as win
    user32 = win.user32  # a mesma instância, com os tipos já declarados (handle de 64 bits)
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]


def titulo(h):
    b = ctypes.create_unicode_buffer(512)
    user32.GetWindowTextW(h, b, 512)
    return b.value


def retangulo(h):
    r = wintypes.RECT()
    user32.GetWindowRect(h, ctypes.byref(r))
    return (r.left, r.top, r.right, r.bottom)


def todas_wt():
    """As janelas do Windows Terminal na tela, minimizadas ou não."""
    achadas = []
    def cada(h, _):
        if win.classe(h) == win.CLASSE and user32.IsWindowVisible(h):
            achadas.append(h)
        return True
    user32.EnumWindows(win.ENUM_JANELA(cada), 0)
    return achadas


def processos():
    """{pid: (nome, pai, linha de comando)} da máquina, menos a própria consulta."""
    ps = ("[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-CimInstance Win32_Process | "
          "Where-Object { $_.ProcessId -ne $PID -and $_.ParentProcessId -ne $PID } | "
          "Select-Object ProcessId, ParentProcessId, Name, CommandLine | ConvertTo-Json -Compress")
    saida = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True).stdout.decode("utf-8", "replace")
    return {p["ProcessId"]: (p["Name"], p["ParentProcessId"], p["CommandLine"] or "") for p in json.loads(saida)}


def escutando(porta):
    try:
        socket.create_connection(("127.0.0.1", porta), timeout=1).close()
        return True
    except OSError:
        return False


def foto(nome):
    if not ARTEFATOS:
        return
    caminho = ARTEFATOS / nome
    ps = ("Add-Type -AssemblyName System.Windows.Forms, System.Drawing; "
          "$b = [System.Windows.Forms.SystemInformation]::VirtualScreen; "
          "$img = New-Object System.Drawing.Bitmap $b.Width, $b.Height; "
          "[System.Drawing.Graphics]::FromImage($img).CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); "
          f"$img.Save('{caminho}')")
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True)


# --- o teste -----------------------------------------------------------------------------------------
falhas = []


def confere(nome, cond, detalhe=""):
    print(("ok   " if cond else "FALHA") + " " + nome + (f"\n      → {detalhe}" if detalhe and not cond else ""), flush=True)
    if not cond:
        falhas.append(nome)
    return bool(cond)


def ate(cond, segundos):
    """O valor de cond() quando ele vier verdadeiro, ou None se o tempo acabar."""
    fim = time.time() + segundos
    while True:
        v = cond()
        if v or time.time() >= fim:
            return v or None
        time.sleep(0.25)


def terminais(*argv, timeout=120):
    r = subprocess.run([sys.executable, str(T), *map(str, argv)], capture_output=True, env=ENV, timeout=timeout)
    return (r.stdout + r.stderr).decode("utf-8", "replace")


def organizar(*argv):
    r = subprocess.run([sys.executable, str(ORGANIZAR), *argv], capture_output=True, env=ENV, timeout=60)
    return (r.stdout + r.stderr).decode("utf-8", "replace")


def registro():
    """hwnd → colunas da linha, do arquivo do registro como está (sem limpar nada)."""
    if not REGISTRO.exists():
        return {}
    return {int(c[0]): c for c in (l.split("\t") for l in REGISTRO.read_text(encoding="utf-8").splitlines()) if c[0].isdigit()}


def registros_do_falso():
    lidos = {}
    for f in REGISTROS.glob("*.json"):
        try:
            r = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        lidos[r["argv"][r["argv"].index("--name") + 1]] = r
    return lidos


def do_falso(nome, hooks=0, segundos=60):
    """O registro do claude de mentira da trilha, quando ele já rodou tantos hooks."""
    return ate(lambda: (r := registros_do_falso().get(nome)) and len(r["hooks"]) >= hooks and r, segundos)


def mandar_seguir(r):
    (REGISTROS / f"{r['argv'][r['argv'].index('--session-id') + 1]}.segue").write_text("", encoding="utf-8")


def ids_abertos(saida):
    return [int(x) for x in re.findall(r"^Janela (\d+) ·", saida, re.M)]


def linha_de(status, h):
    return next((l for l in status.splitlines() if l.startswith(f"{h} ")), "")


def de_onde_vem_o_claude(raiz, claude):
    """A busca do claude, no terminais.py e no requisitos.py: o do instalador oficial fora do PATH, o
    claude.cmd do npm (que só repassa ao claude.exe do pacote), um .cmd sem .exe e nenhum."""
    sem = os.pathsep.join(d for d in os.environ["PATH"].split(os.pathsep)
                          if d and not any((Path(d) / f"claude{e}").exists() for e in (".exe", ".cmd", ".bat")))
    casa, vazia = raiz / "casa", raiz / "casa vazia"
    (casa / ".local/bin").mkdir(parents=True)
    vazia.mkdir()
    shutil.copy(claude, casa / ".local/bin/claude.exe")
    npm = raiz / "npm"
    pacote = npm / "node_modules/@anthropic-ai/claude-code/bin"
    pacote.mkdir(parents=True)
    (npm / "claude.cmd").write_text('@"%~dp0node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe" %*\r\n', encoding="ascii")
    shutil.copy(claude, pacote / "claude.exe")

    def roda(argv, path, casa_):
        r = subprocess.run(argv, capture_output=True, cwd=raiz, env={**ENV, "PATH": path, "USERPROFILE": str(casa_)})
        return r.returncode, (r.stdout + r.stderr).decode("utf-8", "replace").replace("\r\n", "\n").strip()

    def busca(path, casa_):
        # Como no terminais.py, que põe a saída em UTF-8 antes de procurar o claude.
        return roda([sys.executable, "-c", f"import sys; sys.path[:0] = [{str(AQUI)!r}, {str(ORGANIZAR.parent)!r}]; "
                     "sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8'); "
                     "import so_windows; print(so_windows.achar_claude())"], path, casa_)

    def requisitos(path, casa_):
        return roda([sys.executable, str(AQUI / "requisitos.py")], path, casa_)

    codigo, achado = busca(sem, casa)
    confere("o claude do instalador oficial, fora do PATH: a skill acha ele em .local\\bin",
            codigo == 0 and achado == str(casa / ".local/bin/claude.exe"), achado)
    codigo, saida = requisitos(sem, casa)
    confere("e o requisitos diz ✔, com o comando para pôr a pasta no PATH", codigo == 0 and
            "✔ claude (%USERPROFILE%\\.local\\bin\\claude.exe): a skill acha ele lá" in saida and "SetEnvironmentVariable" in saida, saida)
    codigo, achado = busca(str(npm) + os.pathsep + sem, vazia)
    confere("o claude.cmd do npm: a skill chama direto o claude.exe do pacote", codigo == 0 and achado == str(pacote / "claude.exe"), achado)
    codigo, saida = requisitos(str(npm) + os.pathsep + sem, vazia)
    confere("e o requisitos diz ✔ para o do npm", codigo == 0 and "✔ claude (o do npm" in saida, saida)
    (pacote / "claude.exe").unlink()
    codigo, saida = busca(str(npm) + os.pathsep + sem, vazia)
    confere("um .cmd sem o .exe do pacote: a skill não abre e diz como instalar o nativo",
            codigo == 1 and "é um .cmd" in saida and "irm https://claude.ai/install.ps1 | iex" in saida, saida)
    codigo, saida = requisitos(str(npm) + os.pathsep + sem, vazia)
    confere("e o requisitos diz ✖, com a instalação", codigo == 1 and "✖ claude: o do PATH é um claude.cmd" in saida, saida)
    codigo, saida = requisitos(sem, vazia)
    confere("sem claude nenhum, o requisitos diz ✖ e como instalar e pôr no PATH", codigo == 1 and "✖ claude: não achei" in saida
            and "irm https://claude.ai/install.ps1 | iex" in saida and "SetEnvironmentVariable" in saida, saida)
    print("      " + saida.replace("\n", "\n      "))


def principal():
    global ENV, REGISTRO, REGISTROS, ARTEFATOS
    for saida in (sys.stdout, sys.stderr):
        saida.reconfigure(encoding="utf-8")
    if os.name != "nt":
        sys.exit("Este teste abre janelas do Windows Terminal: roda só no Windows.")
    ARTEFATOS = Path(sys.argv[sys.argv.index("--artefatos") + 1]).resolve() if "--artefatos" in sys.argv else None
    if ARTEFATOS:
        ARTEFATOS.mkdir(parents=True, exist_ok=True)

    # Espaço e acento em tudo que é caminho: a pasta do projeto, a dos arquivos das janelas (que vai
    # pela linha de comando do wt) e a do registro, como no perfil de um "João Silva".
    raiz = Path(tempfile.mkdtemp(prefix="terminais-real-"))
    pasta, local, temp = raiz / "Projeto de teste ação", raiz / "Local com espaço ção", raiz / "Temp com espaço ção"
    REGISTROS = raiz / "registros"
    for p in (pasta, local, temp, REGISTROS):
        p.mkdir()
    REGISTRO, cache = temp / "claude-terminais-abertos.tsv", local / "terminal-claude"
    claude = executavel(raiz / "bin", FALSO.replace("@REGISTROS@", repr(str(REGISTROS))), os.environ.get("FALSO_PYTHON"))
    ENV = {**os.environ, "CLAUDE_CODE_SESSION_ID": f"teste-real-{os.getpid()}", "LOCALAPPDATA": str(local),
           "TEMP": str(temp), "TMP": str(temp), "PATH": str(Path(claude).parent) + os.pathsep + os.environ["PATH"]}
    ENV.pop("CLAUDE_CONFIG_DIR", None)
    print(f"python: {sys.executable}\nskills: {AQUI.parents[1]}\nclaude de mentira: {claude}\n", flush=True)
    de_onde_vem_o_claude(raiz, claude)

    alheias = todas_wt()
    for h in alheias:
        user32.ShowWindow(h, 6)  # SW_MINIMIZE
    antes = processos()
    console_antes = {p for p, (n, _, _) in antes.items() if n == "OpenConsole.exe"}

    # --- abrir --dry-run ------------------------------------------------------------------------------
    saida = terminais("abrir", pasta, "--dry-run", "--prompt", "oi")
    confere("abrir --dry-run mostra o plano e o comando do claude", "[simulação]" in saida
            and claude.lower() in saida.lower() and "--dangerously-skip-permissions" in saida, saida)
    time.sleep(2)
    confere("o --dry-run não abre janela nem registra", not win.janelas() and not registro(), f"{win.janelas()} {registro()}")

    # --- abrir um lote de 4 ---------------------------------------------------------------------------
    import organizar as org
    dificil = "Leia \"docs/x.md\" e não use 'aspas' $HOME `data` \\ barra ! ; && | > < % ^ ação 🚀\nsegunda linha"
    lote = [{"titulo": "A · rápida", "prompt": "espera a vez\nresponde: Resposta da trilha A"},
            {"titulo": "B · pergunta; com ponto e vírgula", "prompt": dificil + "\nespera a vez\npergunta", "modelo": "sonnet"},
            {"titulo": "C · servidor", "prompt": "servidor\nespera a vez"},
            {"titulo": "F · sai", "prompt": "espera a vez\nsai"}]
    (raiz / "lote.json").write_text(json.dumps(lote, ensure_ascii=False), encoding="utf-8")
    planejado = org.plano_novas(len(lote))[0]
    t0 = time.time()
    saida = terminais("abrir", pasta, "--lote", raiz / "lote.json")
    ids = ids_abertos(saida)
    if not confere("abrir abre as 4 janelas do lote", len(ids) == 4 and "4 janela(s) aberta(s)" in saida, saida):
        return
    print(f"      ({time.time() - t0:.1f} s para abrir as 4)")
    A, B, C, F = ids
    titulos = dict(zip(ids, (t["titulo"] for t in lote)))
    time.sleep(1)
    confere("cada janela nasceu no quadrado planejado para ela", [retangulo(h) for h in ids] == planejado,
            f"lido {[retangulo(h) for h in ids]}, planejado {planejado}")
    confere("o título de cada janela é o da trilha, inteiro (com o ponto e vírgula)",
            all(titulo(h).endswith(titulos[h]) for h in ids), [titulo(h) for h in ids])
    reg = registro()
    confere("registro: as 4 com o pid do processo da janela e esta sessão", sorted(reg) == sorted(ids) and
            all(win.processo_vivo(int(c[1])) and c[3] == ENV["CLAUDE_CODE_SESSION_ID"] for c in reg.values()), reg)

    falsos = {t["titulo"]: do_falso(t["titulo"], hooks=2) for t in lote}
    if not confere("o claude de cada janela começou e rodou os hooks do início e do prompt", all(falsos.values()),
                   {k: bool(v) for k, v in falsos.items()}):
        return
    b = falsos[titulos[B]]
    confere("o prompt difícil chegou idêntico (aspas, %, ^, &, |, acento, emoji, duas linhas)", b["prompt"] == lote[1]["prompt"],
            repr(b["prompt"]))
    confere("na linha do claude: bypass, --settings, --name, --session-id e o modelo da trilha",
            all("--dangerously-skip-permissions" in r["argv"] and "--settings" in r["argv"] for r in falsos.values())
            and b["argv"][b["argv"].index("--model") + 1] == "sonnet", b["argv"])
    confere("o claude rodou na pasta da trilha", all(os.path.samefile(r["cwd"], pasta) for r in falsos.values()),
            [r["cwd"] for r in falsos.values()])
    confere("ambiente do claude: só o arquivo de estado, sem os marcadores desta sessão nem CLAUDE_CONFIG_DIR",
            all(r["env"] == ["TERMINAL_CLAUDE_ESTADO", "TERMINAL_CLAUDE_INICIO"] for r in falsos.values()),
            [r["env"] for r in falsos.values()])
    confere("os hooks rodaram direto, sem shell, e sem erro", all(h["forma"] == "exec" and h["codigo"] == 0
            for r in falsos.values() for h in r["hooks"]), [h for r in falsos.values() for h in r["hooks"] if h["codigo"]])
    st = terminais("status")
    confere("status: as 4 trabalhando", all("⏳ trabalhando" in linha_de(st, h) for h in ids), st)
    foto("1-lote-aberto.png")

    # --- A para: esperar, ver, fechar -----------------------------------------------------------------
    mandar_seguir(falsos[titulos[A]])
    espera = terminais("esperar", "--minutos", "2", timeout=180)
    confere("esperar volta quando A para, diz qual e que as outras 3 seguem trabalhando",
            f"A janela {A} (A · rápida) parou" in espera and "Ainda há janela trabalhando (3)" in espera, espera)
    a = do_falso(titulos[A], hooks=3)
    confere("os hooks de A gravaram trabalhando → trabalhando → parada",
            a and [h["estado"] for h in a["hooks"]] == ["trabalhando", "trabalhando", "parada"], a and a["hooks"])
    st = terminais("status")
    confere("status: A parada e as outras trabalhando", "✅ parada" in linha_de(st, A)
            and all("⏳ trabalhando" in linha_de(st, h) for h in (B, C, F)), st)
    ver = terminais("ver", A)
    confere("ver A traz a última resposta, lida do transcript", ver.startswith("A · rápida · parada") and "Resposta da trilha A" in ver, ver)
    linha_a = registro()[A]
    saida = terminais("fechar", A)
    confere("fechar A fecha só ela", f"janela {A} fechada" in saida and "1 janela(s) fechada(s)" in saida
            and not win.existe(A) and all(win.existe(h) for h in (B, C, F)), saida)
    confere("A saiu do registro e do cache na hora", A not in registro() and not list(cache.glob(Path(linha_a[5]).name + ".*")),
            f"{registro().keys()} {list(cache.iterdir())}")
    confere("e não sobrou processo de A (nem o python da janela, nem o claude)",
            ate(lambda: not win.processo_vivo(int(linha_a[1])) and not win.processo_vivo(a["pid"]), 10))

    # --- B pergunta, F encerra ------------------------------------------------------------------------
    mandar_seguir(falsos[titulos[B]])
    espera = terminais("esperar", "--minutos", "2", timeout=180)
    confere("esperar volta quando B faz uma pergunta, e diz qual", f"A janela {B} ({titulos[B]}) fez uma pergunta" in espera, espera)
    confere("status: B em pergunta", "❓ pergunta" in linha_de(terminais("status"), B))
    mandar_seguir(falsos[titulos[F]])
    espera = terminais("esperar", "--minutos", "2", timeout=180)
    confere("esperar volta quando o claude de F sai, e diz qual", f"A janela {F} (F · sai) encerrou" in espera, espera)
    st = terminais("status")
    confere("status: F encerrada, com a janela ainda aberta (sobrou o PowerShell)", "⏹ encerrada" in linha_de(st, F) and win.existe(F), st)

    # --- servidor na janela ---------------------------------------------------------------------------
    porta = falsos[titulos[C]]["porta"]
    confere("o servidor de C está escutando", porta and escutando(porta), porta)
    saida = terminais("fechar", C)
    confere("fechar C sem --forcar não fecha a janela que segura servidor, e diz a porta",
            f"segura servidor na porta {porta}" in saida and "não fechei" in saida and win.existe(C) and escutando(porta), saida)

    # --- janela viva que a leitura não enxerga ---------------------------------------------------------
    user32.ShowWindow(B, 6)
    time.sleep(0.5)
    st = terminais("status")
    confere("janela minimizada (a leitura da tela não a vê) continua no registro", B not in [j[0] for j in win.janelas()]
            and titulos[B] in linha_de(st, B), st)
    original = REGISTRO.read_text(encoding="utf-8")
    REGISTRO.write_text(original.replace(f"{B}\t", "99999990\t", 1), encoding="utf-8")
    st = terminais("status")
    confere("janela cujo número já não é de janela nenhuma, com o processo da trilha rodando, continua no registro",
            titulos[B] in linha_de(st, 99999990) and 99999990 in registro(), st)
    REGISTRO.write_text(original, encoding="utf-8")
    user32.ShowWindow(B, 9)  # SW_RESTORE

    # --- janela fechada por fora, com o esperar de olho -------------------------------------------------
    saida = terminais("abrir", pasta, "--prompt", "espera a vez")
    D = (ids_abertos(saida) or [0])[0]
    d = do_falso(pasta.name, hooks=2)
    linha_d = registro().get(D)
    if confere("abrir uma janela só, com --prompt", D and d and linha_d, saida):
        vigia = subprocess.Popen([sys.executable, str(T), "esperar", "--minutos", "2"], stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT, env=ENV)
        time.sleep(8)  # o esperar já leu o registro uma vez (leva menos de 1 s)
        win.pedir_para_fechar(D)  # como o X da janela
        espera = vigia.communicate(timeout=180)[0].decode("utf-8", "replace")
        confere("a janela fechada por fora fechou (o Windows Terminal não pediu confirmação)", not win.existe(D))
        confere("esperar avisa que ela foi fechada, e qual", f"A janela {D} ({pasta.name}) foi fechada" in espera, espera)
        confere("ela saiu do registro e do cache", D not in registro() and not list(cache.glob(Path(linha_d[5]).name + ".*")))
        confere("e os processos dela morreram com a janela",
                ate(lambda: not win.processo_vivo(int(linha_d[1])) and not win.processo_vivo(d["pid"]), 15))

    # --- janela sem prompt ----------------------------------------------------------------------------
    saida = terminais("abrir", pasta, "--modelo", "haiku")
    E = (ids_abertos(saida) or [0])[0]
    st = ate(lambda: "✅ parada" in linha_de(s := terminais("status"), E) and s, 30)
    confere("janela sem prompt: o hook do início a deixa parada", st, terminais("status"))
    confere("ver na janela sem resposta avisa que não há o que mostrar", "ainda não gravou" in terminais("ver", E))

    # --- terminal-organizar ---------------------------------------------------------------------------
    nossas = [B, C, E, F]
    antes_do_plano = {h: retangulo(h) for h in nossas}
    plano_txt = organizar("--dry-run")
    plano = {int(m[0]): tuple(map(int, m[1:])) for m in
             re.findall(r"janela (\d+) → frame \((-?\d+), (-?\d+), (-?\d+), (-?\d+)\)", plano_txt)}
    confere("organizar --dry-run planeja as 4 janelas abertas, sem mexer em nenhuma", sorted(plano) == sorted(nossas)
            and {h: retangulo(h) for h in nossas} == antes_do_plano, plano_txt)
    print("      " + plano_txt.strip().replace("\n", "\n      "))
    saida = organizar()
    time.sleep(1)
    lidas = {h: retangulo(h) for h in nossas}
    confere("organizar põe cada janela no quadrado do plano (posição e tamanho lidos de volta)",
            all(lidas[h] == plano.get(h) for h in nossas), f"{saida}\nlido {lidas}\nplano {plano}")
    area = win.monitores()[0]
    confere("as janelas ficam dentro da área útil da tela e não se sobrepõem",
            all(area[1] <= l and area[2] <= t and r <= area[1] + area[3] and b <= area[2] + area[4] for l, t, r, b in lidas.values())
            and all(not (p[0] < q[2] and q[0] < p[2] and p[1] < q[3] and q[1] < p[3])
                    for i, p in enumerate(lidas.values()) for q in list(lidas.values())[i + 1:]), f"{area} {lidas}")
    foto("2-organizadas.png")

    # --- fechar --forcar, fechar tudo -------------------------------------------------------------------
    saida = terminais("fechar", "--forcar", C)
    confere("fechar --forcar fecha a janela do servidor e derruba o servidor junto",
            f"janela {C} fechada" in saida and not win.existe(C) and ate(lambda: not escutando(porta), 10), saida)
    saida = terminais("fechar")
    confere("fechar sem id fecha as que sobraram desta sessão", "3 janela(s) fechada(s)" in saida
            and not any(win.existe(h) for h in nossas), saida)

    # --- no fim, nada sobrando ------------------------------------------------------------------------
    confere("status: nenhuma janela aberta por esta sessão", terminais("status").startswith("Nenhuma janela aberta por esta sessão"))
    confere("registro vazio", not registro(), registro())
    confere("cache só com hooks.json e uso.json", sorted(p.name for p in cache.iterdir()) == ["hooks.json", "uso.json"],
            list(cache.iterdir()))
    confere("as janelas que já estavam abertas antes do teste continuam lá", all(win.existe(h) for h in alheias))
    VIGIADOS = {"python.exe", "claude.exe", "pwsh.exe", "powershell.exe", "OpenConsole.exe", "WindowsTerminal.exe", "conhost.exe"}

    def orfaos():
        return {p: v for p, v in processos().items() if p not in antes and p != os.getpid() and v[0] in VIGIADOS}
    sobra = ate(lambda: not orfaos() and "nenhum", 20)
    confere("nenhum processo órfão (Windows Terminal, OpenConsole, python, claude, PowerShell)", sobra, orfaos())
    confere("nenhuma janela do Windows Terminal além das que já estavam abertas", sorted(todas_wt()) == sorted(alheias), todas_wt())
    confere("os consoles das abas fechadas foram embora", {p for p, (n, _, _) in processos().items() if n == "OpenConsole.exe"} <= console_antes)
    shutil.rmtree(raiz, ignore_errors=True)


def diagnostico():
    print("\n--- diagnóstico ---")
    print("status --todas:\n" + terminais("status", "--todas"))
    print(f"registro: {REGISTRO.read_text(encoding='utf-8') if REGISTRO.exists() else '(não existe)'}")
    for nome, r in registros_do_falso().items():
        print(f"claude de mentira {nome}: hooks {r['hooks']}")
    print("janelas do Windows Terminal:", [(h, titulo(h), retangulo(h)) for h in todas_wt()])
    foto("falha.png")


if __name__ == "__main__":
    try:
        principal()
    except Exception:
        import traceback
        traceback.print_exc()
        falhas.append("exceção")
    if falhas:
        try:
            diagnostico()
        except Exception:
            import traceback
            traceback.print_exc()
    sys.exit(f"\n{len(falhas)} FALHA(S): {'; '.join(falhas)}" if falhas else print("\nTUDO OK"))
