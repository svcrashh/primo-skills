#!/usr/bin/env python3
"""Exercita os ramos de Windows do terminal-claude e do organizar com o sistema simulado: janelas,
monitores, processos, o wt.exe e o claude são de mentira. Roda no Mac e no Windows.

Não prova as chamadas Win32 de verdade nem o Windows Terminal (isso é o teste_windows_real.py): prova
que a lógica em volta delas fecha. Rode depois de mexer em so_windows.py, janelas_win.py ou no
terminais.py:

    python3 teste_windows_simulado.py
"""
import glob, json, os, shutil, sys, tempfile, types
# A biblioteca padrão é carregada antes do msvcrt de mentira: o subprocess decide se está no Windows por ele.
import argparse, contextlib, io, re, shlex, subprocess, time, unicodedata, urllib.parse, urllib.request, uuid  # noqa
from pathlib import Path

AQUI = Path(__file__).resolve().parent
NO_WINDOWS = os.name == "nt"   # o sys.platform vai ser trocado logo abaixo
for _saida in (sys.stdout, sys.stderr):
    _saida.reconfigure(encoding="utf-8")
raiz = Path(tempfile.mkdtemp(prefix="simwin-"))
os.environ.update(APPDATA=str(raiz / "AppData/Roaming"), LOCALAPPDATA=str(raiz / "AppData/Local"),
                  TMPDIR=str(raiz / "Temp"), CLAUDE_CONFIG_DIR=r"C:\Users\gu\.claude-insiders")
(raiz / "Temp").mkdir(); tempfile.tempdir = str(raiz / "Temp")
(raiz / "projeto").mkdir()
# No Windows o claude de mentira precisa ser um .exe: script com #! o Windows não roda.
from teste_windows_real import executavel
claude_falso = executavel(raiz / "bin", f"""
import json, os, sys
a = sys.argv[1:]; sid = a[a.index("--session-id") + 1]
json.dump({{"argv": a, "cwd": os.getcwd(), "config": os.environ.get("CLAUDE_CONFIG_DIR"),
           "env": sorted(k for k in os.environ if k.upper().startswith(("CLAUDE", "TERMINAL_CLAUDE", "AI_AGENT", "CORY")))}},
          open({str(raiz)!r} + "/saida-" + sid + ".json", "w", encoding="utf-8"), ensure_ascii=False)
""")
os.environ["CLAUDE_CODE_SESSION_ID"] = "sessao-teste"

# --- sistema de mentira -------------------------------------------------------------------
fake = types.ModuleType("janelas_win")
fake.jan = {1001: (0, 0, 800, 600)}          # uma janela do dono já aberta
fake.movidas, fake.acordado, fake.frente = [], [], []
fake.monitores = lambda: [(False, -1080, 0, 1080, 1880), (True, 0, 0, 2560, 1400)]
fake.janelas = lambda: [(h, *r) for h, r in fake.jan.items()]
fake.existe = lambda h: h in fake.jan
def mover(h, l, t, r, b, trazer=False): fake.jan[h] = (l, t, r, b); fake.movidas.append((h, l, t, r, b, trazer))
fake.mover = mover
fake.trazer_para_frente = fake.frente.append
fake.pedir_para_fechar = lambda h: fake.jan.pop(h, None)
fake.vivos = set()
fake.processo_vivo = lambda pid: pid in fake.vivos
fake.manter_acordado = lambda ligado=True: fake.acordado.append(ligado)
sys.modules["janelas_win"] = fake
msv = types.ModuleType("msvcrt"); msv.LK_LOCK = 1; msv.travas = 0
def locking(fd, modo, n): msv.travas += 1
msv.locking = locking; sys.modules["msvcrt"] = msv

sys.platform = "win32"
sys.path[:0] = [str(AQUI), str(AQUI.parents[1] / "terminal-organizar/scripts")]
import organizar, so_windows as so, terminais

falhas = []
def confere(nome, cond, detalhe=""):
    print(("ok   " if cond else "FALHA") + " " + nome + (f"  → {detalhe}" if detalhe and not cond else ""))
    if not cond: falhas.append(nome)

# --- organizar no "Windows" ---------------------------------------------------------------
telas = organizar.ler_telas()
confere("telas: principal primeiro, nomes pela orientação", [t.nome for t in telas] == ["Monitor horizontal", "Monitor vertical"] and telas[0].l == 0, str(telas))
confere("janelas lidas do Windows Terminal", [j.id for j in organizar.ler_janelas()] == [1001])
dest, outras, ondes, avisos = organizar.plano_novas(7)
confere("7 janelas novas planejadas, cada uma num quadrado diferente", len(set(dest)) == 7 and len(ondes) == 7, str(ondes))
confere("a janela do dono também ganha quadrado", 1001 in outras, str(outras))
confere("coordenadas ficam dentro do monitor (y para baixo, sem conversão do Mac)", all(0 <= t and b <= 1400 for (l, t, r, b) in dest if l >= 0), str(dest))
print("     ", ondes[0], "…", ondes[-1])
plano, linhas, _ = organizar.plano_tudo("vertical")
organizar.aplicar(plano, trazer=True)
confere("organizar --monitor vertical leva a janela pro monitor em pé", fake.jan[1001][0] < 0 and fake.movidas[-1][-1] is True, str(fake.jan))
fake.jan[1001] = (0, 0, 800, 600); fake.movidas.clear()

