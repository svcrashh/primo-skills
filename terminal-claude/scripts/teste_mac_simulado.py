#!/usr/bin/env python3
"""Exercita o registro do terminal-claude no Mac com o Terminal simulado: quem responde pelas janelas
e pelos ttys são listas de mentira, e o registro e o cache vão para uma pasta temporária. Não abre
janela nem toca no registro de verdade. Rode depois de mexer em so_mac.py ou no terminais.py:

    python3 teste_mac_simulado.py
"""
import contextlib, io, json, os, shutil, sys, tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
os.environ["CLAUDE_CODE_SESSION_ID"] = "sessao-teste"
import so_mac as so, terminais

raiz = Path(tempfile.mkdtemp(prefix="simmac-"))
so.REGISTRO, so.CACHE = raiz / "registro.tsv", raiz / "cache"
so.CACHE.mkdir()

# --- Terminal de mentira ------------------------------------------------------------------
terminal = {}      # id → tty das janelas que existem de verdade
omitidas = set()   # ids que a próxima leitura do AppleScript deixa de ver, uma vez só
outras_abas = set()  # ttys de abas que não são a selecionada da janela: o AppleScript não mostra
def vivas():
    vistas = {jid: tty for jid, tty in terminal.items() if jid not in omitidas}
    omitidas.clear()
    return vistas
so.vivas = vivas
so.ttys_do_terminal = lambda: set(terminal.values()) | outras_abas
so.tela = lambda jid: "tela de mentira"

def abre(jid, tty, titulo, estado="trabalhando"):
    base = str(so.CACHE / f"janela-{jid}")
    Path(base + ".estado").write_text(estado, encoding="utf-8")
    Path(base + ".json").write_text(json.dumps({"titulo": titulo, "sessao": f"s-{jid}", "config": str(raiz / "perfil")}), encoding="utf-8")
    Path(base + ".sh").write_text("", encoding="utf-8")
    with so.REGISTRO.open("a", encoding="utf-8") as f:
        f.write("\t".join([str(jid), tty, "/tmp/projeto", "sessao-teste", "2026-10-12 02:00", base]) + "\n")
    terminal[jid] = tty
    return base

def registro():
    with terminais.trava():
        return sorted(int(c[0]) for c in terminais.registro_vivo())

def arquivos(base):
    return sorted(p.suffix for p in so.CACHE.glob(Path(base).name + ".*"))

def roda(*argv):
    buf = io.TextIOWrapper(io.BytesIO(), encoding="utf-8"); sys.argv = ["terminais.py", *argv]
    with contextlib.redirect_stdout(buf):
        try: terminais.main()
        except SystemExit as e: buf.write(f"[saiu: {e}]")
    buf.flush()
    return buf.buffer.getvalue().decode()

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

shutil.rmtree(raiz, ignore_errors=True)
sys.exit(f"\n{len(falhas)} FALHA(S): {'; '.join(falhas)}" if falhas else print("\nTUDO OK"))
