#!/usr/bin/env python3
"""Exercita o registro do terminal-claude no Mac com o Terminal simulado: quem responde pelas janelas
e pelos ttys são listas de mentira, e o registro e o cache vão para uma pasta temporária. O
fechar-terminal.sh roda de verdade, numa cópia que fala com um osascript de mentira. Não abre janela
nem toca no registro de verdade. Rode depois de mexer em so_mac.py, no terminais.py ou no
fechar-terminal.sh:

    python3 teste_mac_simulado.py

No Windows roda a parte do registro e do esperar, que é o terminais.py no sistema de arquivos de lá; a
do fechar fica de fora, porque o fechar-terminal.sh é zsh e usa o ps e o lsof do Mac.
"""
import contextlib, io, json, os, shutil, subprocess, sys, tempfile, threading
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
os.environ["CLAUDE_CODE_SESSION_ID"] = "sessao-teste"
NO_WINDOWS = os.name == "nt"
if NO_WINDOWS:
    # O so_mac trava o registro com o fcntl, que o Windows não tem: a mesma trava, pelo msvcrt. O que o
    # terminais.py importa vem antes de fingir o Mac (o urllib.request, por exemplo, muda no Mac).
    import argparse, collections, math, msvcrt, re, shlex, time, types, unicodedata, urllib.parse, urllib.request, uuid  # noqa
    for _saida in (sys.stdout, sys.stderr):
        _saida.reconfigure(encoding="utf-8")
    fcntl = types.ModuleType("fcntl"); fcntl.LOCK_EX = 2
    def _flock(f, _modo):
        while True:
            try: return msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
            except OSError: pass
    fcntl.flock = _flock; sys.modules["fcntl"] = fcntl
    sys.platform = "darwin"
import so_mac as so, terminais

raiz = Path(tempfile.mkdtemp(prefix="simmac-"))
registro_de_verdade = str(so.REGISTRO)
so.REGISTRO, so.CACHE = raiz / "registro.tsv", raiz / "cache"
terminais.LINHAGEM = raiz / "linhagem.jsonl"
so.CACHE.mkdir()

# --- Terminal de mentira ------------------------------------------------------------------
class Janelas:
    """id → tty das janelas que existem de verdade. Um arquivo por janela: o osascript de mentira,
    que é outro processo, lê e fecha as mesmas."""
    def __init__(self, pasta): self.pasta = pasta; pasta.mkdir()
    def __setitem__(self, jid, tty): (self.pasta / str(jid)).write_text(tty)
    def __delitem__(self, jid): (self.pasta / str(jid)).unlink(missing_ok=True)
    pop = __delitem__
    def items(self): return [(int(j.name), j.read_text()) for j in self.pasta.iterdir()]
    def values(self): return [tty for _, tty in self.items()]
    def clear(self): [j.unlink() for j in self.pasta.iterdir()]
terminal = Janelas(raiz / "janelas")
omitidas = set()   # ids que a próxima leitura do AppleScript deixa de ver, uma vez só
outras_abas = set()  # ttys de abas que não são a selecionada da janela: o AppleScript não mostra
def vivas():
    vistas = {jid: tty for jid, tty in terminal.items() if jid not in omitidas}
    omitidas.clear()
    return vistas
so.vivas = vivas
so.ttys_do_terminal = lambda: set(terminal.values()) | outras_abas
so.tela = lambda jid: "tela de mentira"

# O que o fechar-terminal.sh pede ao Terminal: a lista das janelas, o "exit" do shell e o close.
def fim():
    shutil.rmtree(raiz, ignore_errors=True)
    sys.exit(f"\n{len(falhas)} FALHA(S): {'; '.join(falhas)}" if falhas else print("\nTUDO OK"))
osascript = raiz / "osascript"
osascript.write_text(f"""#!{sys.executable}
import re, sys
from pathlib import Path
janelas, pedido = Path({str(terminal.pasta)!r}), sys.argv[-1]
if m := re.search(r"close \\(every window whose id is (\\d+)\\)", pedido):
    (janelas / m[1]).unlink(missing_ok=True)
elif "do script" not in pedido:
    so_ids = "count of tabs" in pedido   # a conferência do fim só quer os ids
    for j in sorted(janelas.iterdir()):
        print(j.name if so_ids else f"{{j.name}} {{j.read_text()}}")
""", encoding="utf-8")
osascript.chmod(0o755)
script = (AQUI / "fechar-terminal.sh").read_text(encoding="utf-8")
if not NO_WINDOWS and ("/usr/bin/osascript" not in script or registro_de_verdade not in script):
    sys.exit("O fechar-terminal.sh mudou o jeito de chamar o osascript ou de achar o registro: "
             "acerta a cópia de teste antes, senão ela falaria com o Terminal de verdade.")