# --- constantes e hook --------------------------------------------------------------------
confere("registro e cache nas pastas do Windows", so.REGISTRO.parent == raiz / "Temp" and so.CACHE == raiz / "AppData/Local/terminal-claude")
real = sys.executable; sys.executable = r"C:\Users\João da Silva\AppData\Local\Programs\Python\Python312\python.exe"
h = so.hook("parada")
confere("hook sem shell: o python e o terminais.py vão inteiros, como argumentos", h == {"type": "command",
        "command": sys.executable, "args": [str(so.MOTOR), "marcar", "parada"]}, str(h))
sys.executable = real
confere("todo hook do --settings vai sem shell", all("args" in x for grupos in terminais.HOOKS["hooks"].values() for g in grupos for x in g["hooks"]))

# --- abrir -------------------------------------------------------------------------------
chamadas, shells = [], []
PopenReal = subprocess.Popen
class Terminado:
    """O processo de mentira que já terminou: é o PowerShell que a janela abre quando o claude sai."""
    def __enter__(self): return self
    def __exit__(self, *_): pass
    def wait(self, timeout=None): return 0
def popen_falso(argv, **k):
    """Faz o papel do wt.exe: cria a janela e roda nela o que foi pedido (o `rodar`). O resto passa direto."""
    if argv[0] == "C:/pwsh.exe":
        shells.append(k.get("cwd"))
        return Terminado()
    if argv[0] != "C:/wt.exe":
        return PopenReal(argv, **k)
    chamadas.append((argv, k["env"]))
    fake.jan[2000 + len(chamadas)] = (50, 50, 900, 700)
    assert argv[-2] == "rodar"
    fake.vivos.add(os.getpid())
    ambiente = dict(os.environ); os.environ.clear(); os.environ.update(k["env"])   # a janela herda o ambiente do wt
    try: so.rodar(types.SimpleNamespace(base=argv[-1]))
    finally: os.environ.clear(); os.environ.update(ambiente)
shutil.which = {"wt": "C:/wt.exe", "pwsh": "C:/pwsh.exe", "claude": str(claude_falso)}.get
subprocess.Popen = popen_falso

prompt_dificil = "Leia \"docs/x.md\" e não use 'aspas' $HOME `data` \\ barra ! ; && | > < % ^ ação 🚀\nsegunda linha"
lote = raiz / "lote.json"
lote.write_text(json.dumps([{"titulo": "A · simples", "prompt": "faz a parte 1"},
                            {"titulo": "B · difícil", "prompt": prompt_dificil, "modelo": "sonnet"},
                            {"titulo": "C · sem prompt"}], ensure_ascii=False), encoding="utf-8")
os.environ["CLAUDECODE"] = "1"; os.environ["CLAUDE_CODE_CHILD_SESSION"] = "1"; os.environ["AI_AGENT"] = "x"
pasta = str((raiz / "projeto").resolve())
sys.argv = ["terminais.py", "abrir", pasta, "--lote", str(lote), "--modelo", "opus"]
terminais.main()

confere("3 chamadas ao wt, em janela nova, com título e pasta", len(chamadas) == 3 and all(a[:4] == ["C:/wt.exe", "-w", "new", "nt"] and "--title" in a and a[a.index("-d") + 1] == pasta for a, _ in chamadas), str(chamadas[0][0]) if chamadas else "")
confere("o wt recebe o ambiente sem os marcadores da sessão", all(not any(so.marcador(k) for k in e) for _, e in chamadas))
confere("a janela chama o python com `rodar <base>`", all(a[-3].endswith("terminais.py") and a[-2] == "rodar" for a, _ in chamadas))
confere("cada janela nova foi movida para o quadrado dela", sorted(m[0] for m in fake.movidas if m[0] > 2000) == [2001, 2002, 2003], str(fake.movidas))
confere("a última janela veio para a frente", fake.frente == [2003], str(fake.frente))
confere("a trava do registro foi usada", msv.travas >= 1)
reg = [l.split("\t") for l in so.REGISTRO.read_text(encoding="utf-8").splitlines()]
confere("registro com hwnd, pid, pasta, sessão e base", len(reg) == 3 and all(c[0].isdigit() and c[1] == str(os.getpid()) and c[3] == "sessao-teste" for c in reg), str(reg))
def le(f): return json.loads(Path(f).read_text(encoding="utf-8"))
saidas = {le(f)["argv"][le(f)["argv"].index("--name") + 1]: le(f) for f in glob.glob(str(raiz / "saida-*.json"))}
confere("o claude de cada janela foi chamado", sorted(saidas) == ["A · simples", "B · difícil", "C · sem prompt"], str(sorted(saidas)))
b = saidas.get("B · difícil", {"argv": [], "env": []})
confere("prompt difícil chegou idêntico", prompt_dificil in b["argv"])
confere("modelo da trilha vence o padrão", b["argv"][b["argv"].index("--model") + 1] == "sonnet" if "--model" in b["argv"] else False)
confere("bypass por padrão", "--dangerously-skip-permissions" in b["argv"])
confere("ambiente do claude: só o perfil e o arquivo de estado", b["env"] == ["CLAUDE_CONFIG_DIR", "TERMINAL_CLAUDE_ESTADO", "TERMINAL_CLAUDE_INICIO"] and b["config"] == r"C:\Users\gu\.claude-insiders", str(b["env"]))
confere("claude rodou na pasta da trilha", os.path.realpath(b.get("cwd", "")) == os.path.realpath(pasta))
confere("manteve acordado enquanto o claude rodava e soltou depois", fake.acordado[:2] == [True, False], str(fake.acordado))
estados = sorted(Path(c[5] + ".estado").read_text(encoding="utf-8") for c in reg)
confere("depois que o claude sai o estado vira encerrada", estados == ["encerrada"] * 3, str(estados))
confere("e a janela abre um PowerShell na pasta da trilha", len(shells) == 3 and all(os.path.samefile(c, pasta) for c in shells), str(shells))

