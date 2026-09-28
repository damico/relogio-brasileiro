package com.scicrop.relogio.brasileiro;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;

import javax.swing.JPanel;
import javax.swing.Timer;

/**
 * As fases da Lua: em cima a faixa com as oito fases nomeadas, como vemos
 * daqui de baixo, e embaixo a Lua dando a volta na Terra, com a metade
 * iluminada sempre virada para o Sol.
 *
 * A fase nao e a Lua sendo tapada por nada: metade dela esta sempre iluminada,
 * o que muda e quanto dessa metade da para ver da Terra. Por isso na faixa de
 * cima o desenho muda, e no diagrama de baixo todas as Luas sao iguais.
 *
 * A conta das fases esta em {@link Lua}. Este painel nao esta montado na tela
 * no momento, mas continua pronto para ser usado.
 *
 */
public class FasesDaLua extends JPanel
{
	private static final Color FUNDO = new Color(15, 15, 25);
	private static final Color COR_TEXTO = new Color(235, 235, 240);
	private static final Color COR_DESTAQUE = new Color(255, 215, 90);
	private static final Color COR_ILUMINADA = new Color(238, 238, 228);
	private static final Color COR_ESCURA = new Color(55, 55, 70);
	private static final Color COR_TERRA_CLARA = new Color(70, 140, 230);
	private static final Color COR_TERRA_ESCURA = new Color(25, 45, 80);
	private static final Color COR_ORBITA = new Color(95, 95, 115);

	private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

	private final Timer repintura = new Timer(60000, e -> repaint());

	public FasesDaLua() {
		setBackground(FUNDO);
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

		Instant agora = Instant.now();
		double fracao = Lua.fracaoDoCiclo(agora);

		g2.setColor(COR_TEXTO);
		desenharTextoCentralizado(g2, "FasesDaLua", getWidth() / 2, 12);
		desenharTextoCentralizado(g2, String.format(PT_BR, "%td/%<tm/%<tY - %s - %.0f%% iluminada - %.1f dias de idade",
				LocalDate.ofInstant(agora, ZoneId.systemDefault()), Lua.nomeDaFase(fracao),
				Lua.iluminacao(fracao) * 100, Lua.idadeEmDias(fracao)), getWidth() / 2, 32);

		desenharFaixa(g2, fracao);
		desenharOrbita(g2, fracao);
		desenharResumo(g2, agora, fracao);
	}

	/** A faixa de cima: as oito fases do ciclo, com a de hoje destacada. */
	private void desenharFaixa(Graphics2D g2, double fracao) {
		int raio = 22;
		int atual = Lua.indiceDaFase(fracao);

		for (int i = 0; i < Lua.NOMES.length; i++) {
			int x = 64 + i * 128;

			g2.setColor(i == atual ? COR_DESTAQUE : COR_TEXTO);
			desenharTextoCentralizado(g2, Lua.NOMES[i], x, 52);

			Lua.desenharDisco(g2, x, 88, raio, (double) i / Lua.NOMES.length, COR_ILUMINADA, COR_ESCURA, COR_ORBITA);

			if (i == atual) {
				g2.setColor(COR_DESTAQUE);
				g2.setStroke(new BasicStroke(2));
				g2.drawOval(x - raio - 5, 88 - raio - 5, (raio + 5) * 2, (raio + 5) * 2);
			}
		}
	}

