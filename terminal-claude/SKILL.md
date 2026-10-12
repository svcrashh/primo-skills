---
name: terminal-claude
description: Abre uma ou várias janelas de terminal (Terminal.app no Mac, Windows Terminal no Windows), cada uma com o Claude em bypass (--dangerously-skip-permissions) e sem deixar a máquina dormir, para dividir o trabalho em trilhas paralelas — um prompt por janela, todas numa chamada só —, acompanha em que pé está cada uma e fecha cada uma quando termina. Use quando eu digitar "/terminal-claude" ou pedir "abre um terminal com o claude", "abre N terminais", "divide isso em terminais", "abre as trilhas", "abre as sessões com os prompts", "claude em bypass no terminal", "abre o claude no notebook/no monitor". Vale igual no Mac e no Windows e nos perfis ~/.claude (VS Code e claude no terminal), ~/.claude-devin e ~/.claude-insiders.
---

# terminal-claude

A ideia é dividir o trabalho: várias janelas de terminal, cada uma com um Claude em bypass e o seu
prompt, rodando ao mesmo tempo. Uma janela só também vale, mas o caso que importa é o lote.

**Um só motor para todos os perfis e para os dois sistemas** (11/10/2026):
`~/.claude/skills/terminal-claude/scripts/terminais.py`. No Mac as janelas são do Terminal.app; no
Windows, do Windows Terminal. A Devin enxerga esta pasta pelo link `~/.claude-devin/skills →
~/.claude/skills`, e o `~/.claude-insiders/skills/terminal-claude/SKILL.md` é link para este
arquivo. A janela nasce no perfil da sessão que chamou. Mudou algo? Muda só aqui.

```sh
# Mac (zsh)
T=~/.claude/skills/terminal-claude/scripts/terminais.py
python3 $T abrir  [pasta ...] [opções]     # abre as janelas
python3 $T status [--todas]                # em que pé está cada uma
python3 $T esperar                         # segura até uma janela parar, e diz qual (pra rodar em segundo plano)
python3 $T ver <id>                        # a última resposta de uma trilha
python3 $T fechar [id ...]                 # fecha as que esta sessão abriu
python3 $T limpeza                         # conta de lotes por pasta, pro aviso de limpeza
```

```powershell
# Windows (PowerShell): os mesmos comandos, com `python`
$T = "$HOME\.claude\skills\terminal-claude\scripts\terminais.py"
python $T abrir C:\caminho\do\projeto --lote trilhas.json
```

Olha em que sistema você está antes de escrever o comando. O resto deste arquivo usa `$T` e vale
nos dois; o que é diferente no Windows está em "No Windows", no fim.

Não pede confirmação para abrir: a invocação da skill já é o pedido.

## 1. Dividir em trilhas

Quando o pedido é dividir um trabalho, antes de abrir:

- **Uma trilha por parte independente.** Duas trilhas que editam o mesmo arquivo não vão em
  paralelo: viram uma só, ou cada uma no seu worktree (`"worktree": true`).
- **O prompt de cada trilha se basta.** O Claude novo não sabe nada desta conversa (a não ser com
  `--continuar`): diz o objetivo, os arquivos, o que já foi descartado, o que entregar e como
  conferir.
- **O prompt vai inteiro no lote, do tamanho que for.** Não cria `PROMPT.md`, `HANDOFF.md` nem
  `prompt-*.md` no projeto pra passar o trabalho: é isso que deixa .md espalhado pelos projetos. Só
  aponta para um arquivo quando ele já existe e faz parte do projeto.
- **A trilha não deixa relatório em arquivo.** Pede no prompt que o resultado venha na resposta
  final dela, que você colhe com `ver`. Nada de `RESUMO.md` ou `RELATORIO.md` no projeto.
- **Título curto por trilha** ("A · schema"). É o que aparece na janela e no `status`.

