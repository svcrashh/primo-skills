#!/usr/bin/env python3
"""Abre janelas de terminal com o claude em bypass, uma por trilha, sem deixar a máquina dormir, e
acompanha. No Mac as janelas são do Terminal.app; no Windows, do Windows Terminal.

Uso: terminais.py abrir [pasta ...] [-n N] [--prompt TEXTO]... [--lote trilhas.json]
                        [--modelo M] [--esforco E] [--modo MODO] [--monitor M]
                        [--perfil P] [--worktree] [--continuar] [--dry-run]
     terminais.py status [--todas]
     terminais.py esperar [--minutos N]
     terminais.py ver <id>
     terminais.py contas
     terminais.py limpeza [pasta --feita | pasta --adiar | --nunca | --perguntar]
     terminais.py fechar [--listar] [--todas] [--forcar] [id ...]

Um só motor para os perfis ~/.claude, ~/.claude-devin (via link) e ~/.claude-insiders: a janela
nasce no perfil da sessão que chamou, ou no que o --perfil disser ("outras" reparte as janelas
entre os perfis que não são o desta sessão, pra elas gastarem das outras contas; "auto" escolhe a
conta de cada janela pelo uso de cada uma, que o `contas` mostra). O que muda de um sistema para o
outro (abrir, achar e fechar janela) está em so_mac.py e so_windows.py; aqui fica o que é igual nos dois.
"""
import argparse
import hashlib
import http.client
import json
import math
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import unicodedata
import uuid
from collections import Counter
from contextlib import contextmanager, suppress
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urlparse
from urllib.request import Request, url2pathname, urlopen

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parents[1] / "terminal-organizar/scripts"))
import organizar  # noqa: E402
if sys.platform == "win32":
    import so_windows as so
else:
    import so_mac as so

SESSAO = os.environ.get("CLAUDE_CODE_SESSION_ID", "sem-sessao")
CAMPOS = {"titulo", "prompt", "pasta", "modelo", "esforco", "worktree", "perfil"}
CASA = Path.home()
# Depois de tantos lotes ou dias de uso numa pasta, o abrir lembra de perguntar pela limpeza dos .md
# que as trilhas deixam pelo projeto. Quem responde "agora não" volta a ser perguntado em LIMPEZA_ADIA dias.
LIMPEZA_LOTES, LIMPEZA_DIAS, LIMPEZA_ADIA = 10, 14, 3
MARCAS = {"abrindo": "🕓", "trabalhando": "⏳", "parada": "✅", "pergunta": "❓", "encerrada": "⏹"}
# Quem abriu cada janela, uma linha por janela, para sempre: o registro esquece a janela que fecha, e o
# Cory (e quem mais quiser) precisa saber de qual conversa saiu cada trilha.
LINHAGEM = CASA / ".claude" / "terminal-claude" / "linhagem.jsonl"

def hook(estado):
    return [so.hook(estado)]


# Vai no --settings de cada janela: é daqui que o status sabe em que pé está cada trilha.
HOOKS = {"hooks": {
    # A janela nasce "abrindo" e só sai disso aqui: presa na tela de confiar na pasta, fica nele.
    # "inicio" grava "trabalhando" na janela que nasceu com prompt e "parada" na que nasceu vazia: se
    # passasse por "parada" antes do prompt entrar, o esperar podia voltar cedo demais.
    "SessionStart": [{"matcher": "startup|resume", "hooks": hook("inicio")}],
    "UserPromptSubmit": [{"hooks": hook("trabalhando")}],
    "Stop": [{"hooks": hook("parada")}],
    "PreToolUse": [{"matcher": "AskUserQuestion", "hooks": hook("pergunta")}],
    "PostToolUse": [{"matcher": "AskUserQuestion", "hooks": hook("trabalhando")}],
}}


def uri_to_path(uri):
    u = urlparse(uri)
    return Path(url2pathname(unquote(u.path))).resolve() if u.scheme == "file" else None


def read_jsonc(path):
    text = path.read_text(encoding="utf-8")
    # tira comentários (sem mexer em string) e vírgula sobrando: .code-workspace é JSONC
    text = re.sub(r'("(?:\\.|[^"\\])*")|//[^\n]*|/\*.*?\*/', lambda m: m.group(1) or "", text, flags=re.S)
    return json.loads(re.sub(r",(\s*[}\]])", r"\1", text))


def workspace_folders(ws_file):
    folders = []
    for f in read_jsonc(ws_file).get("folders", []):
        if "path" in f:
            p = Path(os.path.expanduser(f["path"]))
            folders.append((p if p.is_absolute() else ws_file.parent / p).resolve())
        elif "uri" in f and (p := uri_to_path(f["uri"])):
            folders.append(p)
    return folders


def inside(child, parent):
    return child == parent or parent in child.parents


def pastas_do_workspace(pasta):
    """Pastas da janela do VS Code mais recente que contém a pasta (só ela, se não achar)."""
    melhor = None
    for storage in so.STORAGES:
        if not storage.is_dir():
            continue
        for entry in storage.iterdir():
            meta = entry / "workspace.json"
            if not meta.is_file():
                continue
            try:
                info = json.loads(meta.read_text(encoding="utf-8"))
                if "folder" in info:
                    p = uri_to_path(info["folder"])
                    folders = [p] if p else []
                else:
                    ws_file = uri_to_path(info.get("workspace", ""))
                    if not ws_file or not ws_file.is_file():
                        continue
                    folders = workspace_folders(ws_file)
            except (OSError, ValueError):
                continue
            if not any(inside(pasta, f) for f in folders):
                continue
            state = entry / "state.vscdb"
            mtime = (state if state.exists() else entry).stat().st_mtime
            if not melhor or mtime > melhor[0]:
                melhor = (mtime, folders)
    return melhor[1] if melhor else [pasta]


def extras_do_workspace(pasta):
    extras = []
    for f in pastas_do_workspace(pasta):
        if not (inside(pasta, f) or inside(f, pasta) or f in extras) and f.is_dir():
            extras.append(f)
    return extras


@contextmanager
def trava():
    """Uma chamada por vez: duas ao mesmo tempo planejariam o mesmo quadrado."""
    with open(f"{so.REGISTRO}.lock", "w") as f:
        so.travar(f)
        yield


def registro_vivo():
    """Linhas do registro cujas janelas ainda existem; tira as outras do arquivo e do cache."""
    abertas, vistos = so.vivas(), {}
    antes = so.REGISTRO.read_text(encoding="utf-8") if so.REGISTRO.exists() else ""
    linhas = [c for c in (linha.split("\t") for linha in antes.splitlines())
              if len(c) >= 6 and c[0].isdigit() and (cory_viva(c, vistos) if do_cory(c) else so.viva(abertas, c))]
    agora = "".join("\t".join(c) + "\n" for c in linhas)
    if agora != antes:
        # Troca o arquivo de uma vez: o fechar-terminal.sh lê sem a trava e, pego no meio de uma
        # escrita, não acharia as janelas da sessão.
        novo = Path(f"{so.REGISTRO}.novo")
        novo.write_text(agora, encoding="utf-8")
        os.replace(novo, so.REGISTRO)
    donos = {c[5] for c in linhas}
    if so.CACHE.is_dir():
        for f in so.CACHE.iterdir():
            if f.name not in ("hooks.json", "uso.json", "contas.json") and str(f.with_suffix("")) not in donos:
                f.unlink()
    return linhas