# --- registro: sem ver a janela, só a esquece se o processo já não for o da trilha ---------
def no_registro(): return [c[0] for c in terminais.registro_com_trava()]
fake.comandos = {os.getpid(): f'"C:/python.exe" C:/skills/terminais.py rodar {reg[1][5]}'}
so.linha_de_comando = lambda pid: fake.comandos.get(pid, "")
janela_b = fake.jan.pop(int(reg[1][0]))     # a janela B some da leitura, com o processo dela rodando
confere("janela que a leitura não viu, com o processo da trilha rodando, continua no registro", reg[1][0] in no_registro(), str(no_registro()))
confere("e os arquivos dela continuam no cache", Path(reg[1][5] + ".json").exists() and Path(reg[1][5] + ".estado").exists())
fake.jan[int(reg[1][0])] = janela_b
alheia = str(so.CACHE / "alheia")
Path(alheia + ".estado").write_text("trabalhando", encoding="utf-8"); Path(alheia + ".json").write_text("{}", encoding="utf-8")
with so.REGISTRO.open("a", encoding="utf-8") as f:
    f.write("\t".join(["3001", "4242", pasta, "outra-sessao", "2026-10-12 02:00", alheia]) + "\n")
fake.vivos.add(4242); fake.comandos[4242] = "C:/Windows/notepad.exe"
confere("janela que fechou sai do registro mesmo com o número do processo reaproveitado por outro programa", "3001" not in no_registro() and not Path(alheia + ".json").exists(), str(no_registro()))
fake.vivos.discard(4242); fake.comandos.clear()   # as três janelas dividem o processo do teste: daqui em diante vale só a janela

# --- marcar, status, ver -----------------------------------------------------------------
os.environ["TERMINAL_CLAUDE_ESTADO"] = reg[0][5] + ".estado"
sys.argv = ["terminais.py", "marcar", "trabalhando"]; terminais.main()
# --- limpeza: conta por pasta, "agora não" e "nunca" --------------------------------------
def uso(): return json.loads((so.CACHE / "uso.json").read_text(encoding="utf-8"))
def conta(dias_atras=None, **campos):
    """Reescreve a conta da pasta e soma um lote; devolve o que o abrir imprimiria."""
    u = uso(); u["pastas"][pasta].update(campos); terminais.gravar_uso(u)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf): terminais.contar_lote({pasta})
    return buf.getvalue()
dia = lambda n: time.strftime("%Y-%m-%d", time.localtime(time.time() - n * 86400))
confere("o lote entrou na conta de uso da pasta", uso()["pastas"][pasta]["lotes"] == 1)
confere("poucos lotes e pouco tempo: sem aviso", conta() == "")
confere("no 10º lote o aviso aparece", "Aviso: 10 lote(s)" in conta(lotes=9))
confere("14 dias de uso também avisam", "Aviso:" in conta(lotes=1, desde=dia(14)))
os.environ.update(TERMINAL_CLAUDE_ESTADO=reg[1][5] + ".estado", TERMINAL_CLAUDE_INICIO="trabalhando")
sys.argv = ["terminais.py", "marcar", "inicio"]; terminais.main()
confere("no início, janela com prompt já nasce trabalhando", Path(reg[1][5] + ".estado").read_text(encoding="utf-8") == "trabalhando")
del os.environ["TERMINAL_CLAUDE_INICIO"]; terminais.main()
confere("no início, janela sem prompt fica parada", Path(reg[1][5] + ".estado").read_text(encoding="utf-8") == "parada")
confere("marcar grava o estado", Path(reg[0][5] + ".estado").read_text(encoding="utf-8") == "trabalhando")
del os.environ["TERMINAL_CLAUDE_ESTADO"]
import io, contextlib
def roda(*argv):
    buf = io.TextIOWrapper(io.BytesIO(), encoding="utf-8"); sys.argv = ["terminais.py", *argv]
    with contextlib.redirect_stdout(buf):
        try: terminais.main()
        except SystemExit as e: buf.write(f"[saiu: {e}]")
    buf.flush()
    return buf.buffer.getvalue().decode()
st = roda("status")
confere("status lista as 3 com estado e título", st.count("\n") == 3 and "trabalhando" in st and "B · difícil" in st, st)
confere("ver sem transcript avisa em vez de ler a tela", "ainda não gravou" in roda("ver", reg[0][0]))
confere("limpeza com pasta e sem dizer o que houve explica as opções", "--feita (limpou)" in roda("limpeza", pasta))
confere("--adiar anota e avisa quando volta", "daqui a 3 dias" in roda("limpeza", pasta, "--adiar") and "adiado" in uso()["pastas"][pasta])
confere("adiado hoje: sem aviso, mesmo com muitos lotes", conta(lotes=50) == "")
confere("adiado há 3 dias: pergunta de novo", "Aviso:" in conta(adiado=dia(3)))
confere("--nunca desliga a pergunta", "não pergunto mais" in roda("limpeza", "--nunca") and conta(adiado=dia(9)) == "")
confere("a listagem mostra a conta e que a pergunta está desligada", "desligada" in roda("limpeza") and "lote(s) desde" in roda("limpeza"))
confere("--perguntar liga de novo", "volto a perguntar" in roda("limpeza", "--perguntar") and "Aviso:" in conta())
confere("--feita zera a conta da pasta", "zerada" in roda("limpeza", pasta, "--feita") and pasta not in uso()["pastas"])
espera = roda("esperar")
confere("esperar volta com as janelas que pararam, mesmo com outra trabalhando, e diz quais", f"A janela {reg[1][0]} (B · difícil) parou" in espera and f"A janela {reg[2][0]} (C · sem prompt) encerrou" in espera and "Ainda há janela trabalhando (1)" in espera, espera)
espera = roda("esperar", "--minutos", "0")
confere("parada já avisada não faz o esperar voltar: só o tempo esgotado", "A janela" not in espera and "Nada mudou em 0 min: ainda há janela trabalhando (1)" in espera, espera)
Path(reg[0][5] + ".estado").write_text("parada", encoding="utf-8")
espera = roda("esperar")
confere("esperar volta na hora quando nenhuma janela trabalha, avisando só a que parou agora", "Nenhuma janela trabalhando" in espera and espera.count("A janela") == 1 and f"A janela {reg[0][0]} (A · simples) parou" in espera, espera)