**Quantas janelas.** Vale o limite que o CLAUDE.md de quem usa disser (ou "sem limite", se for o
que ele diz). Se o CLAUDE.md não fala disso e ninguém pediu um número, não passa de 3 abertas ao
mesmo tempo por conta própria. O que não couber vai em levas: espera uma terminar, colhe, fecha e
abre a próxima. Cada janela é uma sessão inteira do Claude gastando do mesmo plano, então N janelas
gastam mais ou menos N vezes. Antes de abrir, diz em uma linha quantas vão subir e o que cada uma
faz.

Escreve as trilhas num JSON (com o Write, no scratchpad) e abre todas de uma vez:

```json
[
  {"titulo": "A · schema", "prompt": "…"},
  {"titulo": "B · docs", "prompt": "…", "modelo": "sonnet"},
  {"titulo": "C · api", "prompt": "…", "pasta": "~/Documents/GitHub/outro-repo", "worktree": true}
]
```

```sh
python3 $T abrir <pasta> --lote <trilhas.json>
```

Campos de cada trilha: `titulo`, `prompt`, `pasta`, `modelo`, `esforco`, `worktree`. Só `prompt`
costuma ser preciso; o que a trilha não disser vem da linha de comando (a pasta e as opções valem
como padrão do lote). O prompt vai inteiro, com aspas, acento e várias linhas.

## 2. Abrir

| Pedido | Comando |
|---|---|
| Um terminal na pasta do projeto | `abrir <pasta>` |
| N terminais vazios, pra eu colar os prompts | `abrir <pasta> -n N` |
| Dois ou três prompts curtos | `abrir <pasta> --prompt "…" --prompt "…"` (uma janela por prompt) |
| O mesmo prompt em N janelas | `abrir <pasta> -n N --prompt "…"` |
| Várias trilhas, prompt longo, título ou modelo por trilha | `abrir <pasta> --lote trilhas.json` |
| Uma janela por pasta | `abrir <pasta1> <pasta2>` |

**Pasta**, nesta ordem: a que eu nomear; senão o *Primary working directory* desta sessão; em
workspace multipasta, a pasta onde a conversa está trabalhando. Não pergunta. Se a pasta faz parte
de um `.code-workspace` aberto no VS Code, as outras pastas dele entram sozinhas via `--add-dir`.

**Opções**, só quando eu pedir:

- `--modelo opus|sonnet|haiku|<id>` — "no opus", "no sonnet", ou a trilha diz o modelo dela. Sem
  isso, o modelo padrão do perfil.
- `--esforco low|medium|high|xhigh|max` — "no esforço alto".
- `--monitor notebook|horizontal|vertical|externo` — "no notebook", "no mac" → `notebook`; "no
  vertical", "no monitor em pé" → `vertical`; "no horizontal", "no deitado" → `horizontal`; "no
  monitor", "no externo", "na tela grande" → `externo`. Sem isso o motor escolhe; quantas cabem em
  cada monitor das duas mesas está na tabela do `terminal-organizar`.
- `--worktree` — cada janela num worktree próprio do git (`<repo>/.claude/worktrees/<título>`,
  branch `worktree-<título>`), pra duas trilhas mexerem no mesmo repo sem pisar uma na outra. Quem
  junta as branches no fim é esta sessão ou eu: diz isso no resumo.
- `--continuar` — cada janela nasce como **cópia desta conversa** e recebe só a parte dela como
  prompt. Use quando as trilhas precisam do que já foi discutido aqui (plano fechado, arquivos
  lidos). Cada cópia carrega a conversa inteira, então conversa longa custa por janela. Abre sempre
  na pasta desta conversa; combina com `--worktree`.
- `--modo plan` (ou `manual`, `acceptEdits`, `auto`, `dontAsk`) — troca o bypass por outro modo de
  permissão. Só quando eu pedir ("abre em plan mode").
- `--dry-run` — mostra o plano, o quadrado de cada janela e o comando, sem abrir nada.

## 3. Acompanhar e fechar — obrigatório

Quem abriu é o supervisor. Eu converso com você, e você cuida das janelas: abre, fica de olho,
colhe o resultado de cada uma, fecha e me conta o que cada trilha entregou. Não me manda ir olhar
janela por janela. Pedi em 04/10/2026 que nenhuma sessão deixe terminal órfão na tela.

