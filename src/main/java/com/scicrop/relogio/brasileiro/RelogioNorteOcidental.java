package com.scicrop.relogio.brasileiro;

import java.awt.Graphics2D;
import java.time.LocalTime;

/**
 * Relogio analogico convencional: a volta completa vale 12 horas para o
 * ponteiro das horas, 60 minutos para o dos minutos e 60 segundos para o
 * dos segundos.
 *
 */
public class RelogioNorteOcidental extends Relogio
{
	public RelogioNorteOcidental() {
		super("RelogioNorteOcidental", 1000);
	}

	protected int marcacoesPorVolta() {
		return 12;
	}

	protected String rotuloDaMarcacao(int marcacao) {
		return marcacao == 0 ? "12" : super.rotuloDaMarcacao(marcacao);
	}

	protected void desenharPonteiros(Graphics2D g2) {
		LocalTime agora = LocalTime.now();

		double segundos = agora.getSecond();
		double minutos = agora.getMinute() + segundos / 60;
		double horas = agora.getHour() % 12 + minutos / 60;

		desenharPonteiro(g2, horas / 12, 0.5, 6, COR_PONTEIRO_MAIOR);
		desenharPonteiro(g2, minutos / 60, 0.75, 4, COR_PONTEIRO_MEDIO);
		desenharPonteiro(g2, segundos / 60, 0.9, 2, COR_PONTEIRO_MENOR);
	}
}