so.FECHAR = raiz / "fechar-terminal.sh"
so.FECHAR.write_text(script.replace("/usr/bin/osascript", str(osascript)).replace(registro_de_verdade, str(so.REGISTRO)), encoding="utf-8")

def abre(jid, tty, titulo, estado="trabalhando", sessao="sessao-teste"):
    base = str(so.CACHE / f"janela-{jid}")
    Path(base + ".estado").write_text(estado, encoding="utf-8")
    Path(base + ".json").write_text(json.dumps({"titulo": titulo, "sessao": f"s-{jid}", "config": str(raiz / "perfil")}), encoding="utf-8")
    Path(base + ".sh").write_text("", encoding="utf-8")
    with so.REGISTRO.open("a", encoding="utf-8") as f:
        f.write("\t".join([str(jid), tty, "/tmp/projeto", sessao, "2026-10-12 02:00", base]) + "\n")
    terminal[jid] = tty
    return base

def registro():
    with terminais.trava():
        return sorted(int(c[0]) for c in terminais.registro_vivo())

def arquivos(base):
    return sorted(p.suffix for p in so.CACHE.glob(Path(base).name + ".*"))

def roda(*argv):
    buf = io.TextIOWrapper(io.BytesIO(), encoding="utf-8", newline="\n"); sys.argv = ["terminais.py", *argv]
    with contextlib.redirect_stdout(buf):
        try: terminais.main()
        except SystemExit as e: buf.write(f"[saiu: {e}]")
    buf.flush()
    return buf.buffer.getvalue().decode()

def fecha(*ids):
    """O `terminais.py fechar`. O script escreve direto na saída do processo: é lá que se pega; o que é do
    Cory sai pelo print do Python."""
    with tempfile.TemporaryFile() as f:
        sys.stdout.flush()
        guardada = os.dup(1); os.dup2(f.fileno(), 1)
        try: do_python = roda("fechar", *map(str, ids))
        finally: os.dup2(guardada, 1); os.close(guardada)
        f.seek(0)
        return f.read().decode() + do_python

def direto(*ids):
    """O fechar-terminal.sh chamado pelo nome, como fazem prompts e scripts de outros projetos."""
    r = subprocess.run(["/bin/zsh", str(so.FECHAR), *map(str, ids)], capture_output=True, text=True)
    return r.stdout + r.stderr

def linhas():
    """Os ids que estão no arquivo do registro agora, sem limpar nada."""
    return [int(linha.split("\t")[0]) for linha in so.REGISTRO.read_text(encoding="utf-8").splitlines()]

falhas = []
def confere(nome, cond, detalhe=""):
    print(("ok   " if cond else "FALHA") + " " + nome + (f"  → {detalhe}" if detalhe and not cond else ""))
    if not cond: falhas.append(nome)

# --- registro: uma leitura que não vê a janela não basta para esquecê-la --------------------
a, b, c = abre(101, "/dev/ttys001", "A · schema"), abre(102, "/dev/ttys002", "B · docs"), abre(103, "/dev/ttys003", "C · api")
confere("as 3 janelas abertas estão no registro", registro() == [101, 102, 103])
omitidas.add(102)
confere("janela que uma leitura deixou de ver continua no registro", registro() == [101, 102, 103], str(registro()))
confere("e os arquivos dela continuam no cache", arquivos(b) == [".estado", ".json", ".sh"], str(arquivos(b)))
omitidas.add(102)
confere("o status ainda mostra a janela que a leitura não viu", "B · docs" in roda("status"))
omitidas.add(102)
confere("o ver ainda acha a janela que a leitura não viu", roda("ver", "102").startswith("B · docs"), roda("ver", "102"))
terminal[102] = "/dev/ttys009"; outras_abas.add("/dev/ttys002")
confere("janela com outra aba selecionada (a leitura mostra outro tty) continua no registro", registro() == [101, 102, 103], str(registro()))
terminal[102] = "/dev/ttys002"; outras_abas.clear()

# --- registro: janela que fechou de verdade sai, com os arquivos ----------------------------
del terminal[103]
confere("janela fechada à mão sai do registro", registro() == [101, 102], str(registro()))
confere("e os arquivos dela são apagados", arquivos(c) == [], str(arquivos(c)))
terminal.pop(101); terminal[201] = "/dev/ttys001"
confere("tty reaproveitado por outra janela não segura a que fechou", registro() == [102], str(registro()))
terminal.clear()
confere("com o Terminal fechado o registro esvazia", registro() == [] and arquivos(a) == arquivos(b) == [], str(list(so.CACHE.iterdir())))

