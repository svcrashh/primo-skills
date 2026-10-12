# primo-skills

Minhas skills do Claude Code, uma pasta por skill. As de terminal valem no Mac e no Windows; a `primo-videos`, por enquanto, só no Mac.

| Skill | O que faz |
|---|---|
| `terminal-claude` | Abre várias janelas de terminal, cada uma com um Claude e o seu prompt, acompanha em que pé está cada uma e fecha cada uma quando termina. |
| `terminal-organizar` | Arruma as janelas de terminal em grade, cada monitor com a sua. |
| `primo-videos` | Faz vídeo do seu produto, com ou sem narração: lê o projeto, pergunta o que falta, mostra cada cena como imagem parada antes de animar e entrega o MP4 com trilha original. A marca e as ideias são suas. A voz em off (ElevenLabs) e as imagens geradas (OpenAI) são opcionais, com a sua chave. Só Mac por enquanto. [Como usar](primo-videos/README.md). |

As duas de terminal andam juntas: a `terminal-claude` usa a grade da `terminal-organizar`.

## Instalar

O instalador liga cada pasta de skill em `~/.claude/skills`. É ligação, não cópia: o que for editado aqui já vale no Claude, e `git pull` atualiza tudo.

Mac:

```sh
git clone https://github.com/svcrashh/primo-skills.git ~/Documents/GitHub/primo-skills
~/Documents/GitHub/primo-skills/instalar.sh
```

Windows (PowerShell):

```powershell
git clone https://github.com/svcrashh/primo-skills.git $HOME\Documents\GitHub\primo-skills
powershell -ExecutionPolicy Bypass -File $HOME\Documents\GitHub\primo-skills\instalar.ps1
```

Para outro perfil do Claude (outra pasta de configuração), passe a pasta de skills dele: `instalar.sh ~/.claude-insiders/skills`.

Se já existir uma pasta de verdade com o nome da skill, o instalador não mexe nela e avisa.

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

## Requisitos

- **Mac:** Terminal.app e `python3`.
- **`primo-videos` (Mac):** Node 18 ou mais novo, ffmpeg (`brew install ffmpeg`) e, uma vez por máquina, `node ~/.claude/skills/primo-videos/scripts/environment.mjs --fix` (acha o Playwright e cria o Python da trilha). A voz em off e as imagens geradas são opcionais e pedem a chave de cada serviço (`ELEVENLABS_API_KEY`, `OPENAI_API_KEY`); sem elas, roda tudo na máquina. O resto está no [README dela](primo-videos/README.md).
- **Windows:** Python (`python`), Windows Terminal (`wt`) e o `claude` no PATH. O lado Windows foi escrito no Mac e ainda não rodou num Windows de verdade; o `SKILL.md` de cada skill diz o que conferir na primeira vez.

## Acrescentar uma skill

1. Crie uma pasta com o nome da skill e um `SKILL.md` dentro.
2. Rode o instalador de novo.
3. Commit e push.
