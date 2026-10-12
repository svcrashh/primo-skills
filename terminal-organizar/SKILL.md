---
name: terminal-organizar
description: Organiza as janelas de terminal (Terminal.app no Mac, Windows Terminal no Windows) em grade de quadrados, cada monitor com a sua, ou leva todas para o monitor que eu disser. Use quando eu digitar "/terminal-organizar" ou pedir "organiza os terminais", "arruma as janelas do terminal", "joga os terminais pro notebook/pro monitor".
---

# terminal-organizar

Encaixa as janelas do Terminal numa grade por monitor. A mesma grade vale para o `/terminal-claude`
dos três perfis, que põe cada janela nova no próximo quadrado livre.

**Um só motor para os três perfis:** `~/.claude/skills/terminal-organizar/scripts/organizar.py`.
A Devin enxerga esta pasta pelo link `~/.claude-devin/skills → ~/.claude/skills`, e o
`~/.claude-insiders/skills/terminal-organizar/SKILL.md` é link para este arquivo. Quem usa o motor:
`~/.claude/skills/terminal-claude/scripts/terminais.py`, o motor único do `/terminal-claude` nos três
perfis desde 11/10/2026. Ele importa o módulo e chama `plano_novas()`, que planeja de uma vez os
quadrados de todas as janelas do lote, para cada uma já nascer no lugar.

Mudou a grade? Muda só aqui, vale para todos.

**No Windows** o mesmo `organizar.py` arruma as janelas do Windows Terminal: a grade é igual, e só
ler as telas, ler as janelas e movê-las muda (está no fim do `organizar.py`, sobre o
`scripts/janelas_win.py`). O comando é `python $HOME\.claude\skills\terminal-organizar\scripts\organizar.py`.
**Rodou num Windows de verdade em 12/10/2026**, no Windows Server 2025 do GitHub Actions, com janelas
do Windows Terminal de verdade numa tela de 1920×1080: o `--dry-run` planejou sem mexer, e depois cada
janela caiu no quadrado do plano, conferida lendo de volta a posição e o tamanho (é o
`teste_windows_real.py` do `terminal-claude`). Lá:

- Não existe "notebook": toda tela conta como monitor externo, e `--monitor notebook` não acha nada.
- O `--dry-run` dá o quadrado em coordenadas da tela (esquerda, topo, direita, base; y para baixo).
- Janela minimizada fica de fora, como no Mac.
- Entre duas colunas fica uma fresta de uns 16 px: é a borda invisível que o Windows conta no
  tamanho da janela.
- **Sem prova:** mais de um monitor e tela com escala acima de 100% (o Python lê tudo na escala de
  100%, e o Windows converte). Na primeira vez num desses, rode com `--dry-run`, depois sem, e confira
  que as janelas caíram nos quadrados.

As medidas e as armadilhas abaixo são do Mac.

## A grade

- Grade = colunas × fileiras, qualquer combinação até 8×8. Vale a com **menos quadrados** que caiba
  as janelas, entre as que passam em três testes: célula de pelo menos 500×340 pt
  (`LARGURA_MIN`/`ALTURA_MIN`; era 500×390 até 02/10/2026, quando o dono pediu 10 no vertical), formato de janela de terminal (largura/altura entre
  0,7 e 2,8) e, se der, pelo menos 4 quadrados (`MIN_QUADRADOS`), pra primeira janela já nascer num
  quadrado e não na tela toda. No empate, a de formato mais perto de 1,4 (`PROPORCAO`). É isso que
  faz o monitor em pé virar faixas deitadas (1×4) em vez de 2×2 de janelas finas.
- **O notebook tem mínimo próprio: 360×230** (`MIN_POR_TELA`, 04/10/2026, o dono pediu pra caber
  bem mais nele). Com o mínimo geral ele travava em 2×2: a grade 3×2 dava célula de 490 pt e
  reprovava por 10. Agora vai até 4×3 na Mesa 2 (12 janelas) e 4×4 na Mesa 1 (16). Isso não encolhe
  janela à toa — com 4 abertas ele segue em 2×2, do mesmo tamanho de antes; a grade só aperta
  conforme enche.
- As fileiras têm 20 pt de respiro acima, entre elas e embaixo (`ESPACO`), e as colunas encostam.
- Conta toda janela visível do Terminal, não só as do Claude. Janela minimizada fica de fora.

**Os dois setups, medidos com janelas de verdade em 29/09/2026** (fonte 12):