# --- esperar: volta quando qualquer janela para, e diz qual ---------------------------------
relogio = [terminais.time.time() - 1000]
def marca(base, estado):
    """O que o hook faz: grava o estado. A hora vai explícita, pra duas gravações nunca empatarem."""
    relogio[0] += 1
    Path(base + ".estado").write_text(estado, encoding="utf-8")
    os.utime(base + ".estado", (relogio[0], relogio[0]))

class EsperouDemais(Exception): pass
def espera(*acoes, minutos=None):
    """Roda o esperar com o sono de mentira: cada volta do laço consome uma ação. Devolve (saída, voltas)."""
    fila, voltas = list(acoes), [0]
    def dormir(segundos):
        if segundos < 1: return            # o sono curto do ler_estado
        voltas[0] += 1
        if not fila: raise EsperouDemais()
        fila.pop(0)()
    sono, terminais.time.sleep = terminais.time.sleep, dormir
    try: saida = roda("esperar", *(["--minutos", str(minutos)] if minutos is not None else []))
    except EsperouDemais: saida = "[não voltou]"
    finally: terminais.time.sleep = sono
    return saida, voltas[0]

a, b, c = abre(301, "/dev/ttys001", "A · schema"), abre(302, "/dev/ttys002", "B · docs"), abre(303, "/dev/ttys003", "C · api")
saida, voltas = espera(lambda: marca(a, "parada"))
confere("volta quando UMA janela para, sem esperar as outras", voltas == 1 and "A janela 301 (A · schema) parou" in saida, saida)
confere("diz como colher e fechar a que parou", "`ver 301`" in saida and "`fechar 301`" in saida, saida)
confere("e que ainda há janela trabalhando, pra rodar de novo", "Ainda há janela trabalhando (2)" in saida and "esperar de novo" in saida, saida)
confere("não dá por paradas as que seguem trabalhando", "302 (" not in saida and "303 (" not in saida, saida)

saida, voltas = espera(lambda: marca(b, "pergunta"))
confere("a parada já avisada, com a janela ainda aberta, não faz o próximo esperar voltar na hora", voltas == 1 and "301 (" not in saida, saida)
confere("volta quando uma janela faz uma pergunta, e diz qual", "A janela 302 (B · docs) fez uma pergunta" in saida, saida)

marca(c, "encerrada")
saida, voltas = espera()
confere("a que parou entre duas chamadas é avisada na seguinte, na hora", voltas == 0 and "A janela 303 (C · api) encerrou" in saida, saida)
confere("com tudo parado, diz que não há janela trabalhando", "Nenhuma janela trabalhando" in saida, saida)
# A trilha que pôs um comando em segundo plano encerra o turno ("parada") e retoma sozinha quando ele acaba.
saida, voltas = espera(lambda: None, lambda: marca(a, "trabalhando"), lambda: marca(a, "parada"))
confere("sem janela trabalhando, segura pela parada que ainda não terminou e volta quando ela para de novo", voltas == 3 and "A janela 301 (A · schema) parou" in saida, saida)
confere("sem repetir o aviso das outras", "302 (" not in saida and "303 (" not in saida, saida)
saida, voltas = espera(minutos=0)
confere("tempo esgotado sem novidade e sem janela trabalhando: diz que nada mudou", voltas == 0 and "Nada mudou em 0 min" in saida and "A janela" not in saida, saida)

marca(b, "trabalhando"); marca(c, "trabalhando")
saida, voltas = espera(lambda: marca(a, "parada"))
confere("a mesma janela parando de novo (outro turno) é avisada de novo", voltas == 1 and "A janela 301 (A · schema) parou" in saida, saida)

saida, voltas = espera(lambda: None, lambda: terminal.pop(303))
confere("volta quando uma janela é fechada por fora, e diz qual", voltas == 2 and "A janela 303 (C · api) foi fechada" in saida, saida)

saida, voltas = espera(minutos=0)
confere("tempo esgotado sem novidade: volta e avisa que ainda há janela trabalhando", voltas == 0 and "Nada mudou em 0 min: ainda há janela trabalhando (1)" in saida and "A janela" not in saida, saida)