	/**
	 * O diagrama de baixo: a luz do Sol vem da esquerda, a Lua da a volta na
	 * Terra e a metade virada para o Sol e a que esta iluminada, sempre.
	 */
	private void desenharOrbita(Graphics2D g2, double fracao) {
		int terraX = 430;
		int terraY = 255;
		int raioDaOrbita = 92;

		desenharLuzDoSol(g2, terraY);

		g2.setColor(COR_ORBITA);
		g2.setStroke(new BasicStroke(1));
		g2.drawOval(terraX - raioDaOrbita, terraY - raioDaOrbita, raioDaOrbita * 2, raioDaOrbita * 2);

		desenharMetadeIluminada(g2, terraX, terraY, 20, COR_TERRA_CLARA, COR_TERRA_ESCURA);

		for (int i = 0; i < Lua.NOMES.length; i++) {
			double angulo = anguloNaOrbita((double) i / Lua.NOMES.length);
			int x = (int) (terraX + raioDaOrbita * Math.cos(angulo));
			int y = (int) (terraY - raioDaOrbita * Math.sin(angulo));
			desenharMetadeIluminada(g2, x, y, 13, COR_ILUMINADA, COR_ESCURA);
		}

		g2.setColor(COR_TEXTO);
		desenharTextoCentralizado(g2, "Lua nova", terraX - raioDaOrbita - 50, terraY);
		desenharTextoCentralizado(g2, "Lua cheia", terraX + raioDaOrbita + 50, terraY);
		desenharTextoCentralizado(g2, "Quarto crescente", terraX, terraY + raioDaOrbita + 42);
		desenharTextoCentralizado(g2, "Quarto minguante", terraX, terraY - raioDaOrbita - 42);

		double angulo = anguloNaOrbita(fracao);
		int luaX = (int) (terraX + raioDaOrbita * Math.cos(angulo));
		int luaY = (int) (terraY - raioDaOrbita * Math.sin(angulo));

		g2.setColor(COR_DESTAQUE);
		g2.setStroke(new BasicStroke(1));
		g2.drawLine(terraX, terraY, luaX, luaY);

		desenharMetadeIluminada(g2, luaX, luaY, 13, COR_ILUMINADA, COR_ESCURA);

		g2.setColor(COR_DESTAQUE);
		g2.setStroke(new BasicStroke(2));
		g2.drawOval(luaX - 19, luaY - 19, 38, 38);
	}

	private void desenharLuzDoSol(Graphics2D g2, int terraY) {
		g2.setColor(COR_DESTAQUE);
		g2.setStroke(new BasicStroke(2));

		for (int i = -2; i <= 2; i++) {
			int y = terraY + i * 35;
			g2.drawLine(20, y, 150, y);
			g2.drawLine(140, y - 5, 150, y);
			g2.drawLine(140, y + 5, 150, y);
		}

		desenharTextoCentralizado(g2, "Luz do Sol", 85, terraY - 95);
	}

	/** Uma esfera com a metade virada para o Sol, a esquerda, iluminada. */
	private void desenharMetadeIluminada(Graphics2D g2, int x, int y, int raio, Color clara, Color escura) {
		g2.setColor(escura);
		g2.fillOval(x - raio, y - raio, raio * 2, raio * 2);
		g2.setColor(clara);
		g2.fillArc(x - raio, y - raio, raio * 2, raio * 2, 90, 180);
		g2.setColor(COR_ORBITA);
		g2.setStroke(new BasicStroke(1));
		g2.drawOval(x - raio, y - raio, raio * 2, raio * 2);
	}

	private void desenharResumo(Graphics2D g2, Instant agora, double fracao) {
		g2.setColor(COR_TEXTO);
		desenharTextoCentralizado(g2, "Como vemos hoje", 910, 190);
		Lua.desenharDisco(g2, 910, 268, 45, fracao, COR_ILUMINADA, COR_ESCURA, COR_ORBITA);

		String[] linhas = {
				"Fase: " + Lua.nomeDaFase(fracao),
				String.format(PT_BR, "Iluminação: %.0f%%", Lua.iluminacao(fracao) * 100),
				String.format(PT_BR, "Idade: %.1f de %.2f dias", Lua.idadeEmDias(fracao), Lua.MES_SINODICO),
				proximaFase(agora, fracao, 0, "Próxima lua nova"),
				proximaFase(agora, fracao, 0.5, "Próxima lua cheia") };

		g2.setColor(COR_TEXTO);
		int y = 215;
		for (String linha : linhas) {
			g2.drawString(linha, 620, y);
			y += 22;
		}

		g2.setColor(COR_ORBITA);
		g2.drawString("Fase média, sem as irregularidades da órbita: erro de até meio dia", 620, 330);
	}

	private String proximaFase(Instant agora, double fracao, double alvo, String rotulo) {
		double dias = Lua.diasAte(fracao, alvo);
		return String.format(PT_BR, "%s: %td/%<tm (%.0f dias)", rotulo, Lua.dataDaqui(agora, dias), dias);
	}

	/**
	 * Onde a Lua esta na orbita: na lua nova ela fica entre a Terra e o Sol,
	 * ou seja do lado esquerdo, e na cheia do lado oposto.
	 */
	private double anguloNaOrbita(double fracao) {
		return Math.PI + fracao * 2 * Math.PI;
	}

	private void desenharTextoCentralizado(Graphics2D g2, String texto, int x, int y) {
		FontMetrics fm = g2.getFontMetrics();
		g2.drawString(texto, x - fm.stringWidth(texto) / 2, y + fm.getAscent() / 2);
	}
}
