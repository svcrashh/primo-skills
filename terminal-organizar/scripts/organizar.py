#!/usr/bin/env python3
"""Organiza as janelas do Terminal.app em grade: cada monitor vira uma grade de quadrados.

Uso: organizar.py [--monitor notebook|externo|horizontal|vertical] [--dry-run]

Sem --monitor, cada janela fica no monitor onde está e só se encaixa na grade dele; o que não
couber num monitor vai para outro com espaço. Com --monitor, leva todas para lá.
O terminais.py do terminal-claude importa este módulo e usa plano_novas(), para as janelas novas já
nascerem no lugar.
Um só arquivo para os três perfis: ~/.claude, ~/.claude-devin (via link) e ~/.claude-insiders.
Vale no Mac (Terminal.app) e no Windows (Windows Terminal): a grade é a mesma, e só ler as telas,
ler as janelas e movê-las muda de um para o outro (as versões do Windows estão antes do main).
"""
import math
import subprocess
import sys
from collections import namedtuple

# Grade = colunas × fileiras, de 1 a LADO_MAX cada. Vale a com menos quadrados que caiba as janelas,
# entre as que deixam a célula legível pro Claude e com cara de janela de terminal (largura/altura
# entre metade e o dobro de PROPORCAO); no empate, a de formato mais perto de PROPORCAO. Serve igual
# para monitor deitado e em pé: no vertical 1080×1920 sai 1×4, depois 2×3, 2×4 e 2×5.
LADO_MAX = 8
LARGURA_MIN, ALTURA_MIN = 500, 340
# O notebook é a menor tela das duas mesas e, com o mínimo geral, trava em 2×2 — a grade 3×2 daria
# célula de 490 pt e reprovava por 10. Com mínimo próprio ele segue apertando conforme enche, até
# 4×3. Não encolhe janela à toa: com 4 abertas continua em 2×2; a grade só aperta quando precisa.
MIN_POR_TELA = {"notebook": (360, 230)}
PROPORCAO = 1.4
# A primeira janela já nasce num quadrado, não na tela inteira.
MIN_QUADRADOS = 4
# Respiro vertical acima, entre as fileiras e embaixo. No notebook em 3×2 dá janelas de 76×30.
ESPACO = 20
# Onde nasce a primeira janela quando não há nenhuma aberta.
MONITOR_PADRAO = "notebook"
APELIDOS = {
    "notebook": "notebook", "macbook": "notebook", "mac": "notebook", "integrada": "notebook",
    "embutida": "notebook", "externo": "externo", "monitor": "externo", "grande": "externo",
    "horizontal": "horizontal", "deitado": "horizontal", "vertical": "vertical", "em pé": "vertical",
}
FILTROS = {
    "notebook": lambda t: t.embutida,
    "externo": lambda t: not t.embutida,
    "horizontal": lambda t: not t.embutida and t.w >= t.h,
    "vertical": lambda t: not t.embutida and t.h > t.w,
}

Tela = namedtuple("Tela", "nome embutida l t w h altura_principal")
Janela = namedtuple("Janela", "id l t r b")

# Área útil (sem barra de menu e Dock) em coordenadas do "bounds" do Terminal: origem no canto
# superior esquerdo do monitor principal, y crescendo para baixo. Só que o Terminal grava "bounds"
# relativo ao monitor onde a janela está (num notebook mais baixo que o principal, ela desce a
# diferença de altura), então a gravação usa "frame", que é global e com y para cima.
TELAS_JS = """
ObjC.import('AppKit'); ObjC.import('CoreGraphics');
const t = $.NSScreen.screens, p = t.objectAtIndex(0), alturaPrincipal = p.frame.size.height, out = [];
const menu = alturaPrincipal - p.visibleFrame.origin.y - p.visibleFrame.size.height;
for (let i = 0; i < t.count; i++) {
  const s = t.objectAtIndex(i), v = s.visibleFrame, f = s.frame;
  const id = s.deviceDescription.objectForKey('NSScreenNumber').unsignedIntValue;
  // Há monitor (o vertical do segundo setup) que informa a área útil sem descontar a barra de
  // menu, mas o macOS não deixa a janela subir nela: desconta a mesma altura do principal.
  let topo = v.origin.y + v.size.height;
  if (topo >= f.origin.y + f.size.height) topo = f.origin.y + f.size.height - menu;
  out.push([$.CGDisplayIsBuiltin(id) ? 1 : 0, v.origin.x, alturaPrincipal - topo,
            v.size.width, topo - v.origin.y, alturaPrincipal].join(' '));
}
out.join('\\n');
"""