d = abre(304, "/dev/ttys004", "D · presa", estado="abrindo")
os.utime(d + ".estado", (terminais.time.time() - 200,) * 2)
saida, voltas = espera()
confere("janela presa em \"abrindo\" é avisada", voltas == 0 and "A janela 304 (D · presa) não saiu de \"abrindo\"" in saida, saida)
saida, voltas = espera(minutos=0)
confere("e uma vez só", "304 (" not in saida, saida)

terminal.clear()
confere("sem janela nenhuma, o esperar diz isso e volta", espera() == ("Nenhuma janela aberta por esta sessão.\n", 0))
confere("os avisos somem do cache junto com as janelas", list(so.CACHE.iterdir()) == [], str(list(so.CACHE.iterdir())))

if NO_WINDOWS:
    print("pulado no Windows: o fechar (fechar-terminal.sh é zsh, com o ps e o lsof do Mac)")
    fim()

# --- fechar: o script só lê o registro; quem tira a janela fechada é o terminais.py, com a trava ---
# Ids e ttys que não existem em máquina nenhuma: o script roda o ps e o lsof de verdade.
def tty(jid): return f"/dev/ttys{jid}"
def abertas(): return sorted(jid for jid, _ in terminal.items())

def outra_sessao(parar, alheias):
    """O abrir de outra sessão enquanto esta fecha: com a trava, abre a janela e acrescenta a linha."""
    jid = 990500 + len(alheias)
    while not parar.is_set():
        jid += 1
        with terminais.trava():
            abre(jid, tty(jid), f"de outra sessão {jid}", sessao="outra-sessao")
        alheias.append(jid)
        terminais.time.sleep(0.001)

def fecha_com_vizinha(fechar_por, minhas):
    """Fecha as janelas com outra sessão abrindo as dela ao mesmo tempo. Devolve (saída, abertas pela outra)."""
    for jid in minhas: abre(jid, tty(jid), f"minha {jid}")
    parar, alheias = threading.Event(), []
    vizinha = threading.Thread(target=outra_sessao, args=(parar, alheias)); vizinha.start()
    try: saida = fechar_por(*minhas)
    finally: parar.set(); vizinha.join()
    return saida, alheias

a, b, c = abre(990401, tty(990401), "A · schema"), abre(990402, tty(990402), "B · docs"), abre(990403, tty(990403), "C · api")
antes = so.REGISTRO.read_bytes()
saida = direto(990401)
confere("chamado pelo nome com um id, o script fecha essa janela e só ela",
        saida.endswith("janela 990401 fechada\n1 janela(s) fechada(s)\n") and abertas() == [990402, 990403], saida)
confere("e não regrava o registro, que só muda com a trava", so.REGISTRO.read_bytes() == antes, str(linhas()))

saida, alheias = fecha_com_vizinha(direto, range(990410, 990415))
sumiram = set(alheias) - set(linhas())
confere("fechando pelo nome, janela que outra sessão abre na mesma hora não some do registro",
        "5 janela(s) fechada(s)" in saida and alheias and not sumiram, f"{len(sumiram)} de {len(alheias)} linhas sumiram; saída: {saida}")
for jid in alheias: terminal.pop(jid)

# As janelas fechadas até aqui continuam no registro: ninguém chamou o terminais.py ainda.
d = abre(990404, tty(990404), "D · de outra sessão", sessao="outra-sessao")
saida = direto()
confere("chamado pelo nome sem ids, fecha as desta sessão e deixa as das outras", "2 janela(s) fechada(s)" in saida and abertas() == [990404], saida)
confere("sem dar por novidade as janelas que já tinham fechado", "não existe" not in saida, saida)
confere("e, só com linha de janela já fechada no registro, diz que não há o que fechar", direto() == "nenhuma janela registrada para fechar\n", direto())
confere("pedida pelo id, a janela que já fechou é avisada", "janela 990401: não existe mais" in direto(990401), direto(990401))
abre(990405, tty(990405), "G · fechada à mão"); terminal.pop(990405)
terminal[990405] = tty(990499)   # o Terminal reabriu e deu o id da linha velha a outra janela
saida = direto()
confere("id do registro que passou para outra janela não fecha a janela errada", abertas() == [990404, 990405] and "janela 990405" in saida and "não fechei" in saida, saida)
terminal.pop(990405)

