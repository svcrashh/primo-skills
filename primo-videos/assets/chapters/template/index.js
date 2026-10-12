// O índice do vídeo: a abertura o preenche, cada capítulo abre com o cartão dele, o fecho o mostra inteiro.
// `pasta` é a pasta do capítulo em scenes/; a ordem aqui é a ordem do vídeo.
const MARCA_NOME = 'Brand'                  // o nome como o logo escreve
const ENDERECO = 'brand.example'            // o que fica no fecho, embaixo do logo
// Slogan do fecho: copiado do produto (o <meta description>, o hero do site, o título da página), nunca inventado.
// '' = sem slogan.
const SLOGAN = ''
const INDICE = [
  { n: 1, nome: 'Example', secao: 'Dashboard', pasta: '01-example' },
  { n: 2, nome: 'Second item', secao: 'Dashboard', pasta: '02-segundo' },
  { n: 3, nome: 'Third item', secao: 'Account', pasta: '03-terceiro' },
]
// Números do fecho: só os verdadeiros, tirados do que o vídeo mostrou.
const NUMEROS = [{ valor: 12, rotulo: 'templates' }, { valor: 3, rotulo: 'languages' }]
