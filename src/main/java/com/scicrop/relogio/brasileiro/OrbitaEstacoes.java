package com.scicrop.relogio.brasileiro;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RadialGradientPaint;
import java.awt.geom.Point2D;
import java.time.Instant;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/**
 * Por que existem as estacoes: a Terra dando a volta no Sol com o eixo sempre
 * inclinado para o mesmo lado do espaco.
 *
 * Nas quatro posicoes marcadas estao os solsticios e os equinocios. No
 * solsticio de junho o eixo aponta o hemisferio norte para o Sol, e no de
 * dezembro, o sul: e isso, e nao a distancia ate o Sol, que troca as
 * estacoes. Nos equinocios o eixo fica de lado e os dois hemisferios recebem
 * a mesma luz.
 *
 * Em amarelo as estacoes que comecam no hemisferio norte, em branco as do
 * hemisferio sul, como nos diagramas de livro.
 *
 */
public class OrbitaEstacoes extends Cena
{
	private static final Color COR_ORBITA = new Color(225, 45, 45);
	private static final Color COR_SOL = new Color(255, 245, 170);
	private static final Color COR_DATA = new Color(120, 225, 255);
	private static final Color COR_NORTE = new Color(255, 225, 70);
	private static final Color COR_SUL = Color.WHITE;
	private static final Color COR_EIXO = new Color(215, 130, 255);
	private static final Color COR_TERRA_CLARA = new Color(80, 150, 235);
	private static final Color COR_TERRA_ESCURA = new Color(20, 40, 75);
	private static final Color COR_HOJE = new Color(255, 205, 80);

	/** Inclinacao do eixo da Terra em relacao ao plano da orbita. */
	private static final double INCLINACAO_DO_EIXO = 23.44;

	/** A Terra desenhada acompanha o tamanho da tela. */
	private int raioDaTerra() {
		return (int) (Math.min(getWidth(), getHeight()) * 0.039);
	}

	/**
	 * Os quatro momentos que marcam as estacoes, com o que comeca em cada
	 * hemisferio quando a Terra passa por ali.
	 */
	private enum Marco
	{
		MARCO("20 de março", MonthDay.of(3, 20), "Primavera", "Outono"),
		JUNHO("20/21 de junho", MonthDay.of(6, 21), "Verão", "Inverno"),
		SETEMBRO("22/23 de setembro", MonthDay.of(9, 22), "Outono", "Primavera"),
		DEZEMBRO("21/22 de dezembro", MonthDay.of(12, 21), "Inverno", "Verão");

		private final String quando;
		private final MonthDay data;
		private final String noNorte;
		private final String noSul;

		Marco(String quando, MonthDay data, String noNorte, String noSul) {
			this.quando = quando;
			this.data = data;
			this.noNorte = noNorte;
			this.noSul = noSul;
		}

		Marco proximo() {
			return values()[(ordinal() + 1) % values().length];
		}
	}

	public OrbitaEstacoes() {
		super("OrbitaEstacoes");
	}

	protected void desenhar(Graphics2D g2, Instant instante) {
		int centroX = getWidth() / 2;
		int centroY = getHeight() / 2;
		int larguraDaOrbita = (int) (getWidth() * 0.34);
		int alturaDaOrbita = (int) (getHeight() * 0.18);

		desenharOrbita(g2, centroX, centroY, larguraDaOrbita, alturaDaOrbita);
		desenharSol(g2, centroX, centroY);

		LocalDate hoje = LocalDate.ofInstant(instante, ZoneId.systemDefault());
		for (Marco marco : Marco.values()) {
			desenharMarco(g2, marco, hoje.getYear(), centroX, centroY, larguraDaOrbita, alturaDaOrbita);
		}

		desenharTerraDeHoje(g2, instante, centroX, centroY, larguraDaOrbita, alturaDaOrbita);
		desenharLegenda(g2);
		desenharSituacao(g2, hoje);
	}

