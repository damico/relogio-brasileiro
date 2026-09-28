package com.scicrop.relogio.brasileiro;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.MonthDay;
import java.util.Locale;

import javax.swing.JPanel;
import javax.swing.Timer;

/**
 * Posicao da Terra na sua orbita em torno do Sol, na data de hoje, com o
 * perielio e o afelio marcados, os solsticios e equinocios, e um mostrador da
 * distancia atual ate o Sol.
 *
 * O Sol fica em um dos focos da elipse e a orbita e percorrida no sentido
 * anti-horario. O angulo e contado a partir do perielio, o ponto mais proximo
 * do Sol, por onde a Terra passa todo dia 3 de janeiro.
 *
 * Os solsticios nao tem nada a ver com a distancia ate o Sol: eles dependem da
 * inclinacao do eixo da Terra, de 23,44 graus, que aponta sempre para a mesma
 * direcao no espaco, perto da estrela polar. Por isso as quatro Terras
 * pequenas sao desenhadas com o eixo paralelo entre si: no solsticio de junho
 * o hemisferio norte fica virado para o Sol, e no de dezembro, o sul.
 *
 */
public class OrbitaTerraSol extends JPanel
{
	private static final Color COR_SOL = new Color(255, 190, 0);
	private static final Color COR_TERRA = new Color(0, 90, 200);
	private static final Color COR_ORBITA = new Color(120, 120, 120);
	private static final Color COR_RAIO = new Color(245, 205, 110);
	private static final Color COR_PONTEIRO = Color.RED;
	private static final Color COR_LUA_CLARA = new Color(250, 250, 235);
	private static final Color COR_LUA_ESCURA = new Color(70, 70, 85);

	private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

	/** Excentricidade da orbita da Terra: quase um circulo. */
	private static final double EXCENTRICIDADE = 0.0167086;

	/** Semi eixo maior da orbita, a distancia media ate o Sol. */
	private static final double SEMI_EIXO_MAIOR_KM = 149_598_023d;

	private static final double UA_EM_KM = 149_597_870.7d;

	/** Inclinacao do eixo da Terra em relacao ao plano da orbita. */
	private static final double INCLINACAO_DO_EIXO = 23.44;

	/** Dia do ano em que a Terra passa pelo perielio. */
	private static final int DIA_DO_PERIELIO = 3;

	private static final double DIAS_DO_ANO = 365.2425;

	/**
	 * Os quatro momentos que marcam as estacoes. O rotulo do solsticio vai por
	 * fora da orbita, onde sobra espaco, e o do equinocio por dentro.
	 */
	private enum Marco
	{
		EQUINOCIO_MARCO("Equinócio", "de março", "eixo de lado", MonthDay.of(3, 20), false),
		SOLSTICIO_JUNHO("Solstício", "de junho", "Norte ao Sol", MonthDay.of(6, 21), true),
		EQUINOCIO_SETEMBRO("Equinócio", "de setembro", "eixo de lado", MonthDay.of(9, 22), false),
		SOLSTICIO_DEZEMBRO("Solstício", "de dezembro", "Sul ao Sol", MonthDay.of(12, 21), true);

		private final String nome;
		private final String quando;
		private final String efeito;
		private final MonthDay data;
		private final boolean solsticio;

		Marco(String nome, String quando, String efeito, MonthDay data, boolean solsticio) {
			this.nome = nome;
			this.quando = quando;
			this.efeito = efeito;
			this.data = data;
			this.solsticio = solsticio;
		}
	}

	private final Timer repintura = new Timer(60000, e -> repaint());

	public OrbitaTerraSol() {
		setBackground(Color.WHITE);
	}

	public void addNotify() {
		super.addNotify();
		repintura.start();
	}

	public void removeNotify() {
		super.removeNotify();
		repintura.stop();
	}