**O ciclo: colher e fechar cada janela assim que ela termina, sem esperar o lote inteiro.** Logo
depois de abrir, roda `esperar` em segundo plano (no Bash, `run_in_background`; você é chamado de
volta quando ele termina) e segue com o que não depende das trilhas. Ele volta assim que **uma**
janela para, faz uma pergunta, encerra ou é fechada, e diz qual:

```
$ python3 $T esperar
23748  ✅ parada há 2 s  ·  A · schema  ·  /Users/…/repo
23753  ⏳ trabalhando há 14 min  ·  B · docs  ·  /Users/…/repo
A janela 23748 (A · schema) parou: colhe com `ver 23748` e, se a trilha terminou, fecha com `fechar 23748`.
Ainda há janela trabalhando (1): trata o que voltou e roda o esperar de novo para as restantes.
```

A cada volta:

1. `ver <id>` na janela que ele apontou.
2. **A trilha terminou?** `fechar <id>` na hora. Pedi em 12/10/2026 que janela que acabou não fique
   aberta por causa do resto do lote: num lote de 3, uma terminou em 14 minutos e ficou na tela
   esperando as outras duas.
3. **Não terminou?** Deixa aberta. Parar não é terminar: a trilha que pôs um comando em segundo
   plano encerra o turno dizendo que está aguardando e retoma sozinha quando ele acaba; a que me
   perguntou algo espera a resposta nela (me diz qual janela e o que ela perguntou).
4. **Sobrou janela aberta?** `esperar` de novo, em segundo plano. Cada parada é avisada uma vez só:
   a janela que ficou aberta não faz ele voltar na hora, só quando parar outra vez. Sem janela
   trabalhando ele segura do mesmo jeito, até `--minutos` (30 se não disser), e aí volta dizendo
   que nada mudou.

O ciclo acaba quando o `esperar` responde "Nenhuma janela aberta por esta sessão".

O `status` mostra em que pé está cada uma, sem esperar:

```
$ python3 $T status
23748  ✅ parada há 3 min  ·  A · schema  ·  /Users/…/repo
23753  ⏳ trabalhando há 40 s  ·  B · docs  ·  /Users/…/repo
```

- `abrindo` — o claude ainda não começou. Se não sai disso, a janela está na tela "confiar nesta
  pasta" (pasta que o claude nunca abriu; a home pede toda vez) esperando eu confirmar.
- `trabalhando` — no meio de um turno.
- `parada` — terminou o turno e espera o próximo prompt. É a hora de colher, e de fechar se a
  trilha terminou.
- `pergunta` — o Claude de lá fez uma pergunta e espera a resposta na janela. Me avisa qual
  janela e qual pergunta; quem responde sou eu, nela.
- `encerrada` — o claude saiu; sobrou só o shell.

Na própria janela o título mostra o mesmo: `◐ A · schema` girando enquanto trabalha, `✳ A · schema`
quando para.

- **Colher:** `ver <id>` imprime a última resposta da trilha, lida do transcript dela. Faz isso
  antes de fechar, que depois o registro esquece a janela (a conversa continua salva e abre de novo
  com `claude --resume`).
- **Fechar:** `fechar <id> …` fecha as escolhidas; `fechar` sem id fecha todas as que esta sessão
  abriu; `fechar --listar` só mostra. No Mac ele encerra o claude da janela, manda o shell sair e só
  então fecha, e assim **não aparece o diálogo "finalizar os processos em execução?"**. Fechar com
  `close` direto abre esse diálogo e trava: a preferência do Mac é "sempre perguntar".
- **Servidor na janela:** antes de fechar ele confere se a janela segura um servidor (dev server,
  proxy, watcher) e recusa, porque o processo nasce dentro da janela e morre com ela. Isso mordeu
  em 04/10/2026: as duas versões do site estavam em janelas de trilha e teriam caído junto. Quando
  o servidor precisa sobreviver, relança fora da janela antes (`nohup cmd > log 2>&1 &`, confere
  que o pai virou `launchd`) e só então fecha; `--forcar` fecha derrubando o servidor junto.
