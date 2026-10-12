// Dados da marca. Gere com: node <skill>/scripts/logo.mjs caminho/logo.svg > marca-logo.json e cole aqui.
// Esta marca é fictícia — só para a demonstração do motor.
const circulo = (x, y, r) => `M ${x - r},${y} a ${r},${r} 0 1,0 ${2 * r},0 a ${r},${r} 0 1,0 ${-2 * r},0 Z`
const MARCA = {
  nome: 'Demo',
  cores: { fundo: '#F4EFE6', tinta: '#1D1B2F', a: '#FF6B4A', b: '#2E86FF', c: '#1FB889' },
  // logo: partes animáveis no próprio viewBox. transform = o do <g> original do SVG, se houver.
  logo: {
    viewBox: '0 0 300 100', transform: '',
    partes: [
      { nome: 'a', d: circulo(50, 50, 40), fill: '#FF6B4A' },
      { nome: 'b', d: circulo(150, 50, 40), fill: '#2E86FF' },
      { nome: 'c', d: circulo(250, 50, 40), fill: '#1FB889' },
    ],
  },
  simbolo: null,  // versão só símbolo (para o selo), mesmo formato do logo
  formas: [],     // paths de formas oficiais em viewBox 400×400; vazio = formas procedurais
}