	public void paintComponent(Graphics g) {
		super.paintComponent(g);

		Graphics2D g2 = (Graphics2D) g;
		g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

		int centroX = getWidth() / 2;
		int centroY = getHeight() / 2;

		double semiEixoMaior = Math.min(getWidth(), getHeight()) / 2 - 64;
		double semiEixoMenor = semiEixoMaior * Math.sqrt(1 - EXCENTRICIDADE * EXCENTRICIDADE);
		double distanciaAoFoco = semiEixoMaior * EXCENTRICIDADE;

		LocalDateTime agora = LocalDateTime.now();
		double angulo = anguloDesdeOPerielio(agora.toLocalDate());

		g2.setColor(Color.BLACK);
		desenharTextoCentralizado(g2, "OrbitaTerraSol", centroX, 12);
		desenharTextoCentralizado(g2, String.format(PT_BR, "%td/%<tm/%<tY - dia %d do ano - %.1f graus desde o periélio",
				agora, agora.getDayOfYear(), Math.toDegrees(angulo)), centroX, 32);

		g2.setColor(COR_ORBITA);
		g2.setStroke(new BasicStroke(1));
		g2.drawOval((int) (centroX - semiEixoMaior), (int) (centroY - semiEixoMenor),
				(int) (semiEixoMaior * 2), (int) (semiEixoMenor * 2));

		int solX = (int) (centroX + distanciaAoFoco);

		desenharMarcos(g2, centroX, centroY, semiEixoMaior, semiEixoMenor, solX, agora.getYear());

		desenharExtremo(g2, centroX, centroY, semiEixoMaior, 1, "Periélio (3 jan)");
		desenharExtremo(g2, centroX, centroY, semiEixoMaior, -1, "Afélio (4 jul)");

		int terraX = (int) (centroX + semiEixoMaior * Math.cos(angulo));
		int terraY = (int) (centroY - semiEixoMenor * Math.sin(angulo));

		g2.setColor(COR_ORBITA);
		g2.setStroke(new BasicStroke(1));
		g2.drawLine(solX, centroY, terraX, terraY);

		desenharSol(g2, solX, centroY);
		desenharTerra(g2, terraX, terraY, 10);
		g2.setColor(Color.BLACK);
		g2.setStroke(new BasicStroke(2));
		g2.drawOval(terraX - 13, terraY - 13, 26, 26);
		desenharTextoCentralizado(g2, "Terra hoje", terraX, terraY + 30);

		int mostradorX = (int) (centroX + semiEixoMaior + getWidth()) / 2;
		desenharMostradorDeDistancia(g2, mostradorX, centroY + 40, 95, distanciaEmKm(angulo));

		desenharFaseDaLua(g2);
	}

	/**
	 * Solsticios e equinocios: uma Terra pequena em cada ponto da orbita, com
	 * o eixo inclinado sempre na mesma direcao, e um raio de luz saindo do Sol.
	 */
	private void desenharMarcos(Graphics2D g2, int centroX, int centroY, double semiEixoMaior, double semiEixoMenor,
			int solX, int ano) {
		for (Marco marco : Marco.values()) {
			double angulo = anguloDesdeOPerielio(marco.data.atYear(ano));
			int x = (int) (centroX + semiEixoMaior * Math.cos(angulo));
			int y = (int) (centroY - semiEixoMenor * Math.sin(angulo));

			g2.setColor(COR_RAIO);
			g2.setStroke(new BasicStroke(1));
			g2.drawLine(solX, centroY, x, y);

			desenharTerra(g2, x, y, 9);
			desenharEixoInclinado(g2, x, y, 9);

			int rotuloX = x;
			int rotuloY = y + (y < centroY ? 42 : -42);
			if (marco.solsticio) {
				double proporcao = 1 + 58 / semiEixoMaior;
				rotuloX = (int) (centroX + semiEixoMaior * proporcao * Math.cos(angulo));
				rotuloY = (int) (centroY - semiEixoMenor * proporcao * Math.sin(angulo));
			}

			g2.setColor(Color.BLACK);
			desenharTextoCentralizado(g2, marco.nome, rotuloX, rotuloY - 14);
			desenharTextoCentralizado(g2, marco.quando, rotuloX, rotuloY);
			desenharTextoCentralizado(g2, marco.efeito, rotuloX, rotuloY + 14);
		}
	}

	/**
	 * O eixo nao acompanha a orbita: ele fica sempre inclinado para o mesmo
	 * lado, com o polo norte no alto. Por isso, quando a Terra esta do lado
	 * para onde o eixo aponta, e o hemisferio sul que fica virado para o Sol.
	 */
	private void desenharEixoInclinado(Graphics2D g2, int x, int y, int raio) {
		double inclinacao = Math.toRadians(INCLINACAO_DO_EIXO);
		int meio = raio + 6;
		int dx = (int) (meio * Math.sin(inclinacao));
		int dy = (int) (meio * Math.cos(inclinacao));

		g2.setColor(Color.BLACK);
		g2.setStroke(new BasicStroke(1));
		g2.drawLine(x - dx, y + dy, x + dx, y - dy);
		desenharTextoCentralizado(g2, "N", x + dx + 5, y - dy);
	}

	private void desenharFaseDaLua(Graphics2D g2) {
		Instant agora = Instant.now();
		double fracao = Lua.fracaoDoCiclo(agora);

		int x = 72;
		int y = getHeight() / 2 + 10;

		g2.setColor(Color.BLACK);
		desenharTextoCentralizado(g2, "Fase da Lua", x, y - 53);
		Lua.desenharDisco(g2, x, y, 40, fracao, COR_LUA_CLARA, COR_LUA_ESCURA, Color.BLACK);

		String[] linhas = {
				Lua.nomeDaFase(fracao),
				String.format(PT_BR, "%.0f%% iluminada", Lua.iluminacao(fracao) * 100),
				String.format(PT_BR, "%.1f dias de idade", Lua.idadeEmDias(fracao)),
				proximaFase(agora, fracao, 0, "Nova"),
				proximaFase(agora, fracao, 0.5, "Cheia") };

		g2.setColor(Color.BLACK);
		int linha = y - 30;
		for (String texto : linhas) {
			g2.drawString(texto, 128, linha);
			linha += 18;
		}
	}