JANELAS_AS = """
tell application "Terminal"
  set linhas to {}
  repeat with w in windows
    try
      if visible of w and not miniaturized of w then
        set b to bounds of w
        set end of linhas to ((id of w) as text) & " " & (item 1 of b) & " " & (item 2 of b) & " " & (item 3 of b) & " " & (item 4 of b)
      end if
    end try
  end repeat
end tell
set text item delimiters to linefeed
return linhas as text
"""


def osascript(*args):
    return subprocess.run(["osascript", *args], capture_output=True, text=True, check=True).stdout


def ler_telas():
    brutas = [l.split() for l in osascript("-l", "JavaScript", "-e", TELAS_JS).split("\n") if l.strip()]
    return nomear([Tela("", b[0] == "1", *(round(float(x)) for x in b[1:])) for b in brutas])


def nomear(telas):
    nomes = ["Notebook" if t.embutida else "Monitor vertical" if t.h > t.w else "Monitor horizontal"
             for t in telas]
    vistos = {}
    for i, nome in enumerate(nomes):
        if nomes.count(nome) > 1:
            vistos[nome] = vistos.get(nome, 0) + 1
            nomes[i] = f"{nome} {vistos[nome]}"
    return [t._replace(nome=n) for t, n in zip(telas, nomes)]


def ler_janelas():
    # Sem o Terminal aberto não chama o AppleScript: um "tell" poderia abrir o app com o ambiente
    # desta sessão, que é o que o terminais.py evita.
    if subprocess.run(["pgrep", "-xq", "Terminal"]).returncode != 0:
        return []
    return [Janela(int(p[0]), *map(int, p[1:])) for p in
            (l.split() for l in osascript("-e", JANELAS_AS).split("\n") if l.strip())]


def centro(j):
    return (j.l + j.r) / 2, (j.t + j.b) / 2


def tela_de(j, telas):
    cx, cy = centro(j)

    def distancia(t):
        dx = max(t.l - cx, 0, cx - (t.l + t.w))
        dy = max(t.t - cy, 0, cy - (t.t + t.h))
        return dx * dx + dy * dy

    return min(range(len(telas)), key=lambda i: distancia(telas[i]))


def altura_da_fileira(t, rows):
    return (t.h - (rows + 1) * ESPACO) / rows


TODAS = [(c, r) for c in range(1, LADO_MAX + 1) for r in range(1, LADO_MAX + 1)]


def forma(t, g):
    return abs(math.log(t.w / g[0] / max(altura_da_fileira(t, g[1]), 1) / PROPORCAO))


def minimos(t):
    return MIN_POR_TELA.get("notebook" if t.embutida else "", (LARGURA_MIN, ALTURA_MIN))


def cabe(t, g):
    lmin, amin = minimos(t)
    return (t.w / g[0] >= lmin and altura_da_fileira(t, g[1]) >= amin
            and forma(t, g) <= math.log(2))


def boas(t):
    cabem = [g for g in TODAS if cabe(t, g)]
    return [g for g in cabem if g[0] * g[1] >= MIN_QUADRADOS] or cabem or [(2, 2)]


def capacidade(t):
    return max(c * r for c, r in boas(t))


def grade(t, n):
    ok = [g for g in boas(t) if g[0] * g[1] >= n]
    if ok:
        return min(ok, key=lambda g: (g[0] * g[1], forma(t, g)))
    # Passou da capacidade (não há outro monitor com vaga): a grade que menos aperta a célula.
    def aperto(g):
        lmin, amin = minimos(t)
        return min(t.w / g[0] / lmin, altura_da_fileira(t, g[1]) / amin)
    return min((g for g in TODAS if g[0] * g[1] >= n), key=lambda g: (-aperto(g), g[0] * g[1]))