e, f = abre(990406, tty(990406), "E · web"), abre(990407, tty(990407), "F · app")
saida = fecha(990406)
confere("pelo terminais.py, fecha a janela pedida", "janela 990406 fechada" in saida and abertas() == [990404, 990407], saida)
confere("e ela sai do registro na hora, junto com as que já tinham fechado", linhas() == [990404, 990407], str(linhas()))
confere("e os arquivos dela saem do cache", arquivos(e) == [] and arquivos(f) == arquivos(d) == [".estado", ".json", ".sh"], str(arquivos(e)))
saida = fecha()
confere("pelo terminais.py sem ids, fecha as desta sessão e deixa as das outras", "janela 990407 fechada" in saida and linhas() == abertas() == [990404], saida)
saida, alheias = fecha_com_vizinha(fecha, range(990420, 990425))
confere("fechando pelo terminais.py, janela que outra sessão abre na mesma hora não some do registro",
        "5 janela(s) fechada(s)" in saida and alheias and linhas() == [990404, *alheias], f"{len(set(alheias) - set(linhas()))} de {len(alheias)} linhas sumiram; saída: {saida}")
terminal.clear()
confere("no fim não sobra nada no registro nem no cache", registro() == [] and list(so.CACHE.iterdir()) == [], str(list(so.CACHE.iterdir())))

trilha = {"sessao": "filho-1", "titulo": "A · motor", "pasta": Path("/tmp/projeto"), "worktree": "a-motor"}
terminais.anotar_linhagem(trilha, terminais.MEU_PERFIL)
terminais.anotar_linhagem({**trilha, "sessao": "filho-2", "titulo": "B · tela", "worktree": None}, terminais.MEU_PERFIL)
anotadas = [json.loads(l) for l in terminais.LINHAGEM.read_text(encoding="utf-8").splitlines()]
confere("a linhagem guarda quem abriu cada janela, uma linha por janela",
        [(x["filho"], x["pai"], x["titulo"], x["worktree"]) for x in anotadas]
        == [("filho-1", "sessao-teste", "A · motor", "a-motor"), ("filho-2", "sessao-teste", "B · tela", None)], str(anotadas))
# --- dentro do Cory: cada trilha abre como terminal dele -------------------------------------------
# O Cory é o de mentira (cory_falso.py), mas o terminal roda de verdade: o sh, o zsh de login, o caffeinate
# e um claude de mentira que chama os hooks do --settings. O zsh lê uma pasta de inicialização vazia, não
# o .zshrc do dono. Janela do Terminal aqui é a de mentira: o abrir dela só anota.
import re, shlex, signal, socket, time
from cory_falso import CoryFalso
terminal.clear(); registro()
projeto = raiz / "projeto do cory"; projeto.mkdir(); projeto = projeto.resolve()   # a skill resolve a pasta (/var é link)
(raiz / "zdotdir").mkdir()
claude_falso = raiz / "claude-falso"
claude_falso.write_text(f"#!{sys.executable}\n" + """
import json, os, socket, subprocess, sys, time
a = sys.argv[1:]
sid = a[a.index("--session-id") + 1]
hooks = json.load(open(a[a.index("--settings") + 1], encoding="utf-8"))["hooks"]
def hook(nome):
    for h in hooks[nome][0]["hooks"]:
        subprocess.run(h["command"], shell=True)
saida = RAIZ + "/saida-" + sid + ".json"
with open(saida + ".novo", "w", encoding="utf-8") as f:
    json.dump({"argv": a, "cwd": os.getcwd(), "env": {k: v for k, v in os.environ.items()
               if k.startswith(("CLAUDE", "TERMINAL_CLAUDE", "CORY", "AI_AGENT"))}}, f, ensure_ascii=False)
os.replace(saida + ".novo", saida)
hook("SessionStart")
if "servidor" in a[-1]:
    s = socket.socket(); s.bind(("127.0.0.1", 0)); s.listen()
    open(RAIZ + "/porta-" + sid, "w").write(str(s.getsockname()[1]))
if "termina" in a[-1]:
    time.sleep(0.5); hook("Stop")
time.sleep(120)
""".replace("RAIZ", repr(str(raiz))), encoding="utf-8")
claude_falso.chmod(0o755)

no_terminal, planos = [], []
def abrir_no_terminal(t, base, cfg, args, destino):
    jid = 70001 + len(no_terminal); no_terminal.append(t["titulo"]); terminal[jid] = f"/dev/ttys{jid}"
    return jid, f"/dev/ttys{jid}"
so.abrir, so.ativar, so.achar_claude = abrir_no_terminal, (lambda ids: None), (lambda: str(claude_falso))
terminais.organizar.plano_novas = lambda n, monitor=None: (planos.append(n), ([(0, 0, 9, 9)] * n, {}, ["Notebook"] * n, []))[1]
terminais.organizar.aplicar = lambda plano, trazer=False: None
terminais.extras_do_workspace = lambda pasta: []

