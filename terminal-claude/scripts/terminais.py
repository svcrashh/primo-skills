#!/usr/bin/env python3
"""Abre janelas de terminal com o claude em bypass, uma por trilha, sem deixar a máquina dormir, e
acompanha. No Mac as janelas são do Terminal.app; no Windows, do Windows Terminal.

Uso: terminais.py abrir [pasta ...] [-n N] [--prompt TEXTO]... [--lote trilhas.json]
                        [--modelo M] [--esforco E] [--modo MODO] [--monitor M]
                        [--perfil P] [--worktree] [--continuar] [--dry-run]
     terminais.py status [--todas]
     terminais.py esperar [--minutos N]
     terminais.py ver <id>
     terminais.py limpeza [pasta --feita | pasta --adiar | --nunca | --perguntar]
     terminais.py fechar [--listar] [--todas] [--forcar] [id ...]

Um só motor para os perfis ~/.claude, ~/.claude-devin (via link) e ~/.claude-insiders: a janela
nasce no perfil da sessão que chamou, ou no que o --perfil disser ("outras" reparte as janelas
entre os perfis que não são o desta sessão, pra elas gastarem das outras contas). O que muda de um sistema para o outro (abrir, achar e fechar
janela) está em so_mac.py e so_windows.py; aqui fica o que é igual nos dois.
"""
import argparse
import json
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
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import url2pathname

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
    abertas = so.vivas()
    antes = so.REGISTRO.read_text(encoding="utf-8") if so.REGISTRO.exists() else ""
    linhas = [c for c in (linha.split("\t") for linha in antes.splitlines())
              if len(c) >= 6 and c[0].isdigit() and so.viva(abertas, c)]
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
            if f.name not in ("hooks.json", "uso.json") and str(f.with_suffix("")) not in donos:
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
            sys.exit(f"Perfil não existe: {p}. Valem: outras, padrao, "
                     + ", ".join(Path(c).name[len(".claude-"):] for c in perfis() if c) + ".")
        lista.append(normalizar_perfil(str(p)))
    return lista


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


def cmd_abrir(a):
    trilhas = montar_trilhas(a)
    claude = so.achar_claude() or "claude"
    usados = {t["config"] for t in trilhas}
    with trava():
        registro_vivo()
        destinos, outras, ondes, avisos = organizar.plano_novas(len(trilhas), a.monitor)
        if len(usados) == 1:
            print(f"Perfil: {nome_do_perfil(next(iter(usados)))}")
        else:
            print(f"Perfis: um por trilha (esta sessão está no {nome_do_perfil(MEU_PERFIL)})")
        for aviso in avisos:
            print(f"Aviso: {aviso}")
        if not a.dry_run:
            so.CACHE.mkdir(parents=True, exist_ok=True)
            (so.CACHE / "hooks.json").write_text(json.dumps(HOOKS), encoding="utf-8")
            if a.continuar:
                for cfg in usados:
                    if not mesmo_perfil(cfg, MEU_PERFIL):
                        levar_conversa(cfg)
        carimbo, abertas = f"{time.strftime('%Y%m%d-%H%M%S')}-{os.getpid()}", []
        for k, (t, destino, onde) in enumerate(zip(trilhas, destinos, ondes), 1):
            args = args_claude(t, claude, a.modo, SESSAO if a.continuar else None)
            cfg = t["config"]
            resumo = f"{t['titulo']} · {t['pasta']} · {onde}"
            if len(usados) > 1:
                resumo += f" · {nome_do_perfil(cfg)}"
            if t["extras"]:
                resumo += f" · +{len(t['extras'])} pasta(s) do workspace"
            if a.dry_run:
                linha = subprocess.list2cmdline(args) if sys.platform == "win32" else " ".join(map(shlex.quote, args))
                print(f"[simulação] {resumo}\n    {linha}")
                continue
            base = str(so.CACHE / f"{carimbo}-{k}")
            Path(base + ".estado").write_text("abrindo", encoding="utf-8")
            Path(base + ".json").write_text(json.dumps({
                "titulo": t["titulo"], "sessao": t["sessao"], "config": cfg, "pasta": str(t["pasta"]), "args": args,
                "inicio": "trabalhando" if t.get("prompt") else "parada",
            }), encoding="utf-8")
            jid, marca = so.abrir(t, base, cfg, args, destino)
            with so.REGISTRO.open("a", encoding="utf-8") as f:
                f.write("\t".join([str(jid), marca, str(t["pasta"]), SESSAO, time.strftime("%Y-%m-%d %H:%M"), base]) + "\n")
            abertas.append(jid)
            print(f"Janela {jid} · {resumo}")
        if not a.dry_run:
            organizar.aplicar(outras)
            so.ativar(abertas)
            print(f"{len(trilhas)} janela(s) aberta(s).")
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
    # Sem resposta gravada ainda, o que dá pra ver é a tela (onde o sistema deixa ler).
    print(ultima_resposta(meta) or so.tela(a.id) or "A trilha ainda não gravou nenhuma resposta.")


def registro_com_trava():
    with trava():
        return registro_vivo()


def main():
    for saida in (sys.stdout, sys.stderr):
        saida.reconfigure(encoding="utf-8")  # no Windows o padrão não tem "·" nem as marcas
    if sys.argv[1:2] == ["fechar"]:
        return so.fechar(sys.argv[2:], registro_com_trava, SESSAO)
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
    sub.add_parser("fechar")
    so.subcomandos(sub)
    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
