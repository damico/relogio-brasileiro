package com.scicrop.relogio.brasileiro;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;

import javax.swing.JPanel;
import javax.swing.Timer;

/**
 * Base dos relogios: desenha o mostrador com as marcacoes das horas e oferece
 * o desenho de ponteiros. Cada relogio concreto decide quantas horas cabem em
 * uma volta e o angulo de cada ponteiro.
 *
 */
public abstract class Relogio extends JPanel
{
	protected static final Color COR_PONTEIRO_MAIOR = Color.BLUE;
	protected static final Color COR_PONTEIRO_MEDIO = new Color(0, 128, 0);
	protected static final Color COR_PONTEIRO_MENOR = Color.RED;

	private final String titulo;
	private final Timer repintura;

	private int centroX;
	private int centroY;
	private int raio;

	/**
	 * @param intervaloMillis de quanto em quanto tempo o mostrador e redesenhado
	 */
	protected Relogio(String titulo, int intervaloMillis) {
		this.titulo = titulo;
		setBackground(Color.WHITE);
		this.repintura = new Timer(intervaloMillis, e -> repaint());
	}

	public void addNotify() {
		super.addNotify();
		repintura.start();
	}

	public void removeNotify() {
		super.removeNotify();
		repintura.stop();
	}

	/**
	 * Desenha os ponteiros deste relogio, via {@link #desenharPonteiro}.
	 */
	protected abstract void desenharPonteiros(Graphics2D g2);

	/**
	 * Quantas marcacoes o mostrador tem, ou seja em quantas partes a volta
	 * completa do ponteiro maior e dividida.
	 */
	protected abstract int marcacoesPorVolta();

	/**
	 * Texto da marcacao, sendo 0 a marcacao no topo do mostrador.
	 */
	protected String rotuloDaMarcacao(int marcacao) {
		return String.valueOf(marcacao);
	}

	/**
	 * Texto opcional escrito do lado de fora do mostrador, para relogios que
	 * tem uma segunda escala. Nulo quando nao ha.
	 */
	protected String rotuloExterno(int marcacao) {
		return null;
	}

	public void paintComponent(Graphics g) {
		super.paintComponent(g);

		Graphics2D g2 = (Graphics2D) g;
		g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

		centroX = getWidth() / 2;
		centroY = getHeight() / 2;
		raio = Math.min(getWidth(), getHeight()) / 2 - 50;

		g2.setColor(Color.BLACK);
		g2.setStroke(new BasicStroke(2));
		g2.drawOval(centroX - raio, centroY - raio, raio * 2, raio * 2);

		desenharTextoCentralizado(g2, titulo, centroX, 12);
		desenharMarcacoes(g2);
		desenharPonteiros(g2);
	}

	/**
	 * Um traco e um rotulo para cada marcacao, com traco reforcado a cada quarto
	 * de volta.
	 */
	private void desenharMarcacoes(Graphics2D g2) {
		int marcacoes = marcacoesPorVolta();

		g2.setColor(Color.BLACK);
		for (int marcacao = 0; marcacao < marcacoes; marcacao++) {
			double angulo = (double) marcacao / marcacoes * 2 * Math.PI;
			double seno = Math.sin(angulo);
			double cosseno = Math.cos(angulo);

			boolean reforcado = marcacao % (marcacoes / 4) == 0;
			g2.setStroke(new BasicStroke(reforcado ? 4 : 2));
			g2.drawLine((int) (centroX + raio * 0.90 * seno), (int) (centroY - raio * 0.90 * cosseno),
					(int) (centroX + raio * seno), (int) (centroY - raio * cosseno));

			desenharTextoCentralizado(g2, rotuloDaMarcacao(marcacao),
					(int) (centroX + raio * 0.80 * seno), (int) (centroY - raio * 0.80 * cosseno));

			String externo = rotuloExterno(marcacao);
			if (externo != null) {
				desenharTextoCentralizado(g2, externo,
						(int) (centroX + raio * 1.15 * seno), (int) (centroY - raio * 1.15 * cosseno));
			}
		}
	}

	/**
	 * @param y altura da linha de base do texto, quando ela nao importa passe
	 *          o centro desejado que o texto e centralizado na vertical tambem
	 */
	protected void desenharTextoCentralizado(Graphics2D g2, String texto, int x, int y) {
		FontMetrics fm = g2.getFontMetrics();
		g2.drawString(texto, x - fm.stringWidth(texto) / 2, y + fm.getAscent() / 2);
	}

	protected int getCentroX() {
		return centroX;
	}

	protected int getCentroY() {
		return centroY;
	}

	protected int getRaio() {
		return raio;
	}

	/**
	 * @param fracao posicao do ponteiro na volta completa, de 0 (topo) a 1
	 * @param proporcaoDoRaio comprimento do ponteiro, de 0 ao raio do mostrador
	 */
	protected void desenharPonteiro(Graphics2D g2, double fracao, double proporcaoDoRaio, int espessura, Color cor) {
		int comprimento = (int) (raio * proporcaoDoRaio);
		double angulo = fracao * 2 * Math.PI;
		int fimX = (int) (centroX + comprimento * Math.sin(angulo));
		int fimY = (int) (centroY - comprimento * Math.cos(angulo));

		g2.setColor(cor);
		g2.setStroke(new BasicStroke(espessura, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
		g2.drawLine(centroX, centroY, fimX, fimY);
	}
}
