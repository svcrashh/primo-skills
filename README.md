# primo-skills

Minhas skills do Claude Code, uma pasta por skill. Valem no Mac e no Windows.

| Skill | O que faz |
|---|---|
| `terminal-claude` | Abre várias janelas de terminal, cada uma com um Claude e o seu prompt, acompanha em que pé está cada uma e fecha no fim. |
| `terminal-organizar` | Arruma as janelas de terminal em grade, cada monitor com a sua. |

As duas andam juntas: a `terminal-claude` usa a grade da `terminal-organizar`.

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

## Requisitos

- **Mac:** Terminal.app e `python3`.
- **Windows:** Python (`python`), Windows Terminal (`wt`) e o `claude` no PATH. O lado Windows foi escrito no Mac e ainda não rodou num Windows de verdade; o `SKILL.md` de cada skill diz o que conferir na primeira vez.

## Acrescentar uma skill

1. Crie uma pasta com o nome da skill e um `SKILL.md` dentro.
2. Rode o instalador de novo.
3. Commit e push.