log = open(raiz / "cory.log", "w")
def arvore(pid):
    ps = subprocess.run(["ps", "-axo", "pid=,ppid="], capture_output=True, text=True).stdout
    pai, nos = {int(c[0]): int(c[1]) for c in (l.split() for l in ps.splitlines())}, {pid}
    while novos := {p for p, pp in pai.items() if pp in nos} - nos: nos |= novos
    return nos
def rodar_no_cory(tid, corpo):
    # Como o Cory: o ambiente dele sem as CLAUDE*, o endereço da API com a conversa dona do terminal, e o env
    # do pedido por cima.
    env = {k: v for k, v in os.environ.items() if not k.startswith(("CLAUDE", "CORY"))}
    env.update(CORY_TERMINAIS=cory.url, CORY_TERMINAIS_TOKEN=cory.token, **({"CORY_CONVERSA": corpo["conversa"]} if corpo.get("conversa") else {}))
    env.update(corpo.get("env") or {}, ZDOTDIR=str(raiz / "zdotdir"))
    return subprocess.Popen(corpo["comando"], cwd=corpo["pasta"], env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log)
def matar_no_cory(p):
    for pid in arvore(p.pid):
        with contextlib.suppress(OSError): os.kill(pid, signal.SIGKILL)
    p.wait()
def novo_cory(**k):
    return CoryFalso(rodar_no_cory, lambda p: p.poll() is None, matar_no_cory, **k)
def esperar_que(cond, segundos=15):
    fim_ = time.time() + segundos
    while time.time() < fim_:
        if cond(): return True
        time.sleep(0.1)
    return False
def porta_aberta(porta):
    with socket.socket() as s: return s.connect_ex(("127.0.0.1", porta)) == 0
def trilhas(*pares):
    arq = raiz / "lote.json"
    arq.write_text(json.dumps([{"titulo": t, "prompt": p} for t, p in pares], ensure_ascii=False), encoding="utf-8")
    return str(arq)
def no_cory(cory, token=None, conversa="conversa-7"):
    os.environ.update(CORY_TERMINAIS=cory.url, CORY_TERMINAIS_TOKEN=token or cory.token, CORY_CONVERSA=conversa)
def fora_do_cory():
    for k in ("CORY_TERMINAIS", "CORY_TERMINAIS_TOKEN", "CORY_CONVERSA"): os.environ.pop(k, None)
# A linha que o Cory procura na saída do abrir (src/main/motor/blocos.ts, JANELA).
JANELA = re.compile(r"^Janela \d+ · (.+?) · ((?:~|/|[A-Za-z]:[\\/])[^\n]*?)(?= · |$)", re.M)

cory = novo_cory()
fora_do_cory()
saida = roda("abrir", str(projeto), "--prompt", "fora do cory")
confere("sem CORY_TERMINAIS nada muda: janela do Terminal, na grade, e nenhum pedido ao Cory",
        no_terminal == ["projeto do cory"] and planos == [1] and not cory.pedidos and "terminal do Cory" not in saida, saida)
terminal.clear(); registro(); no_terminal.clear(); planos.clear()

no_cory(cory)
saida = roda("abrir", str(projeto), "--lote", trilhas(("A · termina", "faz e termina"), ("B · servidor", "sobe um servidor")), "--monitor", "vertical")
posts, tids = cory.de("POST"), list(cory.terminais)
confere("com CORY_TERMINAIS cada trilha abre como terminal do Cory, sem janela do Terminal nem grade",
        len(posts) == 2 and no_terminal == [] and planos == [], saida)
confere("e a saída diz que grade e --monitor não valem dentro do Cory", "Grade e --monitor não valem aqui" in saida, saida)
confere("o token vai no cabeçalho de todo pedido", cory.pedidos and all(p[2] == f"Bearer {cory.token}" for p in cory.pedidos), str(cory.pedidos))
confere("o POST leva o título, a pasta e a conversa de cada trilha",
        [(p[3]["titulo"], p[3]["pasta"], p[3].get("conversa")) for p in posts] == [("A · termina", str(projeto), "conversa-7"), ("B · servidor", str(projeto), "conversa-7")], str(posts))
reg = [l.split("\t") for l in so.REGISTRO.read_text(encoding="utf-8").splitlines()]
procs = [cory.terminais[t]["processo"] for t in tids]
confere("o registro marca cada uma com cory:<id> e usa o pid do terminal como id",
        [c[1] for c in reg] == [f"cory:{t}" for t in tids] and [int(c[0]) for c in reg] == [p.pid for p in procs], str(reg))
