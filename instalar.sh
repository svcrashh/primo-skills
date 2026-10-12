#!/bin/zsh
# Liga cada skill deste repositório na pasta de skills do Claude (padrão: ~/.claude/skills).
# É ligação, não cópia: editar aqui já vale no Claude, e git pull atualiza tudo.
# Uso: instalar.sh [pasta de skills de outro perfil]
set -e
repo=${0:A:h}
destino=${1:-$HOME/.claude/skills}
mkdir -p $destino
for skill in $repo/*/SKILL.md(N); do
  nome=${skill:h:t}
  alvo=$destino/$nome
  if [[ -e $alvo && ! -L $alvo ]]; then
    echo "$nome: já existe uma pasta de verdade em $alvo. Não mexi: renomeie ou apague e rode de novo."
    continue
  fi
  ln -sfn ${skill:h} $alvo
  echo "$nome -> $alvo"
done
