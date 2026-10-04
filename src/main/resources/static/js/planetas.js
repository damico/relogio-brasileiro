// O que os tres modos do ceu compartilham sobre os planetas: a cor de cada um
// e a regra de quando o olho nu o enxerga.

export const COR_PLANETA = {
  'Mercúrio': '#cbbfae', 'Vênus': '#fff3c4', 'Marte': '#ff7a4d', 'Júpiter': '#ffe0b0',
  'Saturno': '#e8d08a', 'Urano': '#9fe8e8', 'Netuno': '#7aa0ff',
};

/**
 * A magnitude mais fraca que se enxerga: o limite da vista, que cai perto do
 * horizonte (a luz atravessa mais atmosfera, cerca de 0,25 por massa de ar) e
 * despenca com a claridade do ceu, ate cerca de -3,5 em pleno dia, quando so
 * Venus aparece.
 */
export function limiteDeVisibilidade(limiteBase, claridade, alturaGraus) {
  const extincao = 0.25 * (1 / Math.max(Math.sin(alturaGraus * Math.PI / 180), 0.02) - 1);
  return limiteBase - claridade * (limiteBase + 3.5) - extincao;
}

export function planetaVisivel(p, limiteBase, claridade) {
  return p.altura > 0 && p.magnitude <= limiteDeVisibilidade(limiteBase, claridade, p.altura);
}