# --- fechar ------------------------------------------------------------------------------
eu = os.getpid(); mortos = []
so.processos = lambda: ({500: eu, 501: 500, 900: 1}, [(501, 5173), (900, 80)])
subprocess.run = lambda argv, **k: mortos.append(argv)
confere("fechar --listar não fecha nada", "fecharia" not in roda("fechar", "--listar") and len(fake.jan) == 4)
saida = roda("fechar")
confere("janela que segura servidor é preservada, com a porta", saida.count("segura servidor na porta 5173") == 3 and not mortos, saida)
so.processos = lambda: ({500: eu}, [(900, 80)])
saida = roda("fechar", reg[0][0])
confere("fechar <id> fecha só aquela, matando a árvore do processo", "1 janela(s) fechada(s)" in saida and mortos == [["taskkill", "/PID", str(eu), "/T", "/F"]] and int(reg[0][0]) not in fake.jan, saida + str(mortos))
saida = roda("fechar")
confere("fechar fecha as outras duas da sessão", "2 janela(s) fechada(s)" in saida and sorted(fake.jan) == [1001], saida)
confere("a janela do dono não foi tocada pelo fechar", 1001 in fake.jan)
confere("registro e cache limpos depois", roda("status").startswith("Nenhuma janela") and sorted(p.name for p in so.CACHE.iterdir()) == ["hooks.json", "uso.json"], str(list(so.CACHE.iterdir())))
confere("fechar com opção errada diz quais valem", "Valem --todas" in roda("fechar", "--tudo"))

# --- perfis: --perfil, "outras" em rodízio, perfil por trilha e --continuar entre perfis ------
casa = raiz / "casa"
for nome, usado in ((".claude", False), (".claude-devin", True), (".claude-insiders", True), (".claude-velho", False)):
    (casa / nome).mkdir(parents=True)
    if usado:
        (casa / nome / ".claude.json").write_text("{}", encoding="utf-8")
devin, insiders = str(casa / ".claude-devin"), str(casa / ".claude-insiders")
terminais.CASA, terminais.MEU_PERFIL = casa, insiders
confere("perfis: o padrão e os ~/.claude-* já usados", terminais.perfis() == [None, devin, insiders], str(terminais.perfis()))
confere("outras: todos menos o desta sessão", terminais.expandir_perfis("outras") == [None, devin], str(terminais.expandir_perfis("outras")))
confere("lista de nomes, com o padrão", terminais.expandir_perfis("devin, padrao") == [devin, None], str(terminais.expandir_perfis("devin, padrao")))
confere("perfil que não existe diz quais valem", "Valem: auto, outras, padrao, devin, insiders." in roda("abrir", pasta, "--perfil", "xpto"))
antes = set(glob.glob(str(raiz / "saida-*.json")))
roda("abrir", pasta, "-n", "3", "--prompt", "x", "--perfil", "outras")
novas = sorted((le(f) for f in set(glob.glob(str(raiz / "saida-*.json"))) - antes), key=lambda s: s["argv"][s["argv"].index("--name") + 1])
confere("outras em rodízio: padrão, devin, padrão", [s["config"] for s in novas] == [None, devin, None], str([s["config"] for s in novas]))
confere("a janela do padrão vai sem CLAUDE_CONFIG_DIR", novas and "CLAUDE_CONFIG_DIR" not in novas[0]["env"], str(novas[0]["env"] if novas else ""))
lote.write_text(json.dumps([{"titulo": "P · fixa", "prompt": "p", "perfil": "insiders"}, {"titulo": "Q · rodízio", "prompt": "q"}]), encoding="utf-8")
antes = set(glob.glob(str(raiz / "saida-*.json")))
roda("abrir", pasta, "--lote", str(lote), "--perfil", "devin")
novas = {s["argv"][s["argv"].index("--name") + 1]: s["config"] for s in (le(f) for f in set(glob.glob(str(raiz / "saida-*.json"))) - antes)}
confere("o perfil da trilha vence o --perfil do lote", novas == {"P · fixa": insiders, "Q · rodízio": devin}, str(novas))
conversa = Path(insiders) / "projects" / "-projeto" / "sessao-teste.jsonl"
conversa.parent.mkdir(parents=True); conversa.write_text(json.dumps({"cwd": pasta}) + "\n", encoding="utf-8")
(conversa.with_suffix("") / "tool-results").mkdir(parents=True); (conversa.with_suffix("") / "tool-results" / "r.txt").write_text("r")
terminais.levar_conversa(devin)
copia = Path(devin) / "projects" / "-projeto" / "sessao-teste.jsonl"
confere("--continuar em outro perfil leva a conversa e a pasta dela pro projects de lá", copia.read_text(encoding="utf-8") == conversa.read_text(encoding="utf-8") and (copia.with_suffix("") / "tool-results" / "r.txt").exists())
if not NO_WINDOWS:   # link de pasta no Windows pede privilégio
    (casa / ".claude-ligado").mkdir(); (casa / ".claude-ligado" / "projects").symlink_to(Path(insiders) / "projects")
    terminais.levar_conversa(str(casa / ".claude-ligado"))
    confere("perfil com o projects ligado ao desta sessão não copia em cima do próprio arquivo", conversa.exists())