cmd = posts[0][3]["comando"] if posts else ["", "", ""]
sessoes = [x["filho"] for x in [json.loads(l) for l in terminais.LINHAGEM.read_text(encoding="utf-8").splitlines()][-2:]]
confere("o comando leva à vista o --session-id da trilha, que é onde o Cory procura a sessão do terminal",
        [p[3]["comando"][3:] for p in posts] == [["terminal-claude", "--session-id", s] for s in sessoes], str(posts))
confere("o comando é o lancador da janela (o .sh), num zsh de login, com o pid gravado antes",
        cmd[:2] == ["/bin/sh", "-c"] and cmd[2].startswith(f"echo $$ > {shlex.quote(reg[0][5] + '.pid')}; exec /bin/zsh -l -i -c ")
        and reg[0][5] + ".sh" in cmd[2] and Path(reg[0][5] + ".sh").read_text() == so.lancador(
            {"pasta": projeto, "prompt": "x", "titulo": "A · termina"}, reg[0][5], terminais.MEU_PERFIL, json.loads(Path(reg[0][5] + ".json").read_text())["args"]), str(cmd))
confere("a linha de cada uma é a que o Cory reconhece (Janela <número> · título · pasta)",
        JANELA.findall(saida) == [("A · termina", str(projeto)), ("B · servidor", str(projeto))], saida)
anotadas = [json.loads(l) for l in terminais.LINHAGEM.read_text(encoding="utf-8").splitlines()][-2:]
confere("a linhagem anota as duas com a conversa que abriu e o terminal do Cory",
        [(x["titulo"], x["pai"], x.get("cory")) for x in anotadas] == [("A · termina", "sessao-teste", tids[0]), ("B · servidor", "sessao-teste", tids[1])], str(anotadas))
esperar_que(lambda: len(list(raiz.glob("saida-*.json"))) == 2)
rodou = {j["argv"][j["argv"].index("--name") + 1]: j for j in (json.loads(f.read_text(encoding="utf-8")) for f in raiz.glob("saida-*.json"))}
a = rodou.get("A · termina", {"argv": ["--settings", ""], "env": {}, "cwd": ""})
confere("o claude da trilha rodou no terminal, em bypass, com os hooks e o prompt",
        "--dangerously-skip-permissions" in a["argv"] and a["argv"][a["argv"].index("--settings") + 1] == str(so.CACHE / "hooks.json") and a["argv"][-1] == "faz e termina", str(a))
confere("na pasta da trilha e com o arquivo de estado dos hooks",
        os.path.realpath(a["cwd"]) == os.path.realpath(projeto) and a["env"].get("TERMINAL_CLAUDE_ESTADO") == reg[0][5] + ".estado", str(a))
confere("e leva o Cory adiante com a conversa da própria trilha (a que ela abrir fica embaixo dela, não da avó)",
        a["env"].get("CORY_TERMINAIS") == cory.url and a["env"].get("CORY_TERMINAIS_TOKEN") == cory.token
        and a["env"].get("CORY_CONVERSA") == a["argv"][a["argv"].index("--session-id") + 1] != "conversa-7", str(a["env"]))

saida = roda("esperar", "--minutos", "1")
confere("o esperar volta quando a trilha do Cory para, pelo hook Stop dela", f"A janela {reg[0][0]} (A · termina) parou" in saida and "Ainda há janela trabalhando (1)" in saida, saida)
st = roda("status")
confere("o status mostra as duas pelos hooks: uma parada e a outra trabalhando", f"{reg[0][0]}  ✅ parada" in st and f"{reg[1][0]}  ⏳ trabalhando" in st, st)
saida = roda("ver", reg[0][0])
confere("o ver de trilha do Cory não pede a tela ao Terminal", saida.startswith("A · termina · parada") and "tela de mentira" not in saida and "ainda não gravou" in saida, saida)

esperar_que(lambda: list(raiz.glob("porta-*")))
porta = int(next(raiz.glob("porta-*")).read_text())
saida = fecha()
deletes = cory.de("DELETE")
confere("o fechar tira a aba pelo DELETE, com o token, e a que segura servidor fica",
        [(d[1], d[2]) for d in deletes] == [(f"/terminais/{tids[0]}", f"Bearer {cory.token}")] and f"janela {reg[1][0]} (terminal do Cory): segura servidor na porta {porta}" in saida, saida)
confere("a que fechou acabou e saiu do registro; a do servidor continua", procs[0].poll() is not None and registro() == [procs[1].pid], f"{registro()} {saida}")
saida = fecha(procs[1].pid, "--forcar")
confere("com --forcar fecha derrubando o servidor junto", procs[1].poll() is not None and not porta_aberta(porta) and registro() == [] and f"janela {reg[1][0]} fechada" in saida, saida)

