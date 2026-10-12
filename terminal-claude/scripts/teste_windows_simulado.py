#!/usr/bin/env python3
"""Exercita no Mac os ramos de Windows do terminal-claude e do organizar, com o sistema simulado:
janelas, monitores, processos, o wt.exe e o claude são de mentira.

Não prova as chamadas Win32 de verdade nem o Windows Terminal: prova que a lógica em volta delas
fecha. Rode depois de mexer em so_windows.py, janelas_win.py ou no terminais.py:

    python3 teste_windows_simulado.py
"""
import glob, json, os, shutil, sys, tempfile, types
# A biblioteca padrão é carregada antes do msvcrt de mentira: o subprocess decide se está no Windows por ele.
import argparse, contextlib, io, re, shlex, subprocess, time, unicodedata, urllib.parse, urllib.request, uuid  # noqa
from pathlib import Path

AQUI = Path(__file__).resolve().parent
raiz = Path(tempfile.mkdtemp(prefix="simwin-"))
os.environ.update(APPDATA=str(raiz / "AppData/Roaming"), LOCALAPPDATA=str(raiz / "AppData/Local"),
                  TMPDIR=str(raiz / "Temp"), CLAUDE_CONFIG_DIR=r"C:\Users\gu\.claude-insiders")
(raiz / "Temp").mkdir(); tempfile.tempdir = str(raiz / "Temp")
(raiz / "projeto").mkdir()
claude_falso = raiz / "claude-falso"
claude_falso.write_text(f"""#!{sys.executable}
import json, os, sys
a = sys.argv[1:]; sid = a[a.index("--session-id") + 1]
json.dump({{"argv": a, "cwd": os.getcwd(), "config": os.environ.get("CLAUDE_CONFIG_DIR"),
           "env": sorted(k for k in os.environ if k.upper().startswith(("CLAUDE", "TERMINAL_CLAUDE", "AI_AGENT")))}},
          open({str(raiz)!r} + "/saida-" + sid + ".json", "w"), ensure_ascii=False)
""")
claude_falso.chmod(0o755)
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
confere("registro e cache nas pastas do Windows", str(so.REGISTRO).startswith(str(raiz / "Temp")) and str(so.CACHE).endswith("AppData/Local/terminal-claude"))
h = so.comando_hook("parada")
confere("hook sem aspas quando o caminho não tem espaço", '"' not in h and h.endswith("terminais.py marcar parada"), h)
real = sys.executable; sys.executable = "C:/Users/Nome Com Espaco/python.exe"
confere("hook com aspas quando o caminho tem espaço", so.comando_hook("parada").startswith('"C:/Users/Nome Com Espaco/python.exe" '), so.comando_hook("parada"))
sys.executable = real

# --- abrir -------------------------------------------------------------------------------
chamadas = []
PopenReal = subprocess.Popen
def popen_falso(argv, **k):
    """Faz o papel do wt.exe: cria a janela e roda nela o que foi pedido (o `rodar`). O resto passa direto."""
    if argv[0] != "C:/wt.exe":
        return PopenReal(argv, **k)
    chamadas.append((argv, k["env"]))
    fake.jan[2000 + len(chamadas)] = (50, 50, 900, 700)
    assert argv[-2] == "rodar"
    fake.vivos.add(os.getpid())
    ambiente = dict(os.environ); os.environ.clear(); os.environ.update(k["env"])   # a janela herda o ambiente do wt
    try: so.rodar(types.SimpleNamespace(base=argv[-1]))
    finally: os.environ.clear(); os.environ.update(ambiente)
shutil.which = {"wt": "C:/wt.exe", "pwsh": "/usr/bin/true", "claude": str(claude_falso)}.get
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
saidas = {json.load(open(f))["argv"][json.load(open(f))["argv"].index("--name") + 1]: json.load(open(f)) for f in glob.glob(str(raiz / "saida-*.json"))}
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
espera = roda("esperar", "--minutos", "0")
confere("esperar com tempo esgotado volta e avisa que ainda há janela trabalhando", "Ainda há janela trabalhando" in espera, espera)
Path(reg[0][5] + ".estado").write_text("parada", encoding="utf-8")
espera = roda("esperar")
confere("esperar volta na hora quando nenhuma janela trabalha", "Nenhuma janela trabalhando" in espera and espera.count("\n") == 4, espera)

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

shutil.rmtree(raiz, ignore_errors=True)
sys.exit(f"\n{len(falhas)} FALHA(S): {'; '.join(falhas)}" if falhas else print("\nTUDO OK"))