| Setup | Monitor | Área útil (pt) | Grade conforme enche | Máximo | Janela no máximo |
|---|---|---|---|---|---|
| Mesa 1 | Notebook (à esquerda, escala 1710×1112) | 1710×1074 | 2×2 → 3×2 → 4×2 → 3×3 → 4×3 → 4×4 | 16 | 428×244, ~58×14 (calculado em 04/10/2026) |
| Mesa 1 | Monitor horizontal 2560×1440 (principal) | 2560×1343 | 2×2 → 3×2 → 4×2 → 3×3 → 5×2 → 4×3 → 5×3 | 15 | 512×421, ~68×24 |
| Mesa 2 | Monitor horizontal LS27DG30X 1920×1080 (principal) | 1920×1050 | 2×2 → 3×2 | 6 | 640×495, 86×29 |
| Mesa 2 | Monitor vertical LS27DG30X 1080×1920 (à esquerda) | 1080×1890 | 1×4 → 2×3 → 2×4 → 2×5 | 10 | 540×354, 71×20 (medido em 02/10/2026) |
| Mesa 2 | Notebook (embaixo, escala 1470×956) | 1470×857 | 2×2 → 3×2 → 4×2 → 3×3 → 4×3 | 12 | 368×259, ~50×15 (medido em 04/10/2026) |

O nome de cada monitor sai da orientação: "Notebook", "Monitor horizontal", "Monitor vertical"
(numerados se houver dois iguais). O macOS lembra a escala do notebook por arranjo de telas, por
isso ele muda de tamanho entre as mesas.

**Janela nova (aberta pelo `/terminal-claude`):**
- vai para o monitor que eu pedir; se ele estiver cheio, para o outro com vaga, com aviso;
- sem pedido, para o monitor que já tem mais terminais e ainda tem vaga;
- sem nenhum terminal aberto, para o notebook (`MONITOR_PADRAO`);
- ocupa o primeiro quadrado livre, lendo da esquerda para a direita e de cima para baixo. As que já
  estão lá ficam no quadrado delas. Se a grade muda (a quinta janela transforma 2×2 em 3×2, ou 1×4
  em 2×3 no vertical), as daquele monitor se reorganizam em ordem de leitura. Os outros monitores
  não se mexem.

**Armadilhas do Terminal e do macOS:**
- O Terminal lê `bounds` em relação ao monitor principal, mas grava em relação ao monitor onde a
  janela está. Gravar `bounds` numa janela do notebook faz ela descer 328 pt (1440 − 1112) e sair da
  tela. Por isso o motor grava `frame`, que é global e tem o y para cima.
- O monitor vertical da Mesa 2 informa a área útil sem descontar a barra de menu, mas o macOS não
  deixa a janela subir nela: a fileira de cima descia 30 pt e comia o respiro. O motor desconta a
  altura da barra do monitor principal quando a tela não desconta.

## 1. Escolher o modo

- **Sem monitor no pedido** ("organiza os terminais"): cada janela fica no monitor onde está e só
  se encaixa. Se um monitor tiver mais janelas do que cabem, as últimas em ordem de leitura vão
  para o outro.
- **Com monitor** ("joga tudo pro notebook", "tudo no vertical"): `--monitor` com `notebook`,
  `horizontal`, `vertical` ou `externo` (o maior monitor que não é o notebook). Leva todas para lá;
  o que não couber vai para outro com vaga.

Não pergunta.

## 2. Rodar

```sh
python3 ~/.claude/skills/terminal-organizar/scripts/organizar.py [--monitor notebook|horizontal|vertical|externo]
```

No Windows, no PowerShell: `python $HOME\.claude\skills\terminal-organizar\scripts\organizar.py`.

`--dry-run` mostra para onde cada janela iria, em `frame` (coordenadas globais, y para cima), sem
mexer em nada.

Mover e redimensionar não interrompe o que roda na janela: o Claude só redesenha na largura nova.

Depois de encaixar, o motor traz todas as janelas do Terminal para a frente e ativa o Terminal.
Sem isso, quem cai atrás do Chrome ou do VS Code parece não ter saído do lugar *(29/09/2026)*.
O `/terminal-claude` não precisa disso: a janela nova já nasce na frente.

## 3. Responder

Uma linha por monitor, como a saída do script ("Notebook: 4 janelas na grade 2×2"), mais os avisos
se vieram. Se falhar por permissão de Automação (erro -1743), o caminho é Ajustes do Sistema >
Privacidade e Segurança > Automação > (app desta sessão) > Terminal.
