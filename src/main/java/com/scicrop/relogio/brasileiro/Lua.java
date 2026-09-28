package com.scicrop.relogio.brasileiro;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.geom.Arc2D;
import java.awt.geom.Area;
import java.awt.geom.Ellipse2D;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * A conta das fases da Lua e o desenho do disco, separados da tela para poder
 * ser usados em mais de um lugar.
 *
 * O ciclo e contado a partir de uma lua nova conhecida, em lunacoes de
 * duracao media. E uma aproximacao: a orbita da Lua nao e regular, entao a
 * data de cada fase pode sair com meio dia de erro.
 *
 * Os desenhos seguem o ceu do hemisferio sul: a Lua crescente aparece
 * iluminada do lado esquerdo, e a minguante do lado direito.
 *
 */
public final class Lua
{
	/** Duracao do ciclo completo das fases, vistas da Terra. */
	public static final double MES_SINODICO = 29.530588853;

	/** Lua nova conhecida, usada como ponto de partida da contagem. */
	private static final Instant LUA_NOVA_DE_REFERENCIA = Instant.parse("2000-01-06T18:14:00Z");

	public static final String[] NOMES = { "Lua nova", "Crescente côncava", "Quarto crescente",
			"Crescente gibosa", "Lua cheia", "Minguante gibosa", "Quarto minguante", "Minguante côncava" };

	private Lua() {
	}

	/** Quanto do ciclo ja passou, de 0 na lua nova a 1 na lua nova seguinte. */
	public static double fracaoDoCiclo(Instant agora) {
		double dias = java.time.Duration.between(LUA_NOVA_DE_REFERENCIA, agora).toSeconds() / 86400d;
		double fracao = (dias / MES_SINODICO) % 1;
		return fracao < 0 ? fracao + 1 : fracao;
	}

	/** Quanto do disco aparece iluminado, de 0 na lua nova a 1 na cheia. */
	public static double iluminacao(double fracao) {
		return (1 - Math.cos(fracao * 2 * Math.PI)) / 2;
	}

	public static double idadeEmDias(double fracao) {
		return fracao * MES_SINODICO;
	}

	public static int indiceDaFase(double fracao) {
		return (int) Math.round(fracao * NOMES.length) % NOMES.length;
	}

	public static String nomeDaFase(double fracao) {
		return NOMES[indiceDaFase(fracao)];
	}

	/** Quantos dias faltam ate o ciclo chegar em uma fase, como 0 ou 0,5. */
	public static double diasAte(double fracao, double alvo) {
		double falta = alvo - fracao;
		if (falta <= 0) {
			falta += 1;
		}
		return falta * MES_SINODICO;
	}

	public static LocalDate dataDaqui(Instant agora, double dias) {
		return LocalDate.ofInstant(agora.plusSeconds((long) (dias * 86400)), ZoneId.systemDefault());
	}

	/**
	 * A Lua como ela aparece daqui: o disco escuro com a parte iluminada por
	 * cima, recortada pelo terminador, que e uma elipse que vai estreitando.
	 *
	 * @param fracao ponto do ciclo, de 0 na lua nova a 0,5 na cheia
	 */
	public static void desenharDisco(Graphics2D g2, int x, int y, int raio, double fracao,
			Color clara, Color escura, Color borda) {
		g2.setColor(escura);
		g2.fillOval(x - raio, y - raio, raio * 2, raio * 2);

		boolean crescente = fracao < 0.5;
		double largura = raio * Math.abs(Math.cos(fracao * 2 * Math.PI));

		Area iluminada = new Area(new Arc2D.Double(x - raio, y - raio, raio * 2, raio * 2,
				crescente ? 90 : 270, 180, Arc2D.PIE));
		Area terminador = new Area(new Ellipse2D.Double(x - largura, y - raio, largura * 2, raio * 2));
		if (iluminacao(fracao) > 0.5) {
			iluminada.add(terminador);
		} else {
			iluminada.subtract(terminador);
		}

		g2.setColor(clara);
		g2.fill(iluminada);
		g2.setColor(borda);
		g2.setStroke(new BasicStroke(1));
		g2.drawOval(x - raio, y - raio, raio * 2, raio * 2);
	}
}
