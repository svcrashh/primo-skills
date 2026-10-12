#!/usr/bin/env python3
"""Abre janelas de terminal com o claude em bypass, uma por trilha, sem deixar a máquina dormir, e
acompanha. No Mac as janelas são do Terminal.app; no Windows, do Windows Terminal.

Uso: terminais.py abrir [pasta ...] [-n N] [--prompt TEXTO]... [--lote trilhas.json]
                        [--modelo M] [--esforco E] [--modo MODO] [--monitor M]
                        [--worktree] [--continuar] [--dry-run]
     terminais.py status [--todas]
     terminais.py ver <id>
     terminais.py fechar [--listar] [--todas] [--forcar] [id ...]

Um só motor para os perfis ~/.claude, ~/.claude-devin (via link) e ~/.claude-insiders: a janela
nasce no perfil da sessão que chamou. O que muda de um sistema para o outro (abrir, achar e fechar
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
CAMPOS = {"titulo", "prompt", "pasta", "modelo", "esforco", "worktree"}
MARCAS = {"abrindo": "🕓", "trabalhando": "⏳", "parada": "✅", "pergunta": "❓", "encerrada": "⏹"}

def hook(estado):
    return [{"type": "command", "command": so.comando_hook(estado)}]


# Vai no --settings de cada janela: é daqui que o status sabe em que pé está cada trilha.
HOOKS = {"hooks": {
    # A janela nasce "abrindo" e só sai disso aqui: presa na tela de confiar na pasta, fica nele.
    "SessionStart": [{"matcher": "startup|resume", "hooks": hook("parada")}],
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
    linhas = []
    if so.REGISTRO.exists():
        for linha in so.REGISTRO.read_text(encoding="utf-8").splitlines():
            c = linha.split("\t")
            if len(c) >= 6 and c[0].isdigit() and so.viva(abertas, int(c[0]), c[1]):
                linhas.append(c)
    so.REGISTRO.write_text("".join("\t".join(c) + "\n" for c in linhas), encoding="utf-8")
    donos = {c[5] for c in linhas}
    if so.CACHE.is_dir():
        for f in so.CACHE.iterdir():
            if f.name != "hooks.json" and str(f.with_suffix("")) not in donos:
                f.unlink()
    return linhas


def slug(texto):
    ascii_ = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_).strip("-")


def pasta_da_conversa():
    config = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
    for arq in config.glob(f"projects/*/{SESSAO}.jsonl"):
        with arq.open(encoding="utf-8") as f:
            for linha in f:
                try:
                    cwd = json.loads(linha).get("cwd")
                except ValueError:
                    continue
                if cwd:
                    return Path(cwd).resolve()
    sys.exit("--continuar não achou o transcript desta conversa: sem ele não há o que copiar.")


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
    vez, extras, repo = Counter(), {}, {}
    for t in trilhas:
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
    cfg = os.environ.get("CLAUDE_CONFIG_DIR")
    claude = shutil.which("claude") or "claude"
    with trava():
        registro_vivo()
        destinos, outras, ondes, avisos = organizar.plano_novas(len(trilhas), a.monitor)
        print(f"Perfil: {cfg or '~/.claude (padrão)'}")
        for aviso in avisos:
            print(f"Aviso: {aviso}")
        if not a.dry_run:
            so.CACHE.mkdir(parents=True, exist_ok=True)
            (so.CACHE / "hooks.json").write_text(json.dumps(HOOKS), encoding="utf-8")
        carimbo, abertas = f"{time.strftime('%Y%m%d-%H%M%S')}-{os.getpid()}", []
        for k, (t, destino, onde) in enumerate(zip(trilhas, destinos, ondes), 1):
            args = args_claude(t, claude, a.modo, SESSAO if a.continuar else None)
            resumo = f"{t['titulo']} · {t['pasta']} · {onde}"
            if t["extras"]:
                resumo += f" · +{len(t['extras'])} pasta(s) do workspace"
            if a.dry_run:
                print(f"[simulação] {resumo}\n    {' '.join(map(shlex.quote, args))}")
                continue
            base = str(so.CACHE / f"{carimbo}-{k}")
            Path(base + ".estado").write_text("abrindo", encoding="utf-8")
            Path(base + ".json").write_text(json.dumps({
                "titulo": t["titulo"], "sessao": t["sessao"], "config": cfg, "pasta": str(t["pasta"]), "args": args,
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


def ha(instante):
    s = int(time.time() - instante)
    return f"{s} s" if s < 60 else f"{s // 60} min" if s < 3600 else f"{s // 3600} h {s % 3600 // 60} min"


def cmd_status(a):
    with trava():
        linhas = [c for c in registro_vivo() if a.todas or c[3] == SESSAO]
    if not linhas:
        print("Nenhuma janela aberta" + ("." if a.todas else " por esta sessão (--todas mostra as das outras)."))
        return
    for c in linhas:
        estado = Path(c[5] + ".estado")
        nome = estado.read_text(encoding="utf-8").strip()
        titulo = json.loads(Path(c[5] + ".json").read_text(encoding="utf-8"))["titulo"]
        print(f"{c[0]}  {MARCAS[nome]} {nome} há {ha(estado.stat().st_mtime)}  ·  {titulo}  ·  {c[2]}")


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
    print(f"{meta['titulo']} · {Path(linha[5] + '.estado').read_text(encoding='utf-8').strip()}\n")
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
    ab.add_argument("--worktree", action="store_true")
    ab.add_argument("--continuar", action="store_true")
    ab.add_argument("--dry-run", action="store_true")
    ab.set_defaults(func=cmd_abrir)
    st = sub.add_parser("status")
    st.add_argument("--todas", action="store_true")
    st.set_defaults(func=cmd_status)
    ve = sub.add_parser("ver")
    ve.add_argument("id", type=int)
    ve.set_defaults(func=cmd_ver)
    sub.add_parser("fechar")
    so.subcomandos(sub)
    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