# --- contas e --perfil auto: primeiro a que zera a semana antes, nenhuma passa de 80% ----------------
from datetime import datetime, timezone
import urllib.error
for arq, nome in ((casa / ".claude.json", "PRIME"), (Path(devin) / ".claude.json", "LUMMA"), (Path(insiders) / ".claude.json", "Tech Ynova")):
    arq.write_text(json.dumps({"oauthAccount": {"displayName": nome}}), encoding="utf-8")
CFG = {"padrao": None, "devin": devin, "insiders": insiders}
DIA = 86400
def iso(segundos): return datetime.fromtimestamp(time.time() + segundos, timezone.utc).isoformat().replace("+00:00", "Z")
terminais.CORY = raiz / "cory-uso.json"
def cory(*contas, idade=60):
    """O uso.json do Cory, uma (contaId, sessão, semana, dias até zerar a semana) por conta. Zera o guardado da API."""
    terminais.CORY.write_text(json.dumps([{"contaId": cid, "sessao5h": s, "zeraEm": iso(2 * 3600), "semana7d": w,
                                           "zeraSemanaEm": iso(d * DIA), "atualizadoEm": iso(-idade)} for cid, s, w, d in contas]), encoding="utf-8")
    (so.CACHE / "contas.json").unlink(missing_ok=True)
    api["chamadas"].clear()
def login(chave, expira_em=3600):
    arq = Path(CFG[chave] or casa / ".claude") / ".credentials.json"
    arq.write_text(json.dumps({"claudeAiOauth": {"accessToken": f"tok-{chave}", "refreshToken": "nao-renova",
                                                 "expiresAt": (time.time() + expira_em) * 1000}}), encoding="utf-8")
for chave in CFG: login(chave)
def resposta(sessao, semana, dias):
    """No formato que a API devolveu em 24/10/2026: porcentagem em float, hora com microssegundos e +00:00."""
    hora = lambda s: datetime.fromtimestamp(time.time() + s, timezone.utc).isoformat()
    return {"five_hour": {"utilization": float(sessao), "resets_at": hora(2 * 3600)},
            "seven_day": {"utilization": float(semana), "resets_at": hora(dias * DIA)}, "seven_day_sonnet": None, "limits": []}
api = {"chamadas": [], "respostas": {}}   # token → resposta, ou o código HTTP do erro
def urlopen_falso(pedido, timeout=None):
    token = pedido.get_header("Authorization").split()[-1]
    api["chamadas"].append(token)
    assert pedido.full_url == "https://api.anthropic.com/api/oauth/usage" and pedido.get_header("Anthropic-beta") == "oauth-2025-04-20"
    r = api["respostas"].get(token, 500)
    if isinstance(r, int):
        raise urllib.error.HTTPError(pedido.full_url, r, "erro", {}, None)
    return io.BytesIO(json.dumps(r).encode())
terminais.urlopen = urlopen_falso
def auto(*extra):
    """O dry-run do --perfil auto: (a conta de cada janela, a saída)."""
    saida = roda("abrir", pasta, "--perfil", "auto", "--dry-run", *extra)
    return re.findall(r"\((padrao|devin|insiders)\) · \d+% da semana", saida), saida

base = datetime(2026, 10, 24, 2, 0).timestamp()
zeras = [terminais.quando(datetime(2026, 10, d, h, m).timestamp(), base) for d, h, m in ((24, 14, 20), (25, 16, 0), (29, 5, 0), (31, 9, 0))]
confere("quando zera, na hora local: hoje, amanhã, dia da semana e data", zeras == ["hoje 14h20", "amanhã 16h", "qui 05h", "31/10 09h"], str(zeras))
confere("o nome do login no Chaveiro do Mac é o que o claude usa (conferido no Chaveiro em 24/10/2026)",
        terminais.servico_chaveiro("/Users/gustavogarcia/.claude-devin") == "Claude Code-credentials-048da4c2"
        and terminais.servico_chaveiro(None) == "Claude Code-credentials")

cory(("padrao", 10, 65, 1.5), ("devin", 10, 20, 5), ("insiders", 10, 10, 6.5))
escolha, saida = auto("--prompt", "x")
confere("a conta a 65% que zera em 1,5 dia vem antes da de 20% que zera em 5", escolha == ["padrao"], saida)
confere("o abrir diz a conta, o uso da semana e quando zera", re.search(r"· Prime \(padrao\) · 65% da semana, zera \S+ \d\dh", saida), saida)
confere("com o uso do Cory fresco a API não é chamada", api["chamadas"] == [], str(api["chamadas"]))
escolha, saida = auto("-n", "4", "--prompt", "x")
confere("a 65% recebe as 3 janelas que a deixam em até 80% e a quarta vai para a próxima da fila", escolha == ["padrao"] * 3 + ["devin"], saida)
confere("e a janela que mudou de conta diz por quê", "Lumma (devin) · 20% da semana" in saida and "Prime passaria de 80%" in saida, saida)

