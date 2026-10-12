# primo-skills

Minhas skills do Claude Code, uma pasta por skill. Valem no Mac e no Windows.

[![terminais no Windows](https://github.com/svcrashh/primo-skills/actions/workflows/windows-terminais.yml/badge.svg)](https://github.com/svcrashh/primo-skills/actions/workflows/windows-terminais.yml) [![play no Windows](https://github.com/svcrashh/primo-skills/actions/workflows/windows-play.yml/badge.svg)](https://github.com/svcrashh/primo-skills/actions/workflows/windows-play.yml) [![primo-videos no Windows](https://github.com/svcrashh/primo-skills/actions/workflows/windows-primo-videos.yml/badge.svg)](https://github.com/svcrashh/primo-skills/actions/workflows/windows-primo-videos.yml)

| Skill | O que faz |
|---|---|
| `terminal-claude` | Abre várias janelas de terminal, cada uma com um Claude e o seu prompt, acompanha em que pé está cada uma e fecha cada uma quando termina. |
| `terminal-organizar` | Arruma as janelas de terminal em grade, cada monitor com a sua. |
| `play` | Você cola o caminho de um áudio ou de um vídeo (áudio do WhatsApp, vídeo do celular, gravação de tela) e o Claude passa a saber o que é dito nele e, em vídeo, o que aparece. A transcrição usa a API da OpenAI, com a sua chave. |
| `primo-videos` | Faz vídeo do seu produto, com ou sem narração: lê o projeto, pergunta o que falta, mostra cada cena como imagem parada antes de animar e entrega o MP4 com trilha original. A marca e as ideias são suas. A voz em off (ElevenLabs) e as imagens geradas (OpenAI) são opcionais, com a sua chave. [Como usar](primo-videos/README.md). |

As duas de terminal andam juntas: a `terminal-claude` usa a grade da `terminal-organizar`.

## Instalar

O instalador liga cada pasta de skill em `~/.claude/skills`. É ligação, não cópia: o que for editado aqui já vale no Claude, e `git pull` atualiza tudo.

Mac:

```sh
git clone https://github.com/svcrashh/primo-skills.git ~/Documents/GitHub/primo-skills
~/Documents/GitHub/primo-skills/instalar.sh
```

Windows (PowerShell), depois de instalar o que está em [No Windows](#no-windows):

```powershell
git clone https://github.com/svcrashh/primo-skills.git $HOME\Documents\GitHub\primo-skills
powershell -ExecutionPolicy Bypass -File $HOME\Documents\GitHub\primo-skills\instalar.ps1
```

Para outro perfil do Claude (outra pasta de configuração), passe a pasta de skills dele: `instalar.sh ~/.claude-insiders/skills`.

Se já existir uma pasta de verdade com o nome da skill, o instalador não mexe nela e avisa.

No fim, o instalador mostra o que cada skill precisa nesta máquina e o que falta (chave de API, ffmpeg, Node), com o passo a passo para resolver. Rodar de novo não desfaz nada: serve para conferir depois de arrumar. Para ver só o de uma skill: `node ~/.claude/skills/play/scripts/requisitos.mjs` (nas de terminal o arquivo é `requisitos.py`, e roda com `python3` no Mac e `python` no Windows).

## No Windows

Antes do instalador, no PowerShell:

```powershell
winget install Git.Git
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
winget install ffmpeg
irm https://claude.ai/install.ps1 | iex
```

- **Git** traz o Git Bash, que o Claude Code usa para rodar comandos. **Python** é das skills de terminal e da trilha da `primo-videos`; **Node** e **ffmpeg**, da `play` e da `primo-videos`. A última linha instala o Claude Code.
- Na primeira vez, o `winget` pede para aceitar os termos: responda `Y`. Depois de cada instalação, feche e abra o PowerShell (e o Claude Code, se estiver aberto): o programa novo só aparece numa janela nova.
- O `python` que já vem no Windows é um atalho para a Microsoft Store e não serve. O instalador reconhece esse caso e avisa.
- No Windows 10 falta o Windows Terminal: `winget install Microsoft.WindowsTerminal`. No Windows 11 ele já vem.
- A `primo-videos` pede, uma vez por máquina, `node "$env:USERPROFILE\.claude\skills\primo-videos\scripts\environment.mjs" --fix --yes`, que baixa cerca de 300 MB (o Chromium que desenha o vídeo) e cria o Python da trilha.
- O que faltar, o instalador mostra no fim, com o comando para resolver. Na janela antiga do console, os sinais aparecem como `√` e `×`.

### O que foi provado, e o que você confere na primeira vez

Tudo roda, a cada mudança, numa máquina Windows do GitHub Actions (Windows Server 2025); os três selos no topo mostram a última rodada. Lá foram provados: o instalador do zero, nos dois PowerShell e com acento e espaço no caminho; a `play` do áudio à transcrição e à folha de quadros; as skills de terminal abrindo, acompanhando, fechando e arrumando janelas de verdade do Windows Terminal; e a `primo-videos` instalando, passando a suíte inteira e entregando vídeos de ponta a ponta.

Essa máquina não tem conta do Claude, placa de vídeo, segundo monitor nem as chaves pagas. Então ficou sem prova, e vale conferir na primeira vez:

- **Skills de terminal:** peça ao Claude "abre um terminal com o claude e diz oi" e veja a janela abrir, responder e fechar. Lá o Claude usado foi um de mentira. Tela com escala acima de 100% e dois monitores não foram testados.
- **`play`:** cole o caminho de um áudio curto e veja se a transcrição faz sentido.
- **`primo-videos`:** o vídeo é desenhado pelo processador, não pela placa de vídeo: sai igual, mais devagar, sobretudo em cena 3D. A tese e o crítico chamam o `claude`; confira que `claude --version` responde no terminal.

O que não existe no Windows: `--monitor notebook` nas skills de terminal (o Windows não diz qual tela é a do notebook; a skill avisa e escolhe sozinha). O resto dos limites está na seção "No Windows" do `SKILL.md` de cada skill.

Depois de instalar, não mova nem apague esta pasta: as skills apontam para ela.

## Fazer o Claude usar sozinho

Instalada, a skill só roda quando você pede ("abre 3 terminais", `/terminal-claude`). Para o Claude dividir o trabalho por conta própria, cole o bloco abaixo no seu `~/.claude/CLAUDE.md` e **troque o número do limite**.

```markdown
## Terminais em paralelo — /terminal-claude

Quando o trabalho se divide em partes grandes e independentes, usa a skill `/terminal-claude` por conta própria: uma janela de terminal por parte, cada uma com um Claude e o seu prompt, todas numa chamada só. Não precisa eu pedir.

- **Limite: no máximo 3 janelas abertas ao mesmo tempo.** Se o trabalho pede mais, faz em levas: espera uma terminar, colhe o resultado, fecha e abre a próxima. Passar do limite, só se eu pedir na hora.
- Antes de abrir, me diz em uma linha quantas janelas vão subir e o que cada uma faz.
- Você é o supervisor: eu falo com você, e você abre as janelas, fica de olho nelas, colhe o resultado de cada uma, fecha e me conta. Se uma janela fizer uma pergunta, me avisa qual.
- Terminal é para trabalho de verdade (implementar, migrar, refatorar), que leva mais que alguns minutos. Para busca, leitura ou conferência curta, usa subagent. Se a tarefa cabe numa sessão, não abre nada.
- Duas partes que mexem no mesmo arquivo não vão em paralelo: viram uma só, ou cada uma no seu worktree.
- Não cria `PROMPT.md`, `HANDOFF.md` nem relatório em `.md` no projeto para passar trabalho: o prompt vai inteiro para a janela e o resultado volta na resposta.
```

### Quem fica de olho

Você conversa com um Claude só, o da sua sessão. É ele que abre as janelas, espera, lê a resposta de cada uma, fecha e te conta o resultado. Você não precisa ir de janela em janela; só entra numa quando o Claude de lá faz uma pergunta, e o supervisor te avisa qual.

### Que limite pôr

Cada janela é uma sessão inteira do Claude, gastando do mesmo plano ou da mesma chave. Três janelas trabalhando gastam mais ou menos o triplo de uma no mesmo tempo.

- **Comece com 2 ou 3.** Use alguns dias, olhe o consumo com `/usage` no Claude Code e só então suba.
- **Plano por assinatura:** mais janelas fazem você bater no limite de uso mais cedo.
- **API paga por uso:** a conta sobe na mesma proporção.
- **As janelas rodam em bypass**, sem pedir permissão a cada ação. Mais janelas é mais coisa acontecendo sem você olhar.
- **Sem limite:** troque a linha por "Sem limite de janelas: abre quantas o trabalho pedir." Só faz sentido com folga no plano.

O limite é uma regra que o Claude segue, não uma trava no programa: se você pedir 8 janelas na hora, ele abre 8. Sem o bloco no CLAUDE.md, o Claude não passa de 3 por conta própria.

### Limpeza

Depois de 10 lotes ou 14 dias de uso num projeto, o Claude pergunta se você quer limpar os `.md` que as trilhas deixaram por lá. Ele mostra a lista e só apaga o que você confirmar. Se você disser "agora não", ele pergunta de novo em 3 dias; se disser para não perguntar mais, ele para.

## Chaves de API

Duas skills usam serviços pagos, cada um com a sua chave. Você cria a chave na sua conta e paga o que usar; nada passa por mim.

| Skill | Para quê | Chave | Sem a chave |
|---|---|---|---|
| `play` | transcrever o que é dito no áudio ou no vídeo | OpenAI | em vídeo, ela ainda mostra o que aparece; a fala fica de fora |
| `primo-videos` | imagem gerada, quando a cena precisa | OpenAI | funciona inteira; só não gera imagem |
| `primo-videos` | voz em off | ElevenLabs | funciona inteira; o vídeo sai sem narração |

- **OpenAI:** a chave se cria em [platform.openai.com](https://platform.openai.com), em "API keys". A API é paga por uso e é separada da assinatura do ChatGPT: precisa de crédito na conta da API, em "Billing". Na `play`, a cobrança é pela duração do áudio enviado.
- **ElevenLabs:** a chave se cria em [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys), no menu da esquerda, em "Developers" → "API Keys". Ela gasta os créditos do plano da sua conta.

Onde guardar, no Mac (no Windows a pasta é `%USERPROFILE%\.claude\secrets`, e o instalador imprime os comandos do PowerShell para criar a pasta e abrir o arquivo no Bloco de Notas):

```sh
mkdir -p ~/.claude/secrets && chmod 700 ~/.claude/secrets
touch ~/.claude/secrets/openai.env && chmod 600 ~/.claude/secrets/openai.env
open -e ~/.claude/secrets/openai.env
```

No arquivo, uma linha só: `OPENAI_API_KEY=` seguido da chave. Para a ElevenLabs, o arquivo é `elevenlabs.env` e a linha começa com `ELEVENLABS_API_KEY=`. A variável de ambiente com o mesmo nome também vale, no lugar do arquivo.

A chave fica só nesse arquivo: não cole na conversa com o Claude e não ponha no git. As skills nunca a imprimem.

## Requisitos

| Skill | Mac | Windows |
|---|---|---|
| `terminal-claude` e `terminal-organizar` | Terminal.app, `python3` e o `claude` | Python 3.8 ou mais novo, Windows Terminal e o `claude` |
| `play` | Node 18 ou mais novo, ffmpeg (`brew install ffmpeg`) e a chave da OpenAI | o mesmo, com `winget` |
| `primo-videos` | Node 18 ou mais novo, ffmpeg, Python 3 e, uma vez por máquina, `node ~/.claude/skills/primo-videos/scripts/environment.mjs --fix` | o mesmo, com `winget` e o comando de [No Windows](#no-windows) |

Na `primo-videos`, a voz em off e as imagens geradas são opcionais e pedem a chave de cada serviço; sem elas, roda tudo na máquina. O resto está no [README dela](primo-videos/README.md).

## Acrescentar uma skill

1. Crie uma pasta com o nome da skill e um `SKILL.md` dentro.
2. Se ela precisa de algo na máquina (um programa, uma chave), ponha um `scripts/requisitos.mjs` (Node) ou um `scripts/requisitos.py` (Python) que diga o que tem, o que falta e como resolver: `✔` tem, `✖` falta e é obrigatório, `○` falta e é opcional, com saída 1 quando falta algo obrigatório. É ele que o instalador roda no fim. O da `play` serve de modelo.
3. Rode o instalador de novo.
4. Commit e push.
