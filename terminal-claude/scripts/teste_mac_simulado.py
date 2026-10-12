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
    """O `terminais.py fechar`. O script escreve direto na saída do processo: é lá que se pega."""
    with tempfile.TemporaryFile() as f:
        sys.stdout.flush()
        guardada = os.dup(1); os.dup2(f.fileno(), 1)
        try: roda("fechar", *map(str, ids))
        finally: os.dup2(guardada, 1); os.close(guardada)
        f.seek(0)
        return f.read().decode()

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
fim()