cory(("padrao", 10, 75, 1), ("devin", 10, 20, 2), ("insiders", 10, 10, 6))
escolha, saida = auto("-n", "3", "--prompt", "x")
confere("a 75% recebe só a janela que cabe (80%), as outras vão para a próxima", escolha == ["padrao", "devin", "devin"], saida)
cory(("padrao", 10, 79, 1), ("devin", 10, 20, 2), ("insiders", 10, 10, 6))
escolha, saida = auto("-n", "3", "--prompt", "x")
confere("a 79% não recebe nenhuma: uma janela a mais passaria de 80%", escolha == ["devin"] * 3, saida)
cory(("padrao", 60, 30, 1), ("devin", 10, 20, 2), ("insiders", 10, 10, 6))
escolha, saida = auto("-n", "2", "--prompt", "x")
confere("a sessão de 5 h também limita: com 60% cabe uma janela", escolha == ["padrao", "devin"], saida)
cory(("padrao", 10, 85, 0.5), ("devin", 80, 20, 2), ("insiders", 10, 10, 6))
escolha, saida = auto("--prompt", "x")
confere("acima de 80% na semana ou na sessão fica fora, mesmo zerando antes", escolha == ["insiders"], saida)
contas = roda("contas")
confere("o contas mostra cada conta, a ordem e o motivo", all(n in contas for n in ("Prime (padrao)", "Lumma (devin)", "Tech Ynova (insiders)", "Ordem do --perfil auto agora", "Por quê:")), contas)
confere("e quem ficou fora, com o uso", "Fora do auto: Prime (padrao): sessão 10%" in contas and "semana 85%" in contas and "Fora do auto: Lumma (devin): sessão 80%" in contas, contas)

cory(("padrao", 10, 85, 0.5), ("devin", 80, 20, 2), ("insiders", 10, 79, 6))
antes = len(chamadas)
saida = roda("abrir", pasta, "--prompt", "x", "--perfil", "auto")
confere("nenhuma conta com folga: não abre e diz o uso e quando zera cada uma", len(chamadas) == antes and "não abriu nada: nenhuma conta tem folga" in saida
        and all(f"{n}: sessão" in saida for n in ("Prime (padrao)", "Lumma (devin)", "Tech Ynova (insiders)")) and saida.count(", zera ") >= 6, saida)
cory(("padrao", 10, 75, 1), ("devin", 10, 78, 2), ("insiders", 10, 70, 6))
saida = roda("abrir", pasta, "-n", "4", "--prompt", "x", "--perfil", "auto")
confere("lote que não cabe inteiro: não abre nenhuma e diz quantas cabem", len(chamadas) == antes and "cabem só 3 das 4 janelas" in saida, saida)

cory(("padrao", 10, 70, 1), ("devin", 10, 20, 2), ("insiders", 10, 10, 6))
lote.write_text(json.dumps([{"titulo": "M · na mão", "prompt": "m", "perfil": "padrao"}, {"titulo": "N · auto", "prompt": "n"},
                            {"titulo": "O · auto", "prompt": "o"}, {"titulo": "P · na mão", "prompt": "p", "perfil": "insiders"}]), encoding="utf-8")
antes = set(glob.glob(str(raiz / "saida-*.json")))
saida = roda("abrir", pasta, "--lote", str(lote), "--perfil", "auto")
novas = {s["argv"][s["argv"].index("--name") + 1]: s["config"] for s in (le(f) for f in set(glob.glob(str(raiz / "saida-*.json"))) - antes)}
confere("a escolha na mão vence o auto, e a janela dela conta no gasto da conta", novas == {"M · na mão": None, "N · auto": None, "O · auto": devin, "P · na mão": insiders}, f"{novas}\n{saida}")
cory(("padrao", 10, 95, 1), ("devin", 10, 20, 2), ("insiders", 10, 10, 6), idade=3600)
antes = set(glob.glob(str(raiz / "saida-*.json")))
roda("abrir", pasta, "--prompt", "x", "--perfil", "padrao")
novas = [le(f)["config"] for f in set(glob.glob(str(raiz / "saida-*.json"))) - antes]
confere("escolhendo na mão abre mesmo acima de 80%, sem ler o uso", novas == [None] and api["chamadas"] == [], f"{novas} {api['chamadas']}")

cory(("padrao", 10, 65, 1.5), ("devin", 10, 20, 5), ("insiders", 10, 10, 6.5), idade=20 * 60)
api["respostas"] = {"tok-padrao": resposta(30, 82, 1.5), "tok-devin": resposta(5, 20, 5), "tok-insiders": resposta(0, 10, 6.5)}
escolha, saida = auto("--prompt", "x")
confere("uso.json com mais de 15 min: lê da API, que manda", escolha == ["devin"] and sorted(api["chamadas"]) == ["tok-devin", "tok-insiders", "tok-padrao"], f"{api['chamadas']}\n{saida}")
api["chamadas"].clear()
escolha, saida = auto("--prompt", "x")
confere("e guarda o que a API deu: logo depois não pergunta de novo", escolha == ["devin"] and api["chamadas"] == [], str(api["chamadas"]))
contas = roda("contas")
confere("o contas diz de onde veio cada número", contas.count("API, ") == 3 and re.search(r"Prime \(padrao\)\s+30%\s+zera \S+ \d\dh\S*\s+82%", contas), contas)