	/** A elipse da orbita, com setas mostrando para onde a Terra anda. */
	private void desenharOrbita(Graphics2D g2, int centroX, int centroY, int largura, int altura) {
		g2.setColor(COR_ORBITA);
		g2.setStroke(new BasicStroke(3));
		g2.drawOval(centroX - largura, centroY - altura, largura * 2, altura * 2);

		for (int i = 0; i < 4; i++) {
			double angulo = Math.PI / 4 + i * Math.PI / 2;
			int x = (int) (centroX + largura * Math.cos(angulo));
			int y = (int) (centroY - altura * Math.sin(angulo));
			// a tangente, no sentido anti-horario
			double tx = -largura * Math.sin(angulo);
			double ty = -altura * Math.cos(angulo);
			double tamanho = Math.hypot(tx, ty);
			desenharSeta(g2, x, y, tx / tamanho, ty / tamanho, 11);
		}
	}

	private void desenharSeta(Graphics2D g2, int x, int y, double dx, double dy, int ponta) {
		double lado = ponta * 0.62;
		int[] xs = { (int) (x + dx * ponta), (int) (x - dx * ponta + dy * lado), (int) (x - dx * ponta - dy * lado) };
		int[] ys = { (int) (y + dy * ponta), (int) (y - dy * ponta - dx * lado), (int) (y - dy * ponta + dx * lado) };
		g2.fillPolygon(xs, ys, 3);
	}

	private void desenharSol(Graphics2D g2, int centroX, int centroY) {
		int raio = 58;
		g2.setPaint(new RadialGradientPaint(new Point2D.Float(centroX, centroY), raio * 1.9f,
				new float[] { 0f, 0.42f, 1f },
				new Color[] { Color.WHITE, COR_SOL, new Color(255, 245, 170, 0) }));
		g2.fillOval(centroX - raio * 2, centroY - raio * 2, raio * 4, raio * 4);
		g2.setPaint(COR_SOL);
	}

	/**
	 * Uma das quatro posicoes: a Terra com o eixo inclinado, a data e as
	 * estacoes que comecam ali nos dois hemisferios.
	 */
	private void desenharMarco(Graphics2D g2, Marco marco, int ano, int centroX, int centroY, int largura, int altura) {
		double angulo = anguloNaOrbita(marco.data.atYear(ano).atStartOfDay(ZoneId.systemDefault()).toInstant());
		int x = (int) (centroX + largura * Math.cos(angulo));
		int y = (int) (centroY - altura * Math.sin(angulo));

		int raioDaTerra = raioDaTerra();
		desenharTerra(g2, x, y, raioDaTerra, centroX, centroY, true);

		boolean nosLados = Math.abs(Math.cos(angulo)) > 0.7;
		int rotuloX = nosLados ? x + (int) (Math.signum(Math.cos(angulo)) * raioDaTerra) : x;
		int rotuloY = nosLados ? y - raioDaTerra * 3 : y + (int) (Math.signum(y - centroY) * raioDaTerra * 2.9);

		g2.setColor(COR_DATA);
		desenharTextoCentralizado(g2, marco.quando, rotuloX, rotuloY);
		g2.setColor(COR_NORTE);
		desenharTextoCentralizado(g2, marco.noNorte, rotuloX, rotuloY + 19);
		g2.setColor(COR_SUL);
		desenharTextoCentralizado(g2, marco.noSul, rotuloX, rotuloY + 37);
	}

	private void desenharTerraDeHoje(Graphics2D g2, Instant instante, int centroX, int centroY, int largura, int altura) {
		double angulo = anguloNaOrbita(instante);
		int x = (int) (centroX + largura * Math.cos(angulo));
		int y = (int) (centroY - altura * Math.sin(angulo));

		desenharTerra(g2, x, y, raioDaTerra() / 2, centroX, centroY, false);

		int anel = raioDaTerra() / 2 + 5;
		g2.setColor(COR_HOJE);
		g2.setStroke(new BasicStroke(2));
		g2.drawOval(x - anel, y - anel, anel * 2, anel * 2);
		desenharTextoCentralizado(g2, "hoje", x, y + anel + 14);
	}

