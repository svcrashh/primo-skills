#!/bin/zsh
# Nome antigo do abrir: a videostudio-app ainda chama por ele. Só traduz as opções e repassa ao
# terminais.py, que é o motor.
# Uso: open-terminal.sh [-n QUANTIDADE] [-p "PROMPT"] [-m MONITOR] [-M MODELO] [PASTA ...]
args=()
while getopts "n:p:m:M:" opt; do
  case "$opt" in
    n) args+=(-n "$OPTARG") ;;
    p) args+=("--prompt=$OPTARG") ;;
    m) args+=(--monitor "$OPTARG") ;;
    M) args+=(--modelo "$OPTARG") ;;
    *) echo "uso: $0 [-n QUANTIDADE] [-p PROMPT] [-m MONITOR] [-M MODELO] [PASTA ...]" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
exec python3 "${0:A:h}/terminais.py" abrir "${args[@]}" "$@"