cory(("padrao", 10, 65, 1.5), ("devin", 10, 20, 5), ("insiders", 10, 10, 6.5), idade=40 * 60)
api["respostas"] = {"tok-padrao": 429, "tok-devin": 429, "tok-insiders": 429}
escolha, saida = auto("--prompt", "x")
confere("API recusou (429): vale o uso.json velho, com a idade no aviso", escolha == ["padrao"] and "o uso da Prime (padrao) é o lido há 40 min (Cory); a leitura de agora falhou: a API recusou: muitas consultas." in saida, saida)
cory(("padrao", 10, 79, -0.5), ("devin", 10, 20, 5), ("insiders", 10, 10, 6.5), idade=6 * 3600)
escolha, saida = auto("--prompt", "x")
contas = roda("contas")
confere("número velho com a semana já zerada conta como 0%, e zera de novo 7 dias depois", escolha == ["devin"]
        and re.search(r"Prime \(padrao\)\s+10%\s+zera \S+ \S+\s+0%\s+zera \S+ \S+ \(em 6d\d+h\)", contas), f"{escolha}\n{contas}")

terminais.CORY.unlink()
(so.CACHE / "contas.json").unlink(missing_ok=True)
api["respostas"] = {"tok-padrao": resposta(30, 50, 1.5), "tok-insiders": resposta(0, 10, 6.5)}
login("devin", expira_em=-60)
api["chamadas"].clear()
escolha, saida = auto("--prompt", "x")
confere("login vencido não vai à API (e nunca renova o token): a conta fica fora, com aviso",
        "tok-devin" not in api["chamadas"] and "sem o uso da Lumma (devin) (login vencido: abre o claude nessa conta): ela fica fora do --perfil auto." in saida and escolha == ["padrao"], saida)
login("devin")
api["respostas"] = {}
(so.CACHE / "contas.json").unlink(missing_ok=True)
saida = roda("abrir", pasta, "-n", "3", "--prompt", "x", "--perfil", "auto", "--dry-run")
nomes = re.findall(r"· (padrão \(~/\.claude\)|~/\.claude-\w+)\n", saida)
confere("API falhou e sem uso.json: cai no rodízio do outras e avisa", "caiu no rodízio do --perfil outras" in saida and nomes == ["padrão (~/.claude)", "~/.claude-devin", "padrão (~/.claude)"], f"{nomes}\n{saida}")

# --- dentro do Cory: as trilhas abrem como terminais dele --------------------------------------------
# O Cory é o de mentira (cory_falso.py). O terminal dele roda o mesmo `rodar` da janela do Windows
# Terminal, aqui dentro do teste, como faz o wt de mentira.
from cory_falso import CoryFalso
roda("fechar"); mortos.clear(); chamadas.clear()
so.processos = lambda: ({}, [])
pids_cory = iter(range(7001, 7100))
def rodar_no_cory(tid, corpo):
    """Como o Cory: o ambiente dele sem as CLAUDE*, o endereço da API com a conversa dona do terminal, e o
    env do pedido por cima."""
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith(("CLAUDE", "CORY"))}
    env.update(CORY_TERMINAIS=cory.url, CORY_TERMINAIS_TOKEN=cory.token, **({"CORY_CONVERSA": corpo["conversa"]} if corpo.get("conversa") else {}))
    env.update(corpo.get("env") or {})
    ambiente = dict(os.environ); os.environ.clear(); os.environ.update(env)
    base = corpo["comando"][3]
    try:
        sys.argv = corpo["comando"][1:]; terminais.main()   # o `rodar` como a linha de comando o chama
    finally: os.environ.clear(); os.environ.update(ambiente)
    # Aqui todo terminal roda no processo do teste: cada um ganha um número próprio, como teria.
    pid = next(pids_cory)
    Path(base + ".pid").write_text(str(pid))
    fake.vivos.add(pid); fake.comandos[pid] = f'"C:/python.exe" C:/skills/terminais.py rodar {base} --session-id {corpo["comando"][-1]}'
    return pid
cory = CoryFalso(rodar_no_cory, lambda pid: pid in fake.vivos, fake.vivos.discard)

os.environ.update(CORY_TERMINAIS=cory.url, CORY_TERMINAIS_TOKEN=cory.token, CORY_CONVERSA="conversa-9")
lote.write_text(json.dumps([{"titulo": "W · um", "prompt": "faz a parte 1"}, {"titulo": "X · dois", "prompt": prompt_dificil}], ensure_ascii=False), encoding="utf-8")
antes = set(glob.glob(str(raiz / "saida-*.json")))
saida = roda("abrir", pasta, "--lote", str(lote))
posts, tids = cory.de("POST"), list(cory.terminais)
confere("Cory: com CORY_TERMINAIS as trilhas abrem como terminais do Cory, sem o wt", len(posts) == 2 and not chamadas and "Grade e --monitor não valem aqui" in saida, saida)
sessoes = [l["filho"] for l in [json.loads(l) for l in terminais.LINHAGEM.read_text(encoding="utf-8").splitlines()][-2:]]
confere("Cory: o comando é o `rodar` da janela com o --session-id à vista, e o POST leva token, título, pasta e conversa",
        all(p[3]["comando"] == [sys.executable, str(so.MOTOR), "rodar", p[3]["comando"][3], "--session-id", s] and p[2] == f"Bearer {cory.token}"
            and p[3]["pasta"] == pasta and p[3]["conversa"] == "conversa-9" for p, s in zip(posts, sessoes)) and [p[3]["titulo"] for p in posts] == ["W · um", "X · dois"], str(posts))
confere("Cory: o env diz a conta (CLAUDE_CONFIG_DIR) e dá à trilha a conversa dela, a sessão",
        [(p[3]["env"].get("CLAUDE_CONFIG_DIR"), p[3]["env"].get("CORY_CONVERSA")) for p in posts] == [(insiders, s) for s in sessoes], str(posts))