- Precisou de mais trabalho depois de fechar? Abre janela nova. Não deixa janela parada "para o
  caso de".

`status --todas` e `fechar --todas` alcançam as janelas das outras sessões. Só com pedido meu.

## 4. Limpar as sobras

Com o tempo as trilhas deixam .md pelo projeto (prompts, handoffs, resumos). O `abrir` conta os
lotes por pasta e, depois de 10 lotes ou 14 dias de uso, solta um `Aviso:` de limpeza. Quando ele
aparecer, pergunta uma vez, no fim da resposta: "Quer que eu limpe os .md que as trilhas deixaram
em <pasta>?" e registra o que eu disser:

- **Sim:** limpa (abaixo) e roda `limpeza <pasta> --feita`. A conta zera.
- **Agora não:** `limpeza <pasta> --adiar`. A skill anota e pergunta de novo em 3 dias.
- **Não pergunta mais:** `limpeza --nunca`. Vale para todas as pastas; `limpeza --perguntar`
  desfaz.

Sempre oferece as três saídas na pergunta. `limpeza` sem nada mostra a conta de cada pasta.

Como limpar:

1. Procura as sobras: `PROMPT*.md`, `HANDOFF*.md`, `prompt-*.md`, pastas `prompts/`, `trilhas/` e
   `_passagem/`, e resumos ou relatórios que uma trilha escreveu. Olha os soltos e os que já estão
   no git.
2. Lê cada um antes de julgar. README, CLAUDE.md, documentação do produto e plano que eu pedi pra
   guardar não são sobra. Na dúvida, fica.
3. Me mostra a lista, uma linha por arquivo dizendo o que é, e só apaga o que eu confirmar.
4. Em repositório git, apaga com `git rm` e faz um commit só da limpeza.

## 5. Responder

Uma linha por janela, como a saída do `abrir` (título, pasta, monitor e quadrado), mais os `Aviso:`
se vieram e o perfil usado. Se falhar por permissão de Automação (erro -1743), repassa a mensagem
do script: o caminho pra liberar já vem nela.

## Como funciona

Nos dois sistemas:

- **Perfil:** o mesmo da sessão que chamou. Com `CLAUDE_CONFIG_DIR` vazio (perfil `~/.claude`) a
  janela nasce com ele vazio; **nunca** com `CLAUDE_CONFIG_DIR=~/.claude`, que faria o claude ler
  `~/.claude/.claude.json` (um arquivo velho) e outra credencial.
