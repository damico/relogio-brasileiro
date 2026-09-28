package com.scicrop.relogio.brasileiro;

import java.awt.Graphics2D;
import java.time.LocalTime;

/**
 * Relogio em coordenadas do globo terrestre: a hora do dia vira o angulo ja
 * girado pela Terra (15 graus por hora) e esse angulo e lido em graus,
 * minutos e segundos de arco. Por isso os ponteiros ficam em angulos
 * diferentes dos do relogio convencional:
 *
 * - ponteiro dos graus: uma volta a cada 360 graus, ou seja um dia inteiro;
 * - ponteiro dos minutos de arco: uma volta a cada grau, ou 4 minutos de relogio;
 * - ponteiro dos segundos de arco: uma volta a cada minuto de arco, ou 4 segundos de relogio.
 *
 */
public class RelogioNorteOcidentalGlobal extends Relogio
{
	private static final double NANOS_POR_HORA = 3_600_000_000_000d;
	private static final double GRAUS_POR_HORA = 15;

	public RelogioNorteOcidentalGlobal() {
		super("RelogioNorteOcidentalGlobal", 50);
	}

	/**
	 * Uma volta do ponteiro dos graus e um dia inteiro, entao o mostrador
	 * tem as 24 horas, de 15 em 15 graus.
	 */
	protected int marcacoesPorVolta() {
		return 24;
	}

	/**
	 * Do lado de fora vai a escala em graus, de 15 em 15.
	 */
	protected String rotuloExterno(int marcacao) {
		return (int) (marcacao * GRAUS_POR_HORA) + "\u00b0";
	}

	protected void desenharPonteiros(Graphics2D g2) {
		LocalTime agora = LocalTime.now();

		double graus = agora.toNanoOfDay() / NANOS_POR_HORA * GRAUS_POR_HORA;
		double minutosDeArco = (graus - Math.floor(graus)) * 60;
		double segundosDeArco = (minutosDeArco - Math.floor(minutosDeArco)) * 60;

		desenharPonteiro(g2, graus / 360, 0.5, 6, COR_PONTEIRO_MAIOR);
		desenharPonteiro(g2, minutosDeArco / 60, 0.75, 4, COR_PONTEIRO_MEDIO);
		desenharPonteiro(g2, segundosDeArco / 60, 0.9, 2, COR_PONTEIRO_MENOR);
	}
}
