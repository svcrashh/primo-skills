// Esqueleto do brand.js para o motor HTML (assets/template, capítulos, tutorial). Não é uma marca: é o FORMATO, em
// cinzas neutros e com marcadores no lugar do logo. Copie para a pasta da série ou do projeto como brand.js e troque
// cada valor pelo que a leitura do produto da pessoa achou (o site, o app, o guia de marca dela): as cores com o papel
// de cada uma, os pares de texto, a fonte e o logo.
//
// Esta é a cópia de assets/example/brand.js que vai com a série de tutorial de computador (o compor lê a marca da
// pasta da série).
//
// O logo daqui é uma imagem (PNG), e por isso `logo` e `simbolo` ficam null: o motor não monta o logo traçado nem o
// logo 3D peça por peça. O tutorial usa o `png` abaixo: o compor acha cada arquivo na pasta da série (o caminho daqui,
// ou <série>/media/) e põe o logo no painel da abertura do cinema e no fecho só com o logo ("ordem": "so-logo"). Fora
// do tutorial, copie o PNG para <project>/media/ e chame imagem(root, MARCA.png.logo, …) onde ele precisar aparecer.
// A marca que tem o logo em SVG preenche `logo` (node <skill>/scripts/logo.mjs logo.svg --js LOGO) e dispensa o `png`.
// Use o arquivo que a marca entrega: não redesenhe nem vetorize o logo de alguém para preencher isto.
const MARCA = {
  nome: 'Your brand',   // o nome da marca, como ela se escreve
  cores: {
    // as chaves que o motor lê: template (fundo, tinta, a, b, c) e tutorial (fundo, tinta, marca, acento)
    fundo: '#F5F5F5',   // o fundo de conteúdo
    tinta: '#1D1D1D',   // o texto sobre esse fundo
    marca: '#848484',   // a cor principal da marca: o destaque. Como texto, só nos pares abaixo
    acento: '#979797',  // a segunda cor
    a: '#848484', b: '#979797', c: '#D6D6D6',   // as três cores do template: a principal, a segunda e a terceira
    // O resto da paleta, pelo papel de cada cor: são os nomes que o series.json usa no visual. Ponha os tons que a
    // marca tem, com os nomes que fizerem sentido para ela; o que a série não usa pode sair.
    claro: '#F5F5F5', escuro: '#1D1D1D',            // os neutros: o claro e o escuro
    superficie: '#EBEBEB', superficie2: '#DEDEDE',  // as superfícies claras: cartão, barra do navegador
    marcaEscura: '#2C2C2C', marcaMedia: '#A8A8A8', marcaClara: '#C7C7C7', marcaSuave: '#EFEFEF',     // os tons da cor principal
    acentoEscuro: '#1B1B1B', acentoForte: '#505050', acentoClaro: '#D4D4D4', acentoSuave: '#E6E6E6',  // os tons da segunda cor
    apoio: '#D6D6D6', apoioEscuro: '#383838', apoioMedio: '#666666', apoioClaro: '#E8E8E8',           // a terceira cor (pílula, etiqueta) e os tons dela
  },
  // Texto sobre cor, só nestes pares: [fundo, texto, nota]. Liste os que o guia da marca aprova ou os que você mediu
  // (WCAG): AAA e AA valem para qualquer texto; AA18, só para título grande ou peça de marca. Com a lista, o tutorial
  // recusa qualquer par fora dela; sem `pares`, ele confere só o contraste.
  pares: [
    ['#F5F5F5', '#1D1D1D', 'AAA'], ['#EBEBEB', '#1D1D1D', 'AAA'], ['#DEDEDE', '#1D1D1D', 'AAA'], ['#1D1D1D', '#F5F5F5', 'AAA'],
    ['#505050', '#F5F5F5', 'AAA'], ['#383838', '#D6D6D6', 'AAA'], ['#D6D6D6', '#383838', 'AAA'],
    ['#1B1B1B', '#979797', 'AA'], ['#979797', '#1B1B1B', 'AA'], ['#E6E6E6', '#505050', 'AA'], ['#F5F5F5', '#505050', 'AA'],
    ['#2C2C2C', '#A8A8A8', 'AA'], ['#A8A8A8', '#2C2C2C', 'AA'], ['#666666', '#F5F5F5', 'AA'], ['#E8E8E8', '#666666', 'AA'],
    ['#F5F5F5', '#666666', 'AA'],
    ['#848484', '#F5F5F5', 'AA18'], ['#F5F5F5', '#848484', 'AA18'], ['#EFEFEF', '#848484', 'AA18'],
  ],
  // A família e os pesos da marca (scripts/fonts.mjs traz a fonte para a pasta). A Inter é só a fonte neutra dos
  // exemplos (scripts/example-fonts.mjs).
  fonte: { familia: 'Inter', titulo: 700, subtitulo: 600, corpo: 500, entrelinhaTitulo: 0.8, entrelinhaCorpo: 1.15 },
  raio: 40,             // o canto dos cartões e blocos da marca, em px
  // O logo e o símbolo em imagem, com o caminho dentro da pasta da série ou do projeto. O tutorial escolhe pelo fundo:
  // `logo` no claro, `logoClaro` no escuro ou na cor forte. As outras chaves têm o nome que você quiser (o fundo
  // "simbolo" do tutorial pede uma delas pelo nome).
  png: {
    logo: 'media/logo-placeholder.png',                  // o logo para fundo claro
    logoClaro: 'media/logo-placeholder-light.png',       // o logo para fundo escuro, cor forte ou foto
    simbolo: 'media/symbol-placeholder.png',             // o símbolo sozinho, na versão escura
    simboloClaro: 'media/symbol-placeholder-light.png',  // o símbolo sozinho, na versão clara
  },
  // Onde a regra do claro e do escuro erra para esta marca: fundo → a chave do `png` que vai sobre ele, ou null quando
  // a marca não tem logo para essa cor (aí o tutorial manda trocar a cor). Aqui, os dois cinzas médios em que o
  // marcador escuro se lê melhor que o claro.
  pngPorFundo: { '#979797': 'logo', '#A8A8A8': 'logo' },
  logo: null,           // o logo em SVG, em partes animáveis: { viewBox, transform, partes: [{ nome, d, fill }] }
  simbolo: null,        // só o símbolo, no mesmo formato do logo
  formas: [],           // paths das formas oficiais da marca (viewBox 400×400); vazio = as formas procedurais do motor
}