	private String proximaFase(Instant agora, double fracao, double alvo, String rotulo) {
		double dias = Lua.diasAte(fracao, alvo);
		return String.format(PT_BR, "%s em %td/%<tm (%.0f dias)", rotulo, Lua.dataDaqui(agora, dias), dias);
	}

	/**
	 * Angulo, em radianos, que a Terra ja percorreu desde o perielio. Assume
	 * velocidade angular constante, entao e uma aproximacao: a Terra corre um
	 * pouco mais rapido perto do Sol.
	 */
	private double anguloDesdeOPerielio(LocalDate data) {
		double dias = data.getDayOfYear() - DIA_DO_PERIELIO;
		if (dias < 0) {
			dias += DIAS_DO_ANO;
		}
		return dias / DIAS_DO_ANO * 2 * Math.PI;
	}

	/**
	 * Distancia ate o Sol, em km, para um angulo da orbita. No perielio, com
	 * angulo zero, da o menor valor, e no afelio, com meia volta, o maior.
	 */
	private double distanciaEmKm(double angulo) {
		return SEMI_EIXO_MAIOR_KM * (1 - EXCENTRICIDADE * Math.cos(angulo));
	}

	/**
	 * Marca um dos extremos da orbita sobre o eixo maior.
	 *
	 * @param lado 1 para o perielio, a direita, e -1 para o afelio, a esquerda
	 */
	private void desenharExtremo(Graphics2D g2, int centroX, int centroY, double semiEixoMaior, int lado, String nome) {
		g2.setColor(Color.BLACK);
		g2.setStroke(new BasicStroke(2));
		g2.drawLine((int) (centroX + lado * semiEixoMaior * 0.93), centroY,
				(int) (centroX + lado * semiEixoMaior * 1.07), centroY);

		desenharTextoCentralizado(g2, nome, (int) (centroX + lado * (semiEixoMaior + 50)), centroY - 13);
	}

	/**
	 * Mostrador de meia volta: a esquerda o perielio, a direita o afelio e o
	 * ponteiro na distancia de agora.
	 */
	private void desenharMostradorDeDistancia(Graphics2D g2, int centroX, int centroY, int raio, double distancia) {
		double minima = distanciaEmKm(0);
		double maxima = distanciaEmKm(Math.PI);
		double fracao = (distancia - minima) / (maxima - minima);

		g2.setColor(Color.BLACK);
		desenharTextoCentralizado(g2, "Distância do Sol agora", centroX, centroY - raio - 26);

		g2.setStroke(new BasicStroke(2));
		g2.drawArc(centroX - raio, centroY - raio, raio * 2, raio * 2, 0, 180);
		g2.drawLine(centroX - raio, centroY, centroX - raio + 12, centroY);
		g2.drawLine(centroX + raio - 12, centroY, centroX + raio, centroY);

		double anguloDoPonteiro = Math.PI * (1 - fracao);
		g2.setColor(COR_PONTEIRO);
		g2.setStroke(new BasicStroke(3, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
		g2.drawLine(centroX, centroY,
				(int) (centroX + raio * 0.9 * Math.cos(anguloDoPonteiro)),
				(int) (centroY - raio * 0.9 * Math.sin(anguloDoPonteiro)));
		g2.fillOval(centroX - 4, centroY - 4, 8, 8);

		g2.setColor(Color.BLACK);
		desenharTextoCentralizado(g2, "Periélio", centroX - raio + 20, centroY + 16);
		desenharTextoCentralizado(g2, milhoesDeKm(minima), centroX - raio + 20, centroY + 32);
		desenharTextoCentralizado(g2, "Afélio", centroX + raio - 20, centroY + 16);
		desenharTextoCentralizado(g2, milhoesDeKm(maxima), centroX + raio - 20, centroY + 32);
		desenharTextoCentralizado(g2, milhoesDeKm(distancia), centroX, centroY + 54);
		desenharTextoCentralizado(g2, String.format(PT_BR, "%,.0f km - %.4f UA", distancia, distancia / UA_EM_KM),
				centroX, centroY + 70);
	}

	private String milhoesDeKm(double distancia) {
		return String.format(PT_BR, "%.1f milhões de km", distancia / 1_000_000);
	}

	private void desenharSol(Graphics2D g2, int x, int y) {
		int raio = 22;
		g2.setColor(COR_SOL);
		g2.fillOval(x - raio, y - raio, raio * 2, raio * 2);
		g2.setColor(Color.BLACK);
		desenharTextoCentralizado(g2, "Sol", x, y + raio + 12);
	}

	private void desenharTerra(Graphics2D g2, int x, int y, int raio) {
		g2.setColor(COR_TERRA);
		g2.fillOval(x - raio, y - raio, raio * 2, raio * 2);
	}

	private void desenharTextoCentralizado(Graphics2D g2, String texto, int x, int y) {
		FontMetrics fm = g2.getFontMetrics();
		g2.drawString(texto, x - fm.stringWidth(texto) / 2, y + fm.getAscent() / 2);
	}
}