def slug(texto):
    ascii_ = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_).strip("-")


def mesmo_perfil(a, b):
    return a == b or bool(a and b and Path(a).resolve() == Path(b).resolve())


def normalizar_perfil(cfg):
    """O ~/.claude vira None: a janela dele vai sem CLAUDE_CONFIG_DIR (veja o lancador)."""
    cfg = cfg and os.path.expanduser(cfg)
    return None if not cfg or mesmo_perfil(cfg, str(CASA / ".claude")) else cfg


MEU_PERFIL = normalizar_perfil(os.environ.get("CLAUDE_CONFIG_DIR"))


def perfis():
    """O ~/.claude (None) e cada ~/.claude-* que o claude já usou (tem .claude.json dentro)."""
    return [None, *sorted(str(p) for p in CASA.glob(".claude-*") if (p / ".claude.json").is_file())]


def nome_do_perfil(cfg):
    return "padrão (~/.claude)" if not cfg else cfg.replace(str(CASA), "~", 1)


def expandir_perfis(texto):
    """"devin", "insiders,padrao", "~/.claude-x" ou "outras" → pastas de config, na ordem do rodízio."""
    lista = []
    for nome in (n.strip() for n in texto.split(",") if n.strip()):
        if nome == "outras":
            outras = [p for p in perfis() if not mesmo_perfil(p, MEU_PERFIL)]
            if not outras:
                sys.exit(f"Não há outro perfil nesta máquina além do desta sessão ({nome_do_perfil(MEU_PERFIL)}). "
                         "Cria um com  CLAUDE_CONFIG_DIR=~/.claude-<nome> claude  e faz login na outra conta.")
            lista += outras
            continue
        if nome.lower() in ("padrao", "padrão", "claude"):
            lista.append(None)
            continue
        p = Path(os.path.expanduser(nome)) if any(c in nome for c in "/\\~") else \
            CASA / (nome if nome.startswith(".claude") else f".claude-{nome}")
        if not p.is_dir():
            sys.exit(f"Perfil não existe: {p}. Valem: auto, outras, padrao, "
                     + ", ".join(Path(c).name[len(".claude-"):] for c in perfis() if c) + ".")
        lista.append(normalizar_perfil(str(p)))
    return lista


# --perfil auto, a regra que o dono pediu em 24/10/2026: entre as contas abaixo do TETO na semana e na
# sessão de 5 h, primeiro a que zera a semana mais cedo, porque o que sobrar dela até lá se perde; a que
# acabou de zerar fica por último. GASTO_* é um palpite do que uma janela gasta, pra um lote não ir todo
# para a conta que está quase no teto: com 66% da semana cabem duas janelas (71% e 76%) e a terceira,
# que passaria de 80%, vai para a próxima da fila.
TETO, GASTO_SEMANA, GASTO_SESSAO = 80, 5, 15
AUTO = object()
# O Cory, o app do dono, lê o uso das contas a cada 3 min e grava aqui; o que a API deu nas chamadas
# daqui fica em contas.json no cache. Vale o mais novo dos dois. Mais velho que USO_FRESCO, pergunta à
# API (que recusa quem pergunta seguido); se ela falhar, vale o guardado mesmo velho, com aviso.
CORY = Path.home() / ".cory/uso.json"
USO_FRESCO = 15 * 60
USO_API = "https://api.anthropic.com/api/oauth/usage"
DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]


def chave_do_perfil(cfg):
    """O nome que o --perfil aceita e que o Cory usa: padrao, devin, insiders."""
    return Path(cfg).name[len(".claude-"):] if cfg else "padrao"


def nome_da_conta(cfg):
    """Quem está logado no perfil ("PRIME" vira "Prime"), lido do .claude.json dele (o do padrão fica fora
    do ~/.claude)."""
    arquivo = Path(cfg) / ".claude.json" if cfg else CASA / ".claude.json"
    try:
        conta = json.loads(arquivo.read_text(encoding="utf-8")).get("oauthAccount") or {}
    except (OSError, ValueError):
        conta = {}
    nome = " ".join((conta.get("displayName") or "").split())
    return (nome.title() if nome.isupper() or nome.islower() else nome) or chave_do_perfil(cfg)


def rotulo(c):
    return c["nome"] if c["nome"] == c["chave"] else f"{c['nome']} ({c['chave']})"


def instante(iso):
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except (AttributeError, ValueError):
        return None


def quando(t, agora=None):
    """'hoje 14h20', 'amanhã 09h', 'sáb 16h' (até 6 dias) ou '31/10 09h', na hora local."""
    if not t:
        return "—"
    alvo = datetime.fromtimestamp(round(t / 60) * 60)
    dias = (alvo.date() - datetime.fromtimestamp(agora or time.time()).date()).days
    hora = f"{alvo:%H}h" + (f"{alvo:%M}" if alvo.minute else "")
    if dias == 0:
        return f"hoje {hora}"
    if dias == 1:
        return f"amanhã {hora}"
    return f"{DIAS[alvo.weekday()]} {hora}" if 1 < dias < 7 else f"{alvo:%d/%m} {hora}"


def falta(t):
    """'1d14h', '3h05', '45min'."""
    m = max(0, math.ceil((t - time.time()) / 60))
    d, h, m = m // 1440, m % 1440 // 60, m % 60
    return (f"{d}d{h}h" if h else f"{d}d") if d else f"{h}h{m:02d}" if h else f"{m}min"


def servico_chaveiro(cfg):
    """O nome que o próprio claude dá ao login no Chaveiro: o do padrão sem sufixo, o dos outros com o
    sha256 da pasta do perfil."""
    return "Claude Code-credentials" + (f"-{hashlib.sha256(cfg.encode()).hexdigest()[:8]}" if cfg else "")


def ler_token(cfg):
    """(accessToken, quando expira) do login do perfil: no Mac do Chaveiro, senão do .credentials.json.
    Só lê. Renovar o token troca o refreshToken e pode deslogar o claude daquela conta."""
    texto = ""
    if sys.platform == "darwin":
        try:
            r = subprocess.run(["security", "find-generic-password", "-s", servico_chaveiro(cfg), "-w"],
                               capture_output=True, text=True, timeout=10)
            texto = r.stdout if r.returncode == 0 else ""
        except (OSError, subprocess.TimeoutExpired):
            pass
    arquivo = Path(cfg or CASA / ".claude") / ".credentials.json"
    if not texto and arquivo.is_file():
        texto = arquivo.read_text(encoding="utf-8")
    try:
        login = json.loads(texto)["claudeAiOauth"]
        return login["accessToken"], (login.get("expiresAt") or math.inf) / 1000
    except (ValueError, KeyError, TypeError):
        return None, None