roda("abrir", str(projeto), "--prompt", "fica")
tid = next(iter(cory.terminais)); p = cory.terminais[tid]["processo"]
confere("aberta no Cory, a trilha está no registro", registro() == [p.pid], str(registro()))
cory.fechar_aba(tid)
confere("aba fechada à mão no Cory sai do registro, mesmo com o Cory ainda listando o terminal (vivo falso)",
        registro() == [] and tid in cory.terminais, str(registro()))
del cory.terminais[tid]

roda("abrir", str(projeto), "--prompt", "fica")
tid, p = next((i, t["processo"]) for i, t in cory.terminais.items())
terminal[p.pid] = "/dev/ttys990"   # uma janela do Terminal que, por acaso, tem o mesmo número
saida = direto(p.pid)
confere("o fechar-terminal.sh pelo nome não fecha nada com o id de um terminal do Cory",
        "é um terminal do Cory" in saida and p.pid in abertas() and p.poll() is None, saida)
terminal.pop(p.pid)
# Os arquivos de cada janela levam o segundo e o pid de quem abriu: duas chamadas do mesmo processo no mesmo
# segundo dariam o mesmo nome (fora do teste cada abrir é um processo).
time.sleep(1)
fora_do_cory(); roda("abrir", str(projeto), "--prompt", "no terminal"); no_cory(cory)
saida = fecha()
confere("o fechar sem ids fecha as duas desta sessão: a do Cory pelo DELETE e a do Terminal pelo script",
        f"janela {p.pid} fechada" in saida and "janela 70001 fechada" in saida and cory.de("DELETE")[-1][1] == f"/terminais/{tid}"
        and p.poll() is not None and abertas() == [] and registro() == [], saida)

roda("abrir", str(projeto), "--prompt", "fica")
p = next(iter(cory.terminais.values()))["processo"]
cory.desligar()
st = roda("status")
confere("com o Cory fora do ar o registro segura a trilha pelo processo dela", registro() == [p.pid] and st.startswith(f"{p.pid}  "), f"{registro()} {st}")
saida = fecha()
confere("e o fechar, sem o Cory, encerra o processo dela", "o Cory não respondeu" in saida and "encerrei o processo dela" in saida
        and esperar_que(lambda: p.poll() is not None) and registro() == [], saida)

livre = socket.socket(); livre.bind(("127.0.0.1", 0)); porta_livre = livre.getsockname()[1]; livre.close()
no_terminal.clear(); planos.clear()
os.environ["CORY_TERMINAIS"] = f"http://127.0.0.1:{porta_livre}"
saida = roda("abrir", str(projeto), "--prompt", "x")
confere("Cory fora do ar na hora de abrir: avisa e abre no Terminal de sempre",
        "Aviso: esta sessão roda dentro do Cory, mas o Cory não respondeu" in saida and no_terminal == ["projeto do cory"] and planos == [1], saida)
terminal.clear(); registro(); no_terminal.clear(); planos.clear()

cory = novo_cory(token="token-novo")
no_cory(cory, token="token-velho")
saida = roda("abrir", str(projeto), "--prompt", "x")
confere("token recusado: avisa e abre no Terminal de sempre", "o Cory recusou o token" in saida and no_terminal == ["projeto do cory"]
        and cory.pedidos and cory.pedidos[0][2] == "Bearer token-velho" and not cory.de("POST"), saida)
terminal.clear(); registro(); no_terminal.clear(); planos.clear()

no_cory(cory); cory.recusar_post = True
saida = roda("abrir", str(projeto), "--lote", trilhas(("A · um", "x"), ("B · dois", "y")))
confere("Cory que recusa o POST: avisa, e a trilha e as que faltam abrem no Terminal, na grade",
        "o Cory respondeu 400 a POST /terminais" in saida and no_terminal == ["A · um", "B · dois"] and planos == [2] and len(cory.de("POST")) == 1, saida)
terminal.clear(); registro(); cory.recusar_post = False; cory.pedidos.clear()

saida = roda("abrir", str(projeto), "--prompt", "x", "--dry-run")
confere("o --dry-run diz que a trilha iria para o Cory e não abre nada", "[simulação] projeto do cory · " in saida and " · terminal do Cory" in saida and not cory.de("POST"), saida)
cory.desligar(); fora_do_cory()
confere("no fim do Cory não sobra nada no registro", registro() == [], str(registro()))
fim()