- **Ambiente limpo nas duas pontas.** Uma sessão carrega `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`
  e companhia; com elas o claude novo vira sessão-filha e **não salva a conversa** ("Transcript
  saving is off"). A janela tira tudo que começa com `CLAUDE` antes de chamar o claude, e o
  programa de terminal é aberto sem essas variáveis, pra que as janelas que eu abrir depois na mão
  não herdem nada desta sessão.
- **O prompt não passa pela linha de comando da janela.** Fica num arquivo da janela, então
  tamanho, aspas e quebra de linha não importam.
- **Estado por hooks.** Cada claude recebe por `--settings` hooks que só gravam o arquivo de
  estado. Não escrevem no terminal: escrever o título dali caía no meio do desenho da tela do
  claude e sujava a janela.
- **Registro** das janelas abertas (id, marca da janela, pasta, sessão, data, arquivos). É por ele
  que o `fechar` sabe o que é desta sessão. Janela fechada à mão sai dele sozinha, e os arquivos
  dela são apagados. Só sai com a morte confirmada: a leitura não enxergar a janela não basta (em
  12/10/2026 uma janela foi esquecida assim, com o claude dela rodando). No Mac a prova é o tty:
  outra janela já o usa, ou ele não é mais de aba nenhuma do Terminal. No Windows é o processo da
  janela: já não roda, ou o número dele passou para outro programa.
- **Grade:** as janelas do lote são planejadas juntas e já nascem cada uma no seu quadrado; enche
  um monitor e passa para o próximo com vaga. As regras (tamanhos, qual monitor, quando reorganiza)
  estão em `~/.claude/skills/terminal-organizar/SKILL.md`, e o motor de lá é importado daqui.
- **Arquivos:** `terminais.py` é o que é igual nos dois sistemas; `so_mac.py` e `so_windows.py`
  são a parte de cada um (abrir, achar e fechar janela).

### No Mac

- Cada janela roda `caffeinate -ims claude --dangerously-skip-permissions …`. O `caffeinate` deixa
  o Mac acordado enquanto o claude roda e solta quando ele fecha; a tela ainda apaga e bloqueia. Só
  com o carregador ele segura o sono do sistema; com a tampa fechada na bateria não tem jeito.
- A janela recebe só `. <arquivo>`, um script de zsh com o comando inteiro.
- Registro em `/private/tmp/claude-terminais-abertos.tsv`; arquivos das janelas em
  `~/Library/Caches/terminal-claude/`. A marca da janela é o tty.
- O `osascript` roda com ambiente mínimo: se for ele quem abrir o Terminal.app, o app não herda o
  ambiente desta sessão.
- `scripts/open-terminal.sh` é o nome antigo: a `videostudio-app` ainda chama por ele, e ele só
  repassa ao `terminais.py`. O `fechar` é o `scripts/fechar-terminal.sh`.
- `scripts/teste_mac_simulado.py` exercita o registro e o `esperar` com o Terminal simulado, sem
  abrir janela nem tocar no registro de verdade. Roda depois de mexer no `so_mac.py` ou no
  `terminais.py`.

### No Windows

**Escrito no Mac em 11/10/2026 e ainda não rodado num Windows de verdade.** A lógica passa no
`scripts/teste_windows_simulado.py` (sistema simulado), mas as chamadas ao Windows e ao Windows
Terminal nunca foram executadas. Na primeira vez: `abrir <pasta> --dry-run`, depois uma janela só
com `--modo manual`, depois `status` e `fechar`. O que falhar, conserta na fonte (`so_windows.py`,
ou `janelas_win.py` no terminal-organizar) e, quando tudo rodar, tira este parágrafo.

- **Precisa de:** Python (`python`), Windows Terminal (`wt`; `winget install
  Microsoft.WindowsTerminal`) e o `claude` nativo no PATH.
- Cada janela é um Windows Terminal novo rodando `python terminais.py rodar <base>`: é o Python que
  chama o claude, com os argumentos lidos de um JSON, e segura o sono do sistema enquanto ele roda
  (a tela ainda apaga). Quando o claude sai, abre um PowerShell na pasta da trilha.
- Registro em `%TEMP%\claude-terminais-abertos.tsv`; arquivos das janelas em
  `%LOCALAPPDATA%\terminal-claude\`. O id é o da janela e a marca é o pid do processo dela.
- `fechar` mata a árvore de processos da janela (`taskkill /T /F`) e pede pra ela fechar. A guarda
  de servidor é a mesma: janela com processo escutando porta não fecha sem `--forcar`.
- `ver` só mostra a resposta gravada no transcript: de fora não dá pra ler a tela do Windows
  Terminal.
- **Monitores:** o Windows não diz qual tela é a do notebook, então todas contam como monitor
  externo e a primeira janela nasce no monitor principal. `--monitor notebook` não acha nada lá.
- **Hooks:** o comando é `python terminais.py marcar <estado>`. Se as janelas ficarem presas em
  `abrindo` com o claude já respondendo, o hook não rodou: confere o shell que o Claude Code usa
  pros hooks no Windows.

## O que não fazer

- Não rodar `claude` dentro da própria sessão nem em background: a janela é para eu ver e usar.
- Não trocar o bypass por outro modo a menos que eu peça.
- Não abrir uma chamada por janela quando são várias: o lote planeja a grade de uma vez.
- Não deixar janela aberta depois que a trilha terminou, nem à espera do resto do lote, e não
  fechar janela de outra sessão.
- Não abrir o programa de terminal direto da sessão (`osascript … activate`, `open`, `wt`): ele
  herdaria o ambiente dela (veja "Ambiente limpo").