novas = {le(f)["argv"][le(f)["argv"].index("--name") + 1]: le(f) for f in set(glob.glob(str(raiz / "saida-*.json"))) - antes}
x = novas.get("X · dois", {"argv": [], "env": [], "config": None})
confere("Cory: o claude de cada trilha rodou, com o prompt difícil inteiro, no perfil e com o arquivo de estado",
        sorted(novas) == ["W · um", "X · dois"] and prompt_dificil in x["argv"] and x["config"] == insiders and "TERMINAL_CLAUDE_ESTADO" in x["env"], str(x))
confere("Cory: e leva o Cory adiante", {"CORY_TERMINAIS", "CORY_TERMINAIS_TOKEN", "CORY_CONVERSA"} <= set(x["env"]), str(x["env"]))
reg = [l.split("\t") for l in so.REGISTRO.read_text(encoding="utf-8").splitlines()]
confere("Cory: o registro marca cada uma com cory:<id> e o pid do terminal", [c[1] for c in reg] == [f"cory:{t}" for t in tids] and [c[0] for c in reg] == ["7001", "7002"], str(reg))
fake.vivos.add(7999); fake.comandos[7999] = f'"C:/python.exe" C:/skills/terminais.py rodar {reg[0][5]}2 --session-id x'
confere("Cory: o processo de outra trilha (…-12) não passa pelo desta (…-1)", not so.processo_da_trilha(7999, reg[0][5]) and so.processo_da_trilha(7001, reg[0][5]))
fake.vivos.discard(7999)
linhagem = [json.loads(l) for l in terminais.LINHAGEM.read_text(encoding="utf-8").splitlines()][-2:]
confere("Cory: a linhagem anota as duas, com quem abriu e o terminal", [(l["titulo"], l["pai"], l.get("cory")) for l in linhagem] == [("W · um", "sessao-teste", tids[0]), ("X · dois", "sessao-teste", tids[1])], str(linhagem))
for c, estado in zip(reg, ("trabalhando", "parada")):
    Path(c[5] + ".estado").write_text(estado, encoding="utf-8")
st = roda("status")
confere("Cory: o status das trilhas vem dos hooks", "7001  ⏳ trabalhando" in st and "7002  ✅ parada" in st, st)
espera = roda("esperar")
confere("Cory: o esperar volta com a trilha que parou", "A janela 7002 (X · dois) parou" in espera and "Ainda há janela trabalhando (1)" in espera, espera)

so.processos = lambda: ({7501: 7001}, [(7501, 3000)])
saida = roda("fechar", "7001")
confere("Cory: terminal que segura servidor não fecha", "janela 7001 (terminal do Cory): segura servidor na porta 3000" in saida and not cory.de("DELETE"), saida)
saida = roda("fechar", "7001", "--forcar")
confere("Cory: com --forcar mata a árvore do processo e tira a aba pelo DELETE",
        ["taskkill", "/PID", "7001", "/T", "/F"] in mortos and [(d[1], d[2]) for d in cory.de("DELETE")] == [(f"/terminais/{tids[0]}", f"Bearer {cory.token}")]
        and no_registro() == ["7002"], saida + str(mortos))
so.processos = lambda: ({}, [])
mortos.clear()
saida = roda("fechar")
confere("Cory: o fechar tira a aba pelo DELETE, sem taskkill, e a linha sai do registro", len(cory.de("DELETE")) == 2 and not mortos and no_registro() == [], saida + str(mortos))

roda("abrir", pasta, "--prompt", "fica")
pid_cory = no_registro()[0]
cory.desligar()
confere("Cory: fora do ar, o registro segura a trilha pelo processo dela", no_registro() == [pid_cory], str(no_registro()))
saida = roda("fechar")
confere("Cory: e o fechar, sem o Cory, mata o processo dela", ["taskkill", "/PID", pid_cory, "/T", "/F"] in mortos and "o Cory não respondeu" in saida, saida + str(mortos))
fake.vivos.discard(int(pid_cory))   # o taskkill daqui é de mentira
confere("Cory: com o processo morto a linha sai do registro", no_registro() == [], str(no_registro()))

chamadas.clear()
saida = roda("abrir", pasta, "--prompt", "x")
confere("Cory: fora do ar na hora de abrir, avisa e abre no Windows Terminal", "o Cory não respondeu" in saida and len(chamadas) == 1, saida)
cory = CoryFalso(rodar_no_cory, lambda pid: pid in fake.vivos, fake.vivos.discard, token="token-novo")
os.environ["CORY_TERMINAIS"] = cory.url
saida = roda("abrir", pasta, "--prompt", "x")
confere("Cory: token recusado, avisa e abre no Windows Terminal", "o Cory recusou o token" in saida and len(chamadas) == 2 and not cory.de("POST"), saida)
for k in ("CORY_TERMINAIS", "CORY_TERMINAIS_TOKEN", "CORY_CONVERSA"):
    os.environ.pop(k)
cory.pedidos.clear()
saida = roda("abrir", pasta, "--prompt", "x")
confere("Cory: sem CORY_TERMINAIS nada muda: abre no Windows Terminal e não fala com o Cory", len(chamadas) == 3 and not cory.pedidos and "Cory" not in saida, saida)
cory.desligar()
roda("fechar")

shutil.rmtree(raiz, ignore_errors=True)
sys.exit(f"\n{len(falhas)} FALHA(S): {'; '.join(falhas)}" if falhas else print("\nTUDO OK"))