def uso_da_api(cfg):
    """(números, None) ou (None, por que não vieram)."""
    token, expira = ler_token(cfg)
    if not token:
        return None, "sem login neste perfil"
    if expira <= time.time():
        return None, "login vencido: abre o claude nessa conta"
    pedido = Request(USO_API, headers={"Authorization": f"Bearer {token}", "anthropic-beta": "oauth-2025-04-20"})
    try:
        with urlopen(pedido, timeout=10) as r:
            resposta = json.load(r)
    except HTTPError as e:
        return None, {401: "login vencido: abre o claude nessa conta",
                      429: "a API recusou: muitas consultas"}.get(e.code, f"a API respondeu {e.code}")
    except (OSError, ValueError):
        return None, "a API não respondeu"

    def janela(nome):
        j = resposta.get(nome) or {}
        uso = j.get("utilization")
        return (round(uso) if isinstance(uso, (int, float)) else None), instante(j.get("resets_at"))
    sessao, zera = janela("five_hour")
    semana, zera_semana = janela("seven_day")
    if semana is None:
        return None, "a API não trouxe o uso da semana"
    return {"sessao": sessao or 0, "zera": zera, "semana": semana, "zera_semana": zera_semana,
            "lido": time.time(), "fonte": "API"}, None


def ler_json(arquivo, padrao):
    try:
        return json.loads(arquivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return padrao


def uso_guardado():
    """{chave do perfil: números}, o mais novo entre o arquivo do Cory e o que a API deu aqui por último."""
    usos = {}
    lista = ler_json(CORY, [])
    for e in lista if isinstance(lista, list) else []:
        lido = instante(e.get("atualizadoEm")) if isinstance(e, dict) else None
        if lido and isinstance(e.get("semana7d"), (int, float)):
            usos[e.get("contaId") or e.get("conta")] = {
                "sessao": round(e.get("sessao5h") or 0), "zera": instante(e.get("zeraEm")),
                "semana": round(e["semana7d"]), "zera_semana": instante(e.get("zeraSemanaEm")),
                "lido": lido, "fonte": "Cory"}
    for chave, n in ler_json(so.CACHE / "contas.json", {}).items():
        if n["lido"] > usos.get(chave, {}).get("lido", 0):
            usos[chave] = n
    return usos


def ler_contas():
    """O uso de cada perfil desta máquina, e os avisos do que não é de agora."""
    guardado, contas, avisos, novos = uso_guardado(), [], [], {}
    for cfg in perfis():
        c = {"cfg": cfg, "chave": chave_do_perfil(cfg), "nome": nome_da_conta(cfg)}
        velho = guardado.get(c["chave"])
        if velho and time.time() - velho["lido"] < USO_FRESCO:
            c.update(velho)
        else:
            numeros, erro = uso_da_api(cfg)
            if numeros:
                c.update(numeros)
                novos[c["chave"]] = numeros
            elif velho:
                c.update(velho)
                avisos.append(f"o uso da {rotulo(c)} é o lido há {ha(velho['lido'])} ({velho['fonte']}); "
                              f"a leitura de agora falhou: {erro}.")
            else:
                c["erro"] = erro
                avisos.append(f"sem o uso da {rotulo(c)} ({erro}): ela fica fora do --perfil auto.")
        agora = time.time()
        # Número velho com a hora de zerar já passada: aquela janela já zerou.
        if c.get("zera") and c["zera"] <= agora:
            c["sessao"], c["zera"] = 0, None
        if c.get("zera_semana") and c["zera_semana"] <= agora:
            c["semana"] = 0
            while c["zera_semana"] <= agora:
                c["zera_semana"] += 7 * 86400
        contas.append(c)
    if novos:
        # Com a trava: o registro_vivo apaga do cache o que não é de janela nenhuma, como o .novo.
        so.CACHE.mkdir(parents=True, exist_ok=True)
        arquivo = so.CACHE / "contas.json"
        with trava():
            novo = arquivo.with_suffix(".novo")
            novo.write_text(json.dumps({**ler_json(arquivo, {}), **novos}), encoding="utf-8")
            os.replace(novo, arquivo)
    return contas, avisos


def cabem(c):
    """Quantas janelas ainda cabem na conta sem ela passar do TETO, na semana e na sessão."""
    return max(0, min((TETO - c["semana"]) // GASTO_SEMANA, (TETO - c["sessao"]) // GASTO_SESSAO))


def fila_auto(contas):
    """As contas com número e abaixo do TETO, a que zera a semana antes primeiro."""
    return sorted((c for c in contas if "semana" in c and c["semana"] < TETO and c["sessao"] < TETO),
                  key=lambda c: (c["zera_semana"] or math.inf, c["semana"]))


def uso_em_uma_linha(c):
    if "semana" not in c:
        return f"{rotulo(c)}: sem número ({c['erro']})"
    sessao = f"sessão {c['sessao']}%" + (f", zera {quando(c['zera'])}" if c["zera"] else "")
    return f"{rotulo(c)}: {sessao} · semana {c['semana']}%, zera {quando(c['zera_semana'])}" + (
        f" · {c['abertas']} janela(s) aberta(s)" if c.get("abertas") else "")


def abertas_por_perfil():
    """Quantas janelas ainda rodam em cada perfil, pelo registro, as de todas as sessões. A encerrada não
    conta: o claude dela já saiu."""
    abertas = Counter()
    for c in registro_com_trava():
        try:
            if ler_estado(Path(c[5] + ".estado")) != "encerrada":
                abertas[json.loads(Path(c[5] + ".json").read_text(encoding="utf-8"))["config"]] += 1
        except (OSError, ValueError, KeyError):
            pass
    return abertas


def somar_abertas(contas):
    """Anota em cada conta as janelas que ainda rodam nela e devolve a previsão de cada uma com o gasto
    delas somado: a janela aberta continua gastando (em 24/10/2026 o auto mandou duas para a Prime sem
    contar as duas que já rodavam lá)."""
    abertas, previsto = abertas_por_perfil(), {}
    for c in contas:
        c["abertas"] = sum(n for cfg, n in abertas.items() if mesmo_perfil(cfg, c["cfg"]))
        if "semana" in c:
            previsto[c["cfg"]] = {**c, "semana": c["semana"] + c["abertas"] * GASTO_SEMANA,
                                  "sessao": c["sessao"] + c["abertas"] * GASTO_SESSAO}
    return previsto


def escolher_auto(trilhas):
    """Dá a cada trilha de perfil auto a conta dela e o motivo. Cada janela soma GASTO_* na conta em que
    vai abrir, inclusive a de perfil escolhido na mão e as que já rodam (de qualquer sessão); a que não
    cabe passa para a próxima da fila. Se o lote não couber inteiro, não abre nenhuma."""
    contas, avisos = ler_contas()
    for aviso in avisos:
        print(f"Aviso: {aviso}")
    autos = [t for t in trilhas if t["config"] is AUTO]
    if not any("semana" in c for c in contas):
        print("Aviso: sem o uso de nenhuma conta: o --perfil auto caiu no rodízio do --perfil outras.")
        lista = expandir_perfis("outras")
        for k, t in enumerate(autos):
            t["config"] = lista[k % len(lista)]
        return
    previsto = somar_abertas(contas)
    for t in trilhas:
        if t["config"] is not AUTO and t["config"] in previsto:
            previsto[t["config"]]["semana"] += GASTO_SEMANA
            previsto[t["config"]]["sessao"] += GASTO_SESSAO
    fila = [previsto[c["cfg"]] for c in fila_auto(contas)]
    if (vagas := sum(map(cabem, fila))) < len(autos):
        por_que = f"cabe{'' if vagas == 1 else 'm'} só {vagas} das {len(autos)} janelas" if vagas else \
            "nenhuma conta tem folga para mais uma janela"
        sys.exit("\n".join([
            f"O --perfil auto não abriu nada: {por_que} sem passar de {TETO}% (cada janela, aberta ou por "
            f"abrir, conta {GASTO_SEMANA} pontos da semana e {GASTO_SESSAO} da sessão de 5 h).",
            *(f"  {uso_em_uma_linha(c)}" for c in contas),
            "Abre menos janelas agora e o resto em outra leva, espera uma conta zerar, ou escolhe a conta "
            "na mão com --perfil <nome>."]))
    real = {c["cfg"]: c for c in contas}
    for t in autos:
        alvo = next(c for c in fila if cabem(c))
        cheias = [c["nome"] for c in fila[:fila.index(alvo)]]
        c = real[alvo["cfg"]]
        t["config"] = alvo["cfg"]
        t["motivo"] = f"{rotulo(c)} · {c['semana']}% da semana, zera {quando(c['zera_semana'])}" + (
            f" · {c['abertas']} janela(s) já aberta(s) nela" if c["abertas"] else "") + (
            f" · {' e '.join(cheias)} passaria{'' if len(cheias) == 1 else 'm'} de {TETO}%" if cheias else "")
        alvo["semana"] += GASTO_SEMANA
        alvo["sessao"] += GASTO_SESSAO


def cmd_contas(a):
    contas, avisos = ler_contas()
    for aviso in avisos:
        print(f"Aviso: {aviso}")
    previsto = somar_abertas(contas)
    linhas = [("Conta", "Sessão 5 h", "Semana", "Abertas", "Lido")]
    for c in contas:
        if "semana" not in c:
            linhas.append((rotulo(c), "—", "—", str(c["abertas"]), f"sem número: {c['erro']}"))
            continue
        lido = "agora" if time.time() - c["lido"] < 60 else f"há {ha(c['lido'])}"
        linhas.append((rotulo(c),
                       f"{c['sessao']:>3}%" + (f"  zera {quando(c['zera'])}" if c["zera"] else ""),
                       f"{c['semana']:>3}%  zera {quando(c['zera_semana'])}"
                       + (f" (em {falta(c['zera_semana'])})" if c["zera_semana"] else ""),
                       str(c["abertas"]), f"{c['fonte']}, {lido}"))
    larguras = [max(len(linha[i]) for linha in linhas) for i in range(4)]
    for linha in linhas:
        print("  ".join(x.ljust(w) for x, w in zip(linha, larguras)) + "  " + linha[4])
    print()
    if not any("semana" in c for c in contas):
        print("Sem o uso de nenhuma conta: o --perfil auto cairia no rodízio do --perfil outras.")
        return
    fila = fila_auto(contas)
    com_vaga = [c for c in fila if cabem(previsto[c["cfg"]])]
    if not com_vaga:
        print(f"Ordem do --perfil auto agora: nenhuma conta tem folga para uma janela sem passar de {TETO}%: "
              "o auto não abre nada.")
    else:
        print("Ordem do --perfil auto agora, com as janelas que cabem em cada: " + " → ".join(
            f"{k}º {c['nome']} ({cabem(previsto[c['cfg']])})" for k, c in enumerate(fila, 1)))
        p = com_vaga[0]
        print(f"Por quê: a {p['nome']} é a que zera a semana primeiro ({quando(p['zera_semana'])}, com "
              f"{p['semana']}%), e o que sobrar dela até lá se perde"
              + (f"; a {fila[0]['nome']} zera antes, mas mais uma janela passaria de {TETO}%" if p is not fila[0] else "")
              + f". Cada janela, aberta ou por abrir, conta {GASTO_SEMANA} pontos da semana e {GASTO_SESSAO} "
              f"da sessão, e nenhuma conta passa de {TETO}%.")
    for c in contas:
        if "semana" in c and c not in fila:
            print(f"Fora do auto: {uso_em_uma_linha(c)} (passou de {TETO}%).")
        elif "semana" not in c:
            print(f"Fora do auto: {uso_em_uma_linha(c)}.")


def transcript_da_conversa():
    config = Path(MEU_PERFIL or CASA / ".claude")
    arq = next(config.glob(f"projects/*/{SESSAO}.jsonl"), None)
    if not arq:
        sys.exit("--continuar não achou o transcript desta conversa: sem ele não há o que copiar.")
    return arq


def pasta_da_conversa():
    with transcript_da_conversa().open(encoding="utf-8") as f:
        for linha in f:
            try:
                cwd = json.loads(linha).get("cwd")
            except ValueError:
                continue
            if cwd:
                return Path(cwd).resolve()
    sys.exit("--continuar não achou a pasta desta conversa no transcript dela.")


def levar_conversa(cfg):
    """O --resume só acha a conversa nos projects do perfil da janela: copia ela pra lá."""
    origem = transcript_da_conversa()
    destino = Path(cfg or CASA / ".claude") / "projects" / origem.parent.name / origem.name
    if destino.exists() and destino.samefile(origem):
        return  # perfil com o projects ligado ao desta sessão (o devin, por exemplo)
    destino.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(origem, destino)
    if origem.with_suffix("").is_dir():
        shutil.copytree(origem.with_suffix(""), destino.with_suffix(""), dirs_exist_ok=True)


def anotar_linhagem(t, cfg, cory=None):
    LINHAGEM.parent.mkdir(parents=True, exist_ok=True)
    linha = {"quando": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "filho": t["sessao"],
             "pai": None if SESSAO == "sem-sessao" else SESSAO, "titulo": t["titulo"], "pasta": str(t["pasta"]),
             "perfil": nome_do_perfil(cfg), "worktree": t["worktree"] or None}
    if cory:
        linha["cory"] = cory  # o id do terminal do Cory em que a trilha roda
    with LINHAGEM.open("a", encoding="utf-8") as f:
        f.write(json.dumps(linha, ensure_ascii=False) + "\n")


def montar_trilhas(a):
    # A cópia só acha a conversa se abrir na pasta dela; de outra pasta o claude nasce sem o histórico.
    conversa = pasta_da_conversa() if a.continuar else None
    pastas = a.pastas or [conversa or os.getcwd()]
    if a.lote:
        if len(pastas) > 1:
            sys.exit("Com --lote vale uma pasta só, como padrão das trilhas que não dizem a sua.")
        padrao = pastas[0]
        brutas = json.loads(Path(a.lote).expanduser().read_text(encoding="utf-8"))
        for t in brutas:
            if sobra := set(t) - CAMPOS:
                sys.exit(f"Campo desconhecido no lote: {', '.join(sorted(sobra))}. "
                         f"Valem: {', '.join(sorted(CAMPOS))}.")
        brutas = [{"pasta": padrao, **t} for t in brutas]
    else:
        brutas = [{"pasta": p, "prompt": pr} for p in pastas for pr in (a.prompt or [None])]
    trilhas = [dict(t) for t in brutas for _ in range(a.n)]

    for t in trilhas:
        t["pasta"] = Path(os.path.expanduser(t["pasta"])).resolve()
        if not t["pasta"].is_dir():
            sys.exit(f"Pasta não existe: {t['pasta']}")
        if conversa and t["pasta"] != conversa:
            sys.exit(f"Com --continuar as janelas abrem na pasta desta conversa ({conversa}). "
                     "Tira a pasta do comando, ou abre sem --continuar e passa o contexto no prompt.")
    sem_titulo = Counter(t["pasta"].name for t in trilhas if not t.get("titulo"))
    vez, extras, repo, rodizio = Counter(), {}, {}, Counter()
    for t in trilhas:
        # Cada lista de perfis é um rodízio: "outras" com 3 janelas e 2 perfis dá A, B, A.
        texto = t.get("perfil") or a.perfil
        if texto and texto.strip().lower() == "auto":
            t["config"] = AUTO
        else:
            lista = tuple(expandir_perfis(texto)) if texto else (MEU_PERFIL,)
            t["config"] = lista[rodizio[lista] % len(lista)]
            rodizio[lista] += 1
        nome = t["pasta"].name
        if not t.get("titulo"):
            vez[nome] += 1
            t["titulo"] = f"{nome} · {vez[nome]}" if sem_titulo[nome] > 1 else nome
        wt = t.get("worktree", a.worktree)
        t["worktree"] = slug(t["titulo"]) if wt is True else wt
        if t["worktree"]:
            if t["pasta"] not in repo:
                repo[t["pasta"]] = subprocess.run(
                    ["git", "-C", str(t["pasta"]), "rev-parse", "--git-dir"], capture_output=True).returncode == 0
            if not repo[t["pasta"]]:
                sys.exit(f"--worktree precisa de um repositório git, e {t['pasta']} não é um. "
                         "Abre sem --worktree ou aponta para a pasta do repo.")
        t["modelo"] = t.get("modelo") or a.modelo
        t["esforco"] = t.get("esforco") or a.esforco
        if t["pasta"] not in extras:
            extras[t["pasta"]] = extras_do_workspace(t["pasta"])
        t["extras"] = extras[t["pasta"]]
        t["sessao"] = str(uuid.uuid4())
    if any(t["config"] is AUTO for t in trilhas):
        escolher_auto(trilhas)
    return trilhas


def args_claude(t, claude, modo, continuar):
    args = [claude, *(["--permission-mode", modo] if modo else ["--dangerously-skip-permissions"]),
            "--settings", str(so.CACHE / "hooks.json"), "--name", t["titulo"], "--session-id", t["sessao"]]
    for flag, chave in (("--model", "modelo"), ("--effort", "esforco"), ("--worktree", "worktree")):
        if t[chave]:
            args += [flag, t[chave]]
    if continuar:
        args += ["--resume", continuar, "--fork-session"]
    # O prompt vai depois das opções de um valor só e antes do --add-dir, que aceita várias pastas e
    # o engoliria como mais uma. Começando com "-" o claude o leria como opção: a quebra de linha evita.
    if t.get("prompt"):
        args.append(("\n" if t["prompt"].startswith("-") else "") + t["prompt"])
    if t["extras"]:
        args += ["--add-dir", *map(str, t["extras"])]
    return args


# Dentro do Cory, o app do dono que junta as conversas do Claude Code, cada sessão recebe CORY_TERMINAIS
# (http://127.0.0.1:<porta>), CORY_TERMINAIS_TOKEN e CORY_CONVERSA, e as trilhas abrem como terminais
# dele em vez de janelas: o mesmo comando, os mesmos hooks, o mesmo registro. Na linha do registro a
# marca é "cory:<id do terminal>" e o id é o pid do processo que o terminal roda: é por ele que vão a
# guarda de servidor e a prova de vida quando o Cory não responde.
class CoryFalhou(Exception):
    def __init__(self, motivo, codigo=None):
        super().__init__(motivo)
        self.codigo = codigo


class Cory:
    def __init__(self, url, token):
        self.url, self.token = url.rstrip("/"), token

    def pedir(self, metodo, caminho, corpo=None):
        # http.client direto: o Cory é local, e o urllib mandaria o pedido pelo proxy do sistema.
        alvo = urlparse(self.url)
        conexao = http.client.HTTPConnection(alvo.hostname or "127.0.0.1", alvo.port or 80, timeout=5)
        try:
            conexao.request(metodo, alvo.path.rstrip("/") + caminho, None if corpo is None else json.dumps(corpo),
                            {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
            r = conexao.getresponse()
            texto = r.read()
        except (OSError, http.client.HTTPException) as e:
            raise CoryFalhou(f"o Cory não respondeu em {self.url} ({e})")
        finally:
            conexao.close()
        if r.status >= 400:
            raise CoryFalhou("o Cory recusou o token" if r.status in (401, 403) else
                             f"o Cory respondeu {r.status} a {metodo} {caminho}", r.status)
        try:
            return json.loads(texto) if texto.strip() else None
        except ValueError:
            raise CoryFalhou(f"o Cory respondeu a {metodo} {caminho} com algo que não é JSON")

    def terminais(self):
        """{id: vivo} dos terminais que abriu por aqui. O que saiu continua na lista, com vivo falso."""
        lista = self.pedir("GET", "/terminais")
        if not isinstance(lista, list):
            raise CoryFalhou("o Cory respondeu a GET /terminais sem a lista")
        return {str(t["id"]): t.get("vivo") for t in lista if isinstance(t, dict) and "id" in t}

    def abrir(self, titulo, pasta, comando, env, conversa):
        corpo = {"titulo": titulo, "pasta": pasta, "comando": comando, "env": env}
        if conversa:
            corpo["conversa"] = conversa
        resposta = self.pedir("POST", "/terminais", corpo)
        if not isinstance(resposta, dict) or resposta.get("id") in (None, ""):
            raise CoryFalhou("o Cory respondeu a POST /terminais sem o id do terminal")
        return str(resposta["id"])

    def fechar(self, cid):
        try:
            self.pedir("DELETE", f"/terminais/{quote(cid, safe='')}")
        except CoryFalhou as e:
            if e.codigo != 404:  # 404: a aba já não existia
                raise


def cory_no_ar():
    """O Cory em que esta sessão roda, se ele atende; senão None, dizendo por quê."""
    url, token = os.environ.get("CORY_TERMINAIS"), os.environ.get("CORY_TERMINAIS_TOKEN")
    if not (url and token):
        return None
    cory = Cory(url, token)
    try:
        cory.terminais()
        return cory
    except CoryFalhou as e:
        dica = " (o Cory reiniciou depois que esta conversa abriu? Abre a conversa de novo nele)" if e.codigo in (401, 403) else ""
        print(f"Aviso: esta sessão roda dentro do Cory, mas {e}{dica}: as trilhas abrem em janelas do terminal, como fora dele.")
        return None


def esperar_pid(base, segundos=20):
    arquivo, fim = Path(base + ".pid"), time.time() + segundos
    while time.time() < fim:
        if arquivo.exists() and (texto := arquivo.read_text().strip()).isdigit():
            return int(texto)
        time.sleep(0.1)
    return None


def abrir_no_cory(cory, t, base, cfg, args):
    """Abre a trilha como terminal do Cory. Devolve (pid do processo dele, marca, id do terminal)."""
    # O Cory aceita como conversa o id dele ou o da sessão do claude. A trilha leva o da própria sessão: o
    # Cory põe no terminal o CORY_CONVERSA de quem abriu, e com ele as trilhas que ela abrisse iriam para
    # baixo da conversa avó. O CLAUDE_CONFIG_DIR diz ao Cory a conta do terminal.
    env = {"CORY_TERMINAIS": cory.url, "CORY_TERMINAIS_TOKEN": cory.token, "CORY_CONVERSA": t["sessao"],
           **({"CLAUDE_CONFIG_DIR": cfg} if cfg else {})}
    conversa = os.environ.get("CORY_CONVERSA") or (None if SESSAO == "sem-sessao" else SESSAO)
    cid = cory.abrir(t["titulo"], str(t["pasta"]), so.comando(t, base, cfg, args), env, conversa)
    pid = esperar_pid(base)
    if not pid:
        with suppress(CoryFalhou):
            cory.fechar(cid)
        raise CoryFalhou("o terminal do Cory abriu, mas o comando da trilha não começou em 20 s")
    return pid, f"cory:{cid}", cid


def do_cory(c):
    return c[1].startswith("cory:")


def cory_da_linha(c):
    """O Cory que abriu o terminal da linha (guardado no .json dela) e o id do terminal."""
    cid = c[1][len("cory:"):]
    try:
        meta = json.loads(Path(c[5] + ".json").read_text(encoding="utf-8"))["cory"]
        return Cory(meta["url"], meta["token"]), cid
    except (OSError, ValueError, KeyError, TypeError):
        return None, cid


def cory_viva(c, vistos):
    """O Cory diz que o terminal está vivo, ou o processo dele ainda roda. Vale o processo quando o Cory não
    responde (fora do ar, token velho) e quando ele dá o terminal por encerrado com o processo rodando:
    assim o fechar ainda o alcança."""
    cory, cid = cory_da_linha(c)
    if cory and cory.url not in vistos:
        try:
            vistos[cory.url] = cory.terminais()
        except CoryFalhou:
            vistos[cory.url] = {}
    return bool(cory and vistos[cory.url].get(cid, False) is not False) or so.processo_da_trilha(int(c[0]), c[5])


def servidores(pid):
    """Portas em escuta de processos nascidos dentro do terminal (dev server, proxy, watcher)."""
    pai, escuta = so.processos()

    def nasceu_dentro(p):
        for _ in range(50):
            if p == pid:
                return True
            p = pai.get(p)
            if not p:
                return False
        return False
    return sorted({porta for dono, porta in escuta if nasceu_dentro(dono)})


def fechar_no_cory(linhas, opcoes):
    """O fechar das trilhas que rodam em terminal do Cory: DELETE no terminal, sem osascript e sem diálogo."""
    fechadas = 0
    for c in linhas:
        pid, (cory, cid) = int(c[0]), cory_da_linha(c)
        vivo = so.processo_da_trilha(pid, c[5])
        # O servidor nasce dentro do terminal e morre com ele.
        if vivo and (portas := servidores(pid)) and "--forcar" not in opcoes:
            print(f"janela {c[0]} (terminal do Cory): segura servidor na porta {', '.join(map(str, portas))} — não fechei.\n"
                  "   relance o servidor fora da janela antes, ou use --forcar para derrubar junto.")
            continue
        if "--listar" in opcoes:
            print(f"fecharia janela {c[0]} (terminal do Cory)")
            continue
        if vivo and "--forcar" in opcoes:
            so.matar(pid)  # o servidor que ignoraria o fim da aba cai junto
        try:
            if not cory:
                raise CoryFalhou("não achei o endereço do Cory no .json da janela")
            cory.fechar(cid)
            # O Cory encerra o processo ao tirar a aba. Se ele demorar, quem encerra é o fechar: com ele
            # vivo a linha ficaria no registro.
            fim = time.time() + 3
            while so.processo_da_trilha(pid, c[5]) and time.time() < fim:
                time.sleep(0.1)
            if so.processo_da_trilha(pid, c[5]):
                so.matar(pid)
        except CoryFalhou as e:
            # Sem o Cory o terminal fecha pelo processo; se a aba ainda existir, fica lá como encerrada.
            if so.processo_da_trilha(pid, c[5]):
                so.matar(pid)
            print(f"janela {c[0]}: {e}; encerrei o processo dela.")
        fechadas += 1
        print(f"janela {c[0]} fechada")
    if "--listar" not in opcoes:
        print(f"{fechadas} janela(s) do Cory fechada(s)")


def cmd_abrir(a):
    trilhas = montar_trilhas(a)
    claude = so.achar_claude() or "claude"
    usados = {t["config"] for t in trilhas}
    cory = cory_no_ar()
    with trava():
        registro_vivo()
        if cory:
            plano, outras, avisos = [(None, "terminal do Cory")] * len(trilhas), {}, []
        else:
            destinos, outras, ondes, avisos = organizar.plano_novas(len(trilhas), a.monitor)
            plano = list(zip(destinos, ondes))
        if len(usados) == 1:
            print(f"Perfil: {nome_do_perfil(next(iter(usados)))}")
        else:
            print(f"Perfis: um por trilha (esta sessão está no {nome_do_perfil(MEU_PERFIL)})")
        if cory:
            print("Dentro do Cory: cada trilha abre como terminal dele, embaixo desta conversa. "
                  "Grade e --monitor não valem aqui.")
        for aviso in avisos:
            print(f"Aviso: {aviso}")
        if not a.dry_run:
            so.CACHE.mkdir(parents=True, exist_ok=True)
            (so.CACHE / "hooks.json").write_text(json.dumps(HOOKS), encoding="utf-8")
            if a.continuar:
                for cfg in usados:
                    if not mesmo_perfil(cfg, MEU_PERFIL):
                        levar_conversa(cfg)
        carimbo, abertas, no_cory = f"{time.strftime('%Y%m%d-%H%M%S')}-{os.getpid()}", [], 0
        for k, t in enumerate(trilhas, 1):
            args = args_claude(t, claude, a.modo, SESSAO if a.continuar else None)
            cfg = t["config"]
            detalhe = f" · {t['motivo']}" if t.get("motivo") else f" · {nome_do_perfil(cfg)}" if len(usados) > 1 else ""
            if t["extras"]:
                detalhe += f" · +{len(t['extras'])} pasta(s) do workspace"
            if a.dry_run:
                linha = subprocess.list2cmdline(args) if sys.platform == "win32" else " ".join(map(shlex.quote, args))
                print(f"[simulação] {t['titulo']} · {t['pasta']} · {plano[k - 1][1]}{detalhe}\n    {linha}")
                continue
            base = str(so.CACHE / f"{carimbo}-{k}")
            Path(base + ".estado").write_text("abrindo", encoding="utf-8")
            meta = {"titulo": t["titulo"], "sessao": t["sessao"], "config": cfg, "pasta": str(t["pasta"]), "args": args,
                    "inicio": "trabalhando" if t.get("prompt") else "parada"}
            Path(base + ".json").write_text(json.dumps(meta), encoding="utf-8")
            cid = None
            if cory:
                try:
                    jid, marca, cid = abrir_no_cory(cory, t, base, cfg, args)
                    meta["cory"] = {"url": cory.url, "token": cory.token, "id": cid}
                    Path(base + ".json").write_text(json.dumps(meta), encoding="utf-8")
                    no_cory += 1
                except CoryFalhou as e:
                    print(f"Aviso: {e}: esta trilha e as que faltam abrem em janelas do terminal, como fora do Cory.")
                    cory = None
                    destinos, outras, ondes, avisos = organizar.plano_novas(len(trilhas) - k + 1, a.monitor)
                    plano[k - 1:] = zip(destinos, ondes)
                    for aviso in avisos:
                        print(f"Aviso: {aviso}")
            destino, onde = plano[k - 1]
            if not cid:
                jid, marca = so.abrir(t, base, cfg, args, destino)
                abertas.append(jid)
            with so.REGISTRO.open("a", encoding="utf-8") as f:
                f.write("\t".join([str(jid), marca, str(t["pasta"]), SESSAO, time.strftime("%Y-%m-%d %H:%M"), base]) + "\n")
            anotar_linhagem(t, cfg, cid)
            print(f"Janela {jid} · {t['titulo']} · {t['pasta']} · {onde}{detalhe}")
        if not a.dry_run:
            organizar.aplicar(outras)
            if abertas:
                so.ativar(abertas)
            print(f"{len(trilhas)} janela(s) aberta(s)" + (f", {no_cory} como terminal do Cory" if no_cory else "") + ".")
            contar_lote({str(t["pasta"]) for t in trilhas})


def ler_uso():
    """{"nunca": não perguntar mais, "pastas": {pasta: {"lotes", "desde", "adiado"}}}"""
    arquivo = so.CACHE / "uso.json"
    uso = json.loads(arquivo.read_text(encoding="utf-8")) if arquivo.exists() else {}
    uso.setdefault("pastas", {})
    return uso


def gravar_uso(uso):
    so.CACHE.mkdir(parents=True, exist_ok=True)
    (so.CACHE / "uso.json").write_text(json.dumps(uso, ensure_ascii=False, indent=1), encoding="utf-8")


def dias_desde(data):
    return (time.time() - time.mktime(time.strptime(data, "%Y-%m-%d"))) / 86400


def contar_lote(pastas):
    """Soma um lote em cada pasta e avisa quando já é hora de perguntar pela limpeza."""
    uso = ler_uso()
    for pasta in sorted(pastas):
        u = uso["pastas"].setdefault(pasta, {"lotes": 0, "desde": time.strftime("%Y-%m-%d")})
        u["lotes"] += 1
        if "adiado" in u:
            hora_de_perguntar = dias_desde(u["adiado"]) >= LIMPEZA_ADIA
        else:
            hora_de_perguntar = u["lotes"] >= LIMPEZA_LOTES or dias_desde(u["desde"]) >= LIMPEZA_DIAS
        if hora_de_perguntar and not uso.get("nunca"):
            q = shlex.quote(pasta)
            print(f"Aviso: {u['lotes']} lote(s) em {pasta} desde {u['desde']} sem limpeza. Pergunta se é pra limpar "
                  f"os .md que as trilhas deixaram lá e registra a resposta: \"limpeza {q} --feita\" (limpou), "
                  f"\"limpeza {q} --adiar\" (agora não: pergunta de novo em {LIMPEZA_ADIA} dias) ou "
                  "\"limpeza --nunca\" (não perguntar mais).")
    gravar_uso(uso)


def cmd_limpeza(a):
    """Registra a resposta à pergunta da limpeza; sem nada, mostra a conta de cada pasta."""
    if bool(a.pasta) != bool(a.feita or a.adiar):
        sys.exit("Com a pasta, diz o que houve: --feita (limpou) ou --adiar (agora não). "
                 "Sem pasta: nada (mostra a conta), --nunca ou --perguntar.")
    with trava():
        uso = ler_uso()
        pasta = str(Path(os.path.expanduser(a.pasta)).resolve()) if a.pasta else None
        if a.feita:
            uso["pastas"].pop(pasta, None)
            print(f"Conta de {pasta} zerada.")
        elif a.adiar:
            uso["pastas"].setdefault(pasta, {"lotes": 0, "desde": time.strftime("%Y-%m-%d")})["adiado"] = time.strftime("%Y-%m-%d")
            print(f"Anotado: volto a perguntar pela limpeza de {pasta} daqui a {LIMPEZA_ADIA} dias.")
        elif a.nunca:
            uso["nunca"] = True
            print("Anotado: não pergunto mais pela limpeza. Para voltar a perguntar: limpeza --perguntar")
        elif a.perguntar:
            uso.pop("nunca", None)
            print("Anotado: volto a perguntar pela limpeza.")
        else:
            for nome, u in sorted(uso["pastas"].items()):
                print(f"{u['lotes']} lote(s) desde {u['desde']}" + (f", adiado em {u['adiado']}" if "adiado" in u else "") + f"  ·  {nome}")
            if uso.get("nunca"):
                print("A pergunta da limpeza está desligada (limpeza --perguntar liga de novo).")
            elif not uso["pastas"]:
                print("Nenhum lote contado ainda.")
            return
        gravar_uso(uso)


def ha(instante):
    s = int(time.time() - instante)
    return f"{s} s" if s < 60 else f"{s // 60} min" if s < 3600 else f"{s // 3600} h {s % 3600 // 60} min"


def ler_estado(arquivo):
    # O hook esvazia o arquivo antes de escrever: lido bem nessa hora, vem vazio.
    for _ in range(5):
        if nome := arquivo.read_text(encoding="utf-8").strip():
            return nome
        time.sleep(0.05)
    return "abrindo"


def situacao(todas=False):
    """(id, estado, quando mudou, título, pasta, base dos arquivos) de cada janela aberta por esta sessão."""
    janelas = []
    # Lê os arquivos com a trava: outra chamada pode estar limpando o cache de uma janela que fechou.
    with trava():
        for c in registro_vivo():
            if todas or c[3] == SESSAO:
                estado = Path(c[5] + ".estado")
                titulo = json.loads(Path(c[5] + ".json").read_text(encoding="utf-8"))["titulo"]
                janelas.append((c[0], ler_estado(estado), estado.stat().st_mtime, titulo, c[2], c[5]))
    return janelas


def mostrar(janelas):
    for jid, estado, desde, titulo, pasta, _ in janelas:
        print(f"{jid}  {MARCAS[estado]} {estado} há {ha(desde)}  ·  {titulo}  ·  {pasta}")


def cmd_status(a):
    janelas = situacao(a.todas)
    if not janelas:
        print("Nenhuma janela aberta" + ("." if a.todas else " por esta sessão (--todas mostra as das outras)."))
    mostrar(janelas)


# Janela que não sai de "abrindo" está parada na tela de confiar na pasta: não conta como trabalho.
ABRINDO_DEMAIS = 90


def presa(estado, desde):
    return estado == "abrindo" and time.time() - desde >= ABRINDO_DEMAIS


def ocupada(j):
    return j[1] == "trabalhando" or (j[1] == "abrindo" and not presa(j[1], j[2]))


def aviso(j):
    """Onde o esperar anota a parada que já contou, e o que anota: o estado e a hora dele."""
    return Path(j[5] + ".avisado"), f"{j[1]} {j[2]!r}"


def avisada(j):
    arquivo, anotado = aviso(j)
    return arquivo.exists() and arquivo.read_text(encoding="utf-8") == anotado


AVISOS = {
    "parada": "parou: colhe com `ver {0}` e, se a trilha terminou, fecha com `fechar {0}`.",
    "pergunta": "fez uma pergunta e espera a resposta nela.",
    "encerrada": "encerrou (o claude saiu, sobrou o shell): colhe com `ver {0}` e fecha com `fechar {0}`.",
    "abrindo": "não saiu de \"abrindo\": deve estar na tela de confiar na pasta.",
}


def cmd_esperar(a):
    """Segura até haver novidade nas janelas desta sessão: uma parar, fazer uma pergunta, encerrar ou
    ser fechada. Diz qual.

    É como o Claude que abriu as janelas fica de olho nelas sem perguntar o estado a toda hora: roda
    isto em segundo plano, é avisado quando volta, colhe e fecha a janela que terminou e roda de
    novo para as restantes. Cada parada é avisada uma vez só: a janela que continua aberta depois do
    aviso não faz o próximo esperar voltar na hora.

    Sem janela trabalhando ele segura do mesmo jeito: a trilha que pôs um comando em segundo plano
    encerra o turno, fica "parada" e retoma sozinha quando o comando acaba.
    """
    fim = time.time() + a.minutos * 60
    antes = {}
    while True:
        janelas = situacao()
        fechadas = [f"{jid} ({titulo})" for jid, titulo in antes.items() if jid not in {j[0] for j in janelas}]
        novas = [j for j in janelas if not ocupada(j) and not avisada(j)]
        if novas or fechadas or not janelas or time.time() >= fim:
            break
        antes = {j[0]: j[3] for j in janelas}
        time.sleep(3)
    mostrar(janelas)
    for j in novas:
        print(f"A janela {j[0]} ({j[3]}) " + AVISOS[j[1]].format(j[0]))
        arquivo, anotado = aviso(j)
        arquivo.write_text(anotado, encoding="utf-8")
    for qual in fechadas:
        print(f"A janela {qual} foi fechada: não está mais no registro.")
    ocupadas = sum(ocupada(j) for j in janelas)
    if not janelas:
        print("Nenhuma janela aberta por esta sessão.")
    elif not (novas or fechadas):
        print(f"Nada mudou em {a.minutos:g} min" + (f": ainda há janela trabalhando ({ocupadas}). Roda o esperar de novo." if ocupadas else
              " e nenhuma janela está trabalhando: fecha as que terminaram, ou roda o esperar de novo se ainda espera por alguma."))
    elif ocupadas:
        print(f"Ainda há janela trabalhando ({ocupadas}): trata o que voltou e roda o esperar de novo para as restantes.")
    else:
        print("Nenhuma janela trabalhando: colhe com `ver <id>` e fecha as que terminaram. "
              "Se alguma ainda não terminou, deixa aberta e roda o esperar de novo.")


def ultima_resposta(meta):
    config = Path(meta["config"] or Path.home() / ".claude")
    texto = None
    for arq in config.glob(f"projects/*/{meta['sessao']}.jsonl"):
        for linha in arq.read_text(encoding="utf-8").splitlines():
            try:
                m = json.loads(linha)
            except ValueError:
                continue
            if m.get("type") == "assistant" and not m.get("isSidechain"):
                partes = [p["text"] for p in m["message"]["content"] if p.get("type") == "text"]
                texto = "\n".join(partes) or texto
    return texto


def cmd_ver(a):
    with trava():
        linha = next((c for c in registro_vivo() if int(c[0]) == a.id), None)
    if not linha:
        sys.exit(f"A janela {a.id} não está no registro (já fechou?). O status lista as abertas.")
    meta = json.loads(Path(linha[5] + ".json").read_text(encoding="utf-8"))
    print(f"{meta['titulo']} · {ler_estado(Path(linha[5] + '.estado'))}\n")
    # Sem resposta gravada ainda, o que dá pra ver é a tela (onde o sistema deixa ler; o Cory não deixa).
    print(ultima_resposta(meta) or (None if do_cory(linha) else so.tela(a.id))
          or "A trilha ainda não gravou nenhuma resposta.")


def registro_com_trava():
    with trava():
        return registro_vivo()


def cmd_fechar(args):
    """Fecha as trilhas que rodam em terminal do Cory e passa as outras ao fechar do sistema."""
    linhas = registro_com_trava()
    if not any(map(do_cory, linhas)):
        return so.fechar(args, registro_com_trava, SESSAO)
    opcoes = [x for x in args if x.startswith("--")]
    ids = [x for x in args if not x.startswith("--")]
    if sobra := set(opcoes) - {"--todas", "--listar", "--forcar"}:
        sys.exit(f"Opção desconhecida: {', '.join(sorted(sobra))}. Valem --todas, --listar e --forcar.")

    def escolhida(c):
        return c[0] in ids if ids else "--todas" in opcoes or c[3] == SESSAO
    if alvo := [c for c in linhas if do_cory(c) and escolhida(c)]:
        fechar_no_cory(alvo, opcoes)
    # Id de terminal do Cory nunca vai ao fechar do sistema: no Mac ele fecharia a janela do Terminal de
    # mesmo número.
    resto = [x for x in ids if x not in {c[0] for c in linhas if do_cory(c)}]
    if resto or (not ids and any(escolhida(c) for c in linhas if not do_cory(c))):
        return so.fechar(opcoes + resto, lambda: [c for c in registro_com_trava() if not do_cory(c)], SESSAO)
    registro_com_trava()  # a que fechou sai do registro já
    if not alvo:
        print("nenhuma janela registrada para fechar")


def main():
    for saida in (sys.stdout, sys.stderr):
        saida.reconfigure(encoding="utf-8")  # no Windows o padrão não tem "·" nem as marcas
    if sys.argv[1:2] == ["fechar"]:
        return cmd_fechar(sys.argv[2:])
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    ab = sub.add_parser("abrir")
    ab.add_argument("pastas", nargs="*")
    ab.add_argument("-n", type=int, default=1)
    um_ou_outro = ab.add_mutually_exclusive_group()
    um_ou_outro.add_argument("--prompt", action="append")
    um_ou_outro.add_argument("--lote")
    ab.add_argument("--modelo")
    ab.add_argument("--esforco")
    ab.add_argument("--modo", choices=["plan", "acceptEdits", "auto", "manual", "dontAsk"])
    ab.add_argument("--monitor")
    ab.add_argument("--perfil")
    ab.add_argument("--worktree", action="store_true")
    ab.add_argument("--continuar", action="store_true")
    ab.add_argument("--dry-run", action="store_true")
    ab.set_defaults(func=cmd_abrir)
    st = sub.add_parser("status")
    st.add_argument("--todas", action="store_true")
    st.set_defaults(func=cmd_status)
    es = sub.add_parser("esperar")
    es.add_argument("--minutos", type=float, default=30)
    es.set_defaults(func=cmd_esperar)
    li = sub.add_parser("limpeza")
    li.add_argument("pasta", nargs="?")
    resposta = li.add_mutually_exclusive_group()
    for opcao in ("--feita", "--adiar", "--nunca", "--perguntar"):
        resposta.add_argument(opcao, action="store_true")
    li.set_defaults(func=cmd_limpeza)
    ve = sub.add_parser("ver")
    ve.add_argument("id", type=int)
    ve.set_defaults(func=cmd_ver)
    sub.add_parser("contas").set_defaults(func=cmd_contas)
    sub.add_parser("fechar")
    so.subcomandos(sub)
    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