	/**
	 * A Terra com a metade virada para o Sol iluminada e o eixo inclinado
	 * 23,44 graus, sempre para o mesmo lado, com a seta da rotacao.
	 */
	private void desenharTerra(Graphics2D g2, int x, int y, int raio, int solX, int solY, boolean comEixo) {
		double paraOSol = Math.toDegrees(Math.atan2(-(solY - y), solX - x));

		g2.setColor(COR_TERRA_ESCURA);
		g2.fillOval(x - raio, y - raio, raio * 2, raio * 2);
		g2.setColor(COR_TERRA_CLARA);
		g2.fillArc(x - raio, y - raio, raio * 2, raio * 2, (int) Math.round(paraOSol - 90), 180);

		if (!comEixo) {
			return;
		}

		double inclinacao = Math.toRadians(INCLINACAO_DO_EIXO);
		int ponta = raio + 14;
		int dx = (int) (ponta * Math.sin(inclinacao));
		int dy = (int) (ponta * Math.cos(inclinacao));

		g2.setColor(COR_EIXO);
		g2.setStroke(new BasicStroke(1));
		g2.drawLine(x - dx, y + dy, x + dx, y - dy);

		// a voltinha da rotacao, em torno da ponta norte do eixo
		g2.drawArc(x + dx - 10, y - dy - 5, 20, 11, 190, 250);
		desenharSeta(g2, x + dx + 9, y - dy + 1, 0.25, -1, 5);
	}

	private void desenharLegenda(Graphics2D g2) {
		int y = getHeight() - 92;
		int x = getWidth() - 318;
		g2.setColor(COR_NORTE);
		g2.drawString("Estações no Hemisfério Norte", x, y);
		g2.setColor(COR_SUL);
		g2.drawString("Estações no Hemisfério Sul", x, y + 19);
		g2.setColor(COR_EIXO);
		g2.drawString("Eixo inclinado 23,44°, sempre para o mesmo lado", x, y + 38);
	}

	/** Em que estacao estamos e quanto falta para a proxima virar. */
	private void desenharSituacao(Graphics2D g2, LocalDate hoje) {
		Marco atual = marcoAtual(hoje);
		Marco proximo = atual.proximo();
		LocalDate viradaSeguinte = proximaData(hoje, proximo);

		g2.setColor(COR_TEXTO);
		g2.drawString(String.format(PT_BR, "Agora: %s no Sul, %s no Norte", atual.noSul, atual.noNorte),
				14, getHeight() - 78);
		g2.setColor(COR_APAGADA);
		g2.drawString(String.format(PT_BR, "Começou em %s. A próxima virada é %s, daqui a %d dias",
				atual.quando, proximo.quando, ChronoUnit.DAYS.between(hoje, viradaSeguinte)),
				14, getHeight() - 58);
		g2.drawString("A distância até o Sol quase não muda: o que vira as estações é a inclinação do eixo",
				14, getHeight() - 38);
	}

	/**
	 * Onde a Terra esta na orbita. O solsticio de dezembro cai a direita do
	 * Sol, que e o lado para onde o eixo aponta, e por isso e ali que o
	 * hemisferio sul fica virado para ele.
	 */
	private double anguloNaOrbita(Instant instante) {
		double longitudeDaTerra = longitudeDoSol(diasDesdeJ2000(instante)) + 180;
		return Math.toRadians(longitudeDaTerra - 90);
	}

	private Marco marcoAtual(LocalDate data) {
		Marco atual = Marco.DEZEMBRO;
		for (Marco marco : Marco.values()) {
			if (!data.isBefore(marco.data.atYear(data.getYear()))) {
				atual = marco;
			}
		}
		return atual;
	}

	private LocalDate proximaData(LocalDate data, Marco marco) {
		LocalDate no = marco.data.atYear(data.getYear());
		return no.isAfter(data) ? no : marco.data.atYear(data.getYear() + 1);
	}
}
