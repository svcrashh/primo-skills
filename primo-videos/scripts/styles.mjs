// Os estilos que o motor sabe fazer: o que cada um é, para que serve, o que ele precisa da pessoa e o molde que o faz.
// É a única lista: o catálogo (catalog.mjs) mostra todos; a tabela de recomendação (recommend-style.mjs) usa os que têm
// ficha em references/catalog/styles/. Nenhum estilo traz marca: a cor, a fonte, o logo e o conteúdo são de quem pede.
//
// molde = a página que diz como renderizar; exemplo = o exemplo de formato do molde (cinzas e textos de marcador).
// tipo = o assunto que o estilo carrega melhor (o filtro do catálogo).
export const TIPOS = ['product-screen', 'concept', 'numbers', 'chat-and-command', 'announcement']

export const ESTILOS = {
  'real-screen-camera': {
    nome: 'Real screen with camera', tipo: 'product-screen', molde: 'templates/real-screen-camera/TEMPLATE.md', exemplo: 'templates/real-screen-camera/example.json',
    frase: 'the product\'s real screen, with the camera going to the current field and a scrim over the rest; step card and "Done!" at the end',
    serve: 'teaching one task on the product\'s real screen',
    precisa: 'access to the product (address, test account), the task step by step and the sentence of each step',
    pt: { nome: 'Tela real com câmera', frase: 'a tela real do produto, com a câmera indo ao campo da vez e um véu sobre o resto; cartão de passo e "Pronto!" no fim', serve: 'ensinar uma tarefa na tela real do produto', precisa: 'acesso ao produto (endereço, conta de teste), a tarefa passo a passo e a frase de cada passo' },
  },
  'panel-tutorial': {
    nome: 'Panel tutorial', tipo: 'product-screen', ficha: false, molde: 'references/tutorial.md', exemplo: 'assets/example/computer-tutorial-series',
    frase: 'the recorded screen of a web tool on a 3D panel, with sections, steps and zoom on the detail; the text never sits over the screen',
    serve: 'teaching a web tool on the computer, as a series',
    precisa: 'the tool\'s address (or local preview) and a test account, the steps of one task and what to blur',
    pt: { nome: 'Tutorial em painel', frase: 'a tela gravada de uma ferramenta web num painel 3D, com seções, passos e zoom no detalhe; o texto nunca fica sobre a tela', serve: 'ensinar uma ferramenta web no computador, em série', precisa: 'o endereço da ferramenta (ou a prévia local) e uma conta de teste, os passos de uma tarefa e o que borrar' },
  },
  'typing-text': {
    nome: 'Typing text', tipo: 'chat-and-command', molde: 'templates/typing-text/TEMPLATE.md', exemplo: 'templates/typing-text/example.json',
    frase: 'the question or request written on screen from frame 0, and the product answering',
    serve: 'a product with a text box: search, AI, chat',
    precisa: 'the request as a person would type it and the product\'s real answer',
    pt: { nome: 'Texto que se digita', frase: 'a pergunta ou o pedido escrito na tela desde o quadro 0, e o produto respondendo', serve: 'produto com caixa de texto: busca, IA, chat', precisa: 'o pedido como a pessoa digitaria e a resposta real do produto' },
  },
  'typing-terminal': {
    nome: 'Typing terminal', tipo: 'chat-and-command', ficha: false, molde: 'templates/typing-terminal/TEMPLATE.md', exemplo: 'templates/typing-terminal/example.json',
    frase: 'commands typed in a terminal window, with the real output of each one',
    serve: 'a command-line tool: install, run, see the result',
    precisa: 'the commands, run for real (the output is recorded), with nothing private in it',
    pt: { nome: 'Terminal que se digita', frase: 'comandos digitados numa janela de terminal, com a saída real de cada um', serve: 'ferramenta de linha de comando: instalar, rodar, ver o resultado', precisa: 'os comandos, rodados de verdade (a saída é gravada), sem nada privado nela' },
  },
  'rolling-list': {
    nome: 'Rolling list', tipo: 'announcement', molde: 'templates/rolling-list/TEMPLATE.md', exemplo: 'templates/rolling-list/example.json',
    frase: 'each new feature is a short sentence + the proof on screen, as a burst, list or poster card, and the wall with everything at the end',
    serve: 'many new features in a short time',
    precisa: 'one short sentence and one proof on screen per item',
    pt: { nome: 'Lista que corre', frase: 'cada novidade é uma frase curta + a prova na tela, em rajada, lista ou cartaz, e o mural com tudo no fim', serve: 'muitas novidades em pouco tempo', precisa: 'uma frase curta e uma prova na tela por item' },
  },
  'counting-number': {
    nome: 'Counting number', tipo: 'numbers', molde: 'templates/counting-number/TEMPLATE.md', exemplo: 'templates/counting-number/example.json',
    frase: 'a single giant number with a three-word label; a 6–20 s video or an opening/closing block',
    serve: 'one result that fits in one number',
    precisa: 'a true number with its source and a three-word label',
    pt: { nome: 'Número que conta', frase: 'um único número gigante com um rótulo de três palavras; um vídeo de 6–20 s ou um bloco de abertura ou fecho', serve: 'um resultado que cabe num número', precisa: 'um número verdadeiro, com a fonte, e um rótulo de três palavras' },
  },
  'before-after': {
    nome: 'Before and after', tipo: 'product-screen', molde: 'templates/before-after/TEMPLATE.md', exemplo: 'templates/before-after/example.json',
    frase: 'the same screen in the same place in two states, cut on the click (or the zoom-out that reveals the whole)',
    serve: 'showing a change',
    precisa: 'the same screen in two states and what triggers the change',
    pt: { nome: 'Antes e depois', frase: 'a mesma tela no mesmo lugar em dois estados, com o corte no clique (ou o zoom-out que revela o todo)', serve: 'mostrar uma mudança', precisa: 'a mesma tela em dois estados e o que dispara a mudança' },
  },
  'light-trail-teaser': {
    nome: 'Light-trail teaser', tipo: 'announcement', molde: 'templates/light-trail-teaser/TEMPLATE.md', exemplo: 'templates/light-trail-teaser/example.json',
    frase: 'dark background, a line of light draws pieces of the interface and reveals the product at the end; made to be remembered',
    serve: 'creating expectation before a launch',
    precisa: 'two to four pieces of the interface, the promise line and the screen to reveal',
    pt: { nome: 'Teaser de luz', frase: 'fundo escuro, uma linha de luz desenha pedaços da interface e revela o produto no fim; feito para ser lembrado', serve: 'criar expectativa antes de um lançamento', precisa: 'dois a quatro pedaços da interface, a frase da promessa e a tela a revelar' },
  },
  'chapters-with-index': {
    nome: 'Chapters with index', tipo: 'announcement', molde: 'references/chapters.md', exemplo: 'assets/chapters',
    frase: 'opening with a numbered index, one poster-card chapter per new feature with the interface redrawn, closing with the full index',
    serve: 'several new features or topics, one chapter each',
    precisa: 'three to six topics with a title and a line each, and the product\'s real media to redraw the interface',
    pt: { nome: 'Capítulos com índice', frase: 'abertura com índice numerado, um capítulo em cartaz por novidade com a interface redesenhada, fecho com o índice completo', serve: 'várias novidades ou assuntos, um capítulo para cada', precisa: 'três a seis assuntos com título e uma linha cada, e a mídia real do produto para redesenhar a interface' },
  },
  'drawn-explainer': {
    nome: 'Drawn explainer', tipo: 'concept', molde: 'templates/drawn-explainer/TEMPLATE.md', exemplo: 'templates/drawn-explainer/example.json',
    frase: 'the idea drawn on the word of the line: boxes, arrows, icons, a chart and a counting number, and the interface demo with a cursor, in the brand colors',
    serve: 'explaining an idea, a flow or how something works inside',
    precisa: 'the idea in three to six sentences, the names of the parts and a true number, if there is one',
    pt: { nome: 'Explicação desenhada', frase: 'a ideia desenhada na palavra da frase: caixas, setas, ícones, um gráfico e um número que conta, e a demo da interface com cursor, nas cores da marca', serve: 'explicar uma ideia, um fluxo ou como algo funciona por dentro', precisa: 'a ideia em três a seis frases, os nomes das partes e um número verdadeiro, se houver' },
  },
  'kinetic-typography': {
    nome: 'Kinetic typography', tipo: 'announcement', molde: 'templates/kinetic-typography/TEMPLATE.md', exemplo: 'templates/kinetic-typography/example.json',
    frase: 'big words that come in, stack and rearrange to the beat of the soundtrack; facts only (names, numbers)',
    serve: 'a message in few words, on the beat',
    precisa: 'three to six short sentences with facts',
    pt: { nome: 'Tipografia cinética', frase: 'palavras grandes que entram, empilham e se rearranjam no tempo da trilha; só fatos (nomes, números)', serve: 'uma mensagem em poucas palavras, no tempo da música', precisa: 'três a seis frases curtas com fatos' },
  },
  'card-bento': {
    nome: 'Bento grid', tipo: 'concept', molde: 'templates/card-bento/TEMPLATE.md', exemplo: 'templates/card-bento/example.json',
    frase: 'a grid of cards of different sizes that builds up piece by piece, each with an icon and a mini-visual; the camera visits each card',
    serve: 'a product with several features at once',
    precisa: 'four to eight features, each with a title, a line and an icon or a mini-visual',
    pt: { nome: 'Bento de cartões', frase: 'uma grade de cartões de tamanhos diferentes que se monta peça por peça, cada um com ícone e mini-visual; a câmera visita cada cartão', serve: 'um produto com várias funções de uma vez', precisa: 'quatro a oito funções, cada uma com título, uma linha e um ícone ou mini-visual' },
  },
  'card-stack': {
    nome: 'Card stack', tipo: 'concept', molde: 'templates/card-stack/TEMPLATE.md', exemplo: 'templates/card-stack/example.json',
    frase: 'stacked cards that leave one by one (swipe or flip) with the "2/5" counter; one tip, one step or one rule per card',
    serve: 'tips, steps or rules, one at a time',
    precisa: 'three to six cards with a title and a line, and the title of the series',
    pt: { nome: 'Pilha de cartões', frase: 'cartões empilhados que saem um a um (deslize ou virada) com o contador "2/5"; uma dica, um passo ou uma regra por cartão', serve: 'dicas, passos ou regras, um de cada vez', precisa: 'três a seis cartões com título e uma linha, e o título da série' },
  },
  'chat-bubbles': {
    nome: 'Chat bubbles', tipo: 'chat-and-command', molde: 'templates/chat-bubbles/TEMPLATE.md', exemplo: 'templates/chat-bubbles/example.json',
    frase: 'the conversation with the product in chat bubbles: the request, the question back, the answer with the file or the list',
    serve: 'showing how to ask and what comes back',
    precisa: 'the real conversation: the request, the question back and the answer',
    pt: { nome: 'Conversa em balões', frase: 'a conversa com o produto em balões: o pedido, a pergunta de volta, a resposta com o arquivo ou a lista', serve: 'mostrar como pedir e o que volta', precisa: 'a conversa real: o pedido, a pergunta de volta e a resposta' },
  },
  'ticking-checklist': {
    nome: 'Ticking checklist', tipo: 'concept', molde: 'templates/ticking-checklist/TEMPLATE.md', exemplo: 'templates/ticking-checklist/example.json',
    frase: 'items that get ticked ✓ or struck through ✕ with the counter; do\'s and don\'ts, requirements, checks',
    serve: 'what it does and does not do, requirements, checks',
    precisa: 'four to eight items that can be verified, each one marked done or not',
    pt: { nome: 'Checklist que marca', frase: 'itens que ganham ✓ ou são riscados ✕ com o contador; faz e não faz, requisitos, conferências', serve: 'o que faz e o que não faz, requisitos, conferências', precisa: 'quatro a oito itens verificáveis, cada um marcado como feito ou não' },
  },
  'growing-chart': {
    nome: 'Growing chart', tipo: 'numbers', molde: 'templates/growing-chart/TEMPLATE.md', exemplo: 'templates/growing-chart/example.json',
    frase: 'bars, columns, line or donut that draw themselves with the numbers counting, always with the data source',
    serve: 'data over time or compared',
    precisa: 'the numbers with their source, the unit and the title',
    pt: { nome: 'Gráfico que cresce', frase: 'barras, colunas, linha ou rosca que se desenham com os números contando, sempre com a fonte do dado', serve: 'dado ao longo do tempo ou comparado', precisa: 'os números com a fonte, a unidade e o título' },
  },
  timeline: {
    nome: 'Timeline', tipo: 'concept', molde: 'templates/timeline/TEMPLATE.md', exemplo: 'templates/timeline/example.json',
    frase: 'an axis with milestones that light up in order and the camera moving along it; stages, history, roadmap',
    serve: 'stages, history, roadmap',
    precisa: 'four to seven milestones, each with a date or a step and a short label',
    pt: { nome: 'Linha do tempo', frase: 'um eixo com marcos que acendem em ordem e a câmera andando por ele; etapas, história, roteiro', serve: 'etapas, história, roteiro do que vem', precisa: 'quatro a sete marcos, cada um com data ou etapa e um rótulo curto' },
  },
  'phone-3d': {
    nome: '3D phone', tipo: 'product-screen', molde: 'templates/phone-3d/TEMPLATE.md', exemplo: 'templates/phone-3d/example.json',
    frase: 'a 3D phone with the real recorded screen, scrolling and with a tap, and the text beside it',
    serve: 'a phone app or site, shown on the device',
    precisa: 'the app\'s address (or its screen at phone width) and where to scroll and tap',
    pt: { nome: 'Celular 3D', frase: 'um celular 3D com a tela real gravada, rolando e com um toque, e o texto ao lado', serve: 'um app ou site de celular, mostrado no aparelho', precisa: 'o endereço do app (ou a tela dele em largura de celular) e onde rolar e tocar' },
  },
  'infinite-zoom': {
    nome: 'Infinite zoom', tipo: 'product-screen', molde: 'templates/infinite-zoom/TEMPLATE.md', exemplo: 'templates/infinite-zoom/example.json',
    frase: 'the camera goes into a detail of the screen, which becomes the next screen, over 3 or 4 levels without a cut',
    serve: 'going from the whole to the detail without a cut',
    precisa: 'three or four screens where each one contains the next',
    pt: { nome: 'Zoom infinito', frase: 'a câmera entra num detalhe da tela, que vira a tela seguinte, por 3 ou 4 níveis sem corte', serve: 'ir do todo ao detalhe sem corte', precisa: 'três ou quatro telas em que cada uma contém a seguinte' },
  },
  'drawn-flow': {
    nome: 'Drawn flow', tipo: 'concept', molde: 'templates/drawn-flow/TEMPLATE.md', exemplo: 'templates/drawn-flow/example.json',
    frase: 'nodes and arrows that draw themselves and light up as the request passes; architecture, process, where the data comes from',
    serve: 'architecture, process, where the data goes',
    precisa: 'four to eight nodes, the arrows between them and where the path stops',
    pt: { nome: 'Fluxo desenhado', frase: 'nós e setas que se desenham e acendem quando o pedido passa; arquitetura, processo, de onde vem o dado', serve: 'arquitetura, processo, para onde o dado vai', precisa: 'quatro a oito nós, as setas entre eles e onde o caminho para' },
  },
  isometric: {
    nome: 'Isometric', tipo: 'concept', molde: 'templates/isometric/TEMPLATE.md', exemplo: 'templates/isometric/example.json',
    frase: 'isometric blocks that stack in layers, with the labels beside them; the layers of a system or a bundle',
    serve: 'the layers of a system or of a bundle',
    precisa: 'three to five layers, each with a name and how many blocks it has',
    pt: { nome: 'Isométrico', frase: 'blocos isométricos que se empilham em camadas, com os rótulos ao lado; as camadas de um sistema ou de um pacote', serve: 'as camadas de um sistema ou de um pacote', precisa: 'três a cinco camadas, cada uma com nome e quantos blocos tem' },
  },
  'photo-mosaic': {
    nome: 'Photo mosaic', tipo: 'announcement', molde: 'templates/photo-mosaic/TEMPLATE.md', exemplo: 'templates/photo-mosaic/example.json',
    frase: 'the brand\'s own photos in a grid that rearranges, with the label in its own strip',
    serve: 'a brand moment told in photos',
    precisa: 'six to twelve photos the brand owns and may use, and a short label per stage',
    pt: { nome: 'Mosaico de fotos', frase: 'as fotos da própria marca numa grade que se rearranja, com o rótulo numa faixa só dele', serve: 'um momento da marca contado em fotos', precisa: 'seis a doze fotos que a marca tem e pode usar, e um rótulo curto por etapa' },
  },
}

/** O estilo na língua pedida: { id, nome, frase, serve, precisa, tipo, molde, exemplo }. */
export function estilo(id, lingua = 'en') {
  const e = ESTILOS[id]
  if (!e) return null
  const t = lingua === 'pt' ? e.pt : e
  return { id, nome: t.nome, frase: t.frase, serve: t.serve, precisa: t.precisa, tipo: e.tipo, molde: e.molde, exemplo: e.exemplo }
}