def celulas(t, g):
    cols, rows = g
    xs = [round(t.l + t.w * i / cols) for i in range(cols + 1)]
    h = altura_da_fileira(t, rows)
    ys = [round(t.t + ESPACO + r * (h + ESPACO)) for r in range(rows)]
    return [(xs[c], ys[r], xs[c + 1], ys[r] + round(h)) for r in range(rows) for c in range(cols)]


def para_frame(t, c):
    l, top, r, b = c
    return l, t.altura_principal - b, r, t.altura_principal - top


def indice(j, t, g):
    cx, cy = centro(j)
    c = min(max(int((cx - t.l) * g[0] / t.w), 0), g[0] - 1)
    r = min(max(int((cy - t.t) * g[1] / t.h), 0), g[1] - 1)
    return r * g[0] + c


def em_ordem(js, t):
    g = grade(t, len(js))
    return sorted(js, key=lambda j: (indice(j, t, g) // g[0], centro(j)[0]))


def encaixar(t, ficam, chegam):
    """Quadrado de cada janela. Se a grade não muda, as que já estão na tela mantêm o quadrado."""
    g, antes = grade(t, len(ficam) + len(chegam)), grade(t, len(ficam))
    cel = celulas(t, g)
    livres, posto = list(range(len(cel))), {}
    ficam = em_ordem(ficam, t)
    if g == antes:
        for j in ficam:
            i = indice(j, t, g)
            if i in livres:
                posto[j.id] = i
                livres.remove(i)
    for j in [j for j in ficam if j.id not in posto] + chegam:
        posto[j.id] = livres.pop(0)
    return g, {jid: para_frame(t, cel[i]) for jid, i in posto.items()}, posto


def resolver(nome, telas):
    tipo = APELIDOS.get(nome.lower())
    if tipo is None:
        sys.exit(f"Monitor desconhecido: {nome}. Use notebook, externo, horizontal ou vertical.")
    cands = [i for i, t in enumerate(telas) if FILTROS[tipo](t)]
    return max(cands, key=lambda i: telas[i].w * telas[i].h) if cands else None


def agrupar(janelas, telas):
    por = [[] for _ in telas]
    for j in janelas:
        por[tela_de(j, telas)].append(j)
    return por


def maior(telas):
    return max(range(len(telas)), key=lambda i: telas[i].w * telas[i].h)


def escolher(telas, por, monitor, avisos):
    folga = [capacidade(t) - len(por[i]) for i, t in enumerate(telas)]
    pedido = resolver(monitor, telas) if monitor else None
    if monitor and pedido is None:
        avisos.append(f"Não achei o monitor '{monitor}' ligado; escolhi sozinho.")
    if pedido is not None:
        if folga[pedido] > 0:
            return pedido
        avisos.append(f"{telas[pedido].nome} está cheio ({len(por[pedido])} janelas); fui pro outro.")
    elif not any(por):
        padrao = resolver(MONITOR_PADRAO, telas)
        return padrao if padrao is not None else 0
    else:
        com_janela = [i for i in range(len(telas)) if por[i] and folga[i] > 0]
        if com_janela:
            return max(com_janela, key=lambda i: len(por[i]))
    com_vaga = [i for i in range(len(telas)) if folga[i] > 0]
    return max(com_vaga, key=lambda i: folga[i]) if com_vaga else maior(telas)


def plano_novas(n, monitor=None):
    """Quadrados de n janelas que ainda vão abrir, planejados de uma vez.

    Devolve (frame de cada nova, frame das outras janelas dos monitores mexidos, descrição de cada
    nova, avisos). Enche um monitor e só então passa para o próximo com vaga.
    """
    telas, avisos = ler_telas(), []
    por = agrupar(ler_janelas(), telas)
    novas = [Janela(f"nova{k}", 0, 0, 0, 0) for k in range(n)]
    chegam = [[] for _ in telas]
    for nova in novas:
        ocupadas = [por[i] + chegam[i] for i in range(len(telas))]
        chegam[escolher(telas, ocupadas, monitor, avisos)].append(nova)
    destinos, outras, descs = {}, {}, {}
    for i, t in enumerate(telas):
        if not chegam[i]:
            continue
        g, plano, posto = encaixar(t, por[i], chegam[i])
        for nova in chegam[i]:
            destinos[nova.id] = plano.pop(nova.id)
            descs[nova.id] = f"{t.nome}, quadrado {posto[nova.id] + 1} de {g[0] * g[1]} (grade {g[0]}×{g[1]})"
        outras.update(plano)
    return ([destinos[j.id] for j in novas], outras, [descs[j.id] for j in novas],
            list(dict.fromkeys(avisos)))


def plano_tudo(monitor=None):
    telas, avisos = ler_telas(), []
    por = agrupar(ler_janelas(), telas)
    ficam = [em_ordem(por[i], t) for i, t in enumerate(telas)]
    chegam = [[] for _ in telas]
    alvo = resolver(monitor, telas) if monitor else None
    if monitor and alvo is None:
        avisos.append(f"Não achei o monitor '{monitor}' ligado; organizei cada um no seu.")
    if alvo is not None:
        for i in range(len(telas)):
            if i != alvo:
                chegam[alvo] += ficam[i]
                ficam[i] = []

    sobra = []
    for i, t in enumerate(telas):
        fora = (ficam[i] + chegam[i])[capacidade(t):]
        if fora:
            sobra += fora
            ficam[i] = [j for j in ficam[i] if j not in fora]
            chegam[i] = [j for j in chegam[i] if j not in fora]
    for i in sorted(range(len(telas)), key=lambda i: len(ficam[i]) + len(chegam[i]) - capacidade(telas[i])):
        while sobra and len(ficam[i]) + len(chegam[i]) < capacidade(telas[i]):
            chegam[i].append(sobra.pop(0))
    if sobra:
        chegam[maior(telas)] += sobra

    plano, linhas = {}, []
    for i, t in enumerate(telas):
        n = len(ficam[i]) + len(chegam[i])
        if not n:
            continue
        g, p, _ = encaixar(t, ficam[i], chegam[i])
        plano.update(p)
        linhas.append(f"{t.nome}: {n} janela{'s' if n > 1 else ''} na grade {g[0]}×{g[1]}")
    return plano, linhas, avisos


def aplicar(plano, trazer=False):
    if not plano:
        return
    corpo = "\n".join(f"try\nset frame of window id {jid} to {{{l}, {t}, {r}, {b}}}\nend try"
                      for jid, (l, t, r, b) in plano.items())
    if trazer:
        # Encaixada atrás do Chrome parece que não saiu do lugar.
        corpo += "\n" + "\n".join(f"try\nset index of window id {jid} to 1\nend try"
                                  for jid in reversed(list(plano))) + "\nactivate"
    osascript("-e", f'tell application "Terminal"\n{corpo}\nend tell')


if sys.platform == "win32":
    import janelas_win as win

    def ler_telas():
        # O Windows não diz qual tela é a do notebook: todas contam como monitor externo, e o
        # principal vem primeiro, que é onde nasce a primeira janela.
        principal_antes = sorted(win.monitores(), key=lambda m: not m[0])
        return nomear([Tela("", False, l, t, w, h, 0) for _, l, t, w, h in principal_antes])

    def ler_janelas():
        return [Janela(*j) for j in win.janelas()]

    def para_frame(t, c):
        return c  # no Windows a janela já se posiciona nas coordenadas da grade

    def aplicar(plano, trazer=False):
        for jid, (l, t, r, b) in plano.items():
            win.mover(jid, l, t, r, b, trazer)


def main():
    for saida in (sys.stdout, sys.stderr):
        saida.reconfigure(encoding="utf-8")  # no Windows o padrão não tem "×" nem acento
    argv = sys.argv[1:]
    dry = "--dry-run" in argv
    monitor = argv[argv.index("--monitor") + 1] if "--monitor" in argv else None

    plano, linhas, avisos = plano_tudo(monitor)
    if not plano:
        print("Nenhuma janela do Terminal aberta.")
        return
    if dry:
        for jid, b in plano.items():
            print(f"  janela {jid} → frame {b}")
    else:
        aplicar(plano, trazer=True)
    print("\n".join(avisos + linhas))


if __name__ == "__main__":
    main()
