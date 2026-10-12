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

shutil.rmtree(raiz, ignore_errors=True)
sys.exit(f"\n{len(falhas)} FALHA(S): {'; '.join(falhas)}" if falhas else print("\nTUDO OK"))
