package com.scicrop.relogio.brasileiro;

import java.awt.Color;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.ActionEvent;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Locale;

import javax.swing.AbstractAction;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.Timer;

/**
 * Base das telas de ceu: fundo escuro, cabecalho com a data e o ritmo do
 * tempo, rodape com as teclas, e um relogio do ceu que corre acelerado.
 *
 * O tempo e somado de pouco em pouco a cada quadro, no ritmo escolhido, entao
 * trocar de ritmo nao faz a data pular.
 *
 */
public abstract class Cena extends JPanel
{
	protected static final Color FUNDO = new Color(18, 18, 26);
	protected static final Color COR_TEXTO = new Color(235, 235, 240);
	protected static final Color COR_APAGADA = new Color(150, 150, 165);

	protected static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

	protected static final Instant J2000 = Instant.parse("2000-01-01T12:00:00Z");

	/**
	 * Os ritmos em que o tempo pode correr, do mais devagar para o mais
	 * rapido. No primeiro o ceu anda junto com o relogio da parede.
	 */
	private enum Velocidade
	{
		TEMPO_REAL("tempo real", 1 / 86400d),
		MINUTO("1 minuto por segundo", 1 / 1440d),
		HORA("1 hora por segundo", 1 / 24d),
		SEIS_HORAS("6 horas por segundo", 0.25),
		DIA("1 dia por segundo", 1),
		CINCO_DIAS("5 dias por segundo", 5),
		MES("30 dias por segundo", 30),
		ANO("1 ano por segundo", 365);

		private final String nome;
		private final double diasPorSegundo;

		Velocidade(String nome, double diasPorSegundo) {
			this.nome = nome;
			this.diasPorSegundo = diasPorSegundo;
		}

		Velocidade maisRapido() {
			return values()[Math.min(ordinal() + 1, values().length - 1)];
		}

		Velocidade maisDevagar() {
			return values()[Math.max(ordinal() - 1, 0)];
		}
	}

	private final String titulo;
	private final boolean aceleravel;
	private final Timer animacao;

	private Velocidade velocidade = Velocidade.DIA;
	private Instant simulado = Instant.now();
	private long ultimoTick = System.currentTimeMillis();

	protected Cena(String titulo) {
		this(titulo, true);
	}

	/**
	 * @param aceleravel quando falso a cena anda so no tempo real, sem as
	 *                   teclas de ritmo, e repinta uma vez por segundo
	 */
	protected Cena(String titulo, boolean aceleravel) {
		this.titulo = titulo;
		this.aceleravel = aceleravel;
		this.animacao = new Timer(aceleravel ? 40 : 1000, e -> correrOTempo());
		setBackground(FUNDO);

		if (aceleravel) {
			atalho("RIGHT", () -> mudarRitmo(velocidade.maisRapido()));
			atalho("UP", () -> mudarRitmo(velocidade.maisRapido()));
			atalho("LEFT", () -> mudarRitmo(velocidade.maisDevagar()));
			atalho("DOWN", () -> mudarRitmo(velocidade.maisDevagar()));
			atalho("T", () -> mudarRitmo(Velocidade.TEMPO_REAL));
			atalho("A", () -> simulado = Instant.now());
		}
	}

	/**
	 * Troca o ritmo do tempo. Voltar para o tempo real traz a data de volta
	 * para agora: seria estranho o relogio andar no ritmo certo, mas marcando
	 * um dia qualquer para onde a aceleracao tinha levado.
	 */
	private void mudarRitmo(Velocidade nova) {
		velocidade = nova;
		if (velocidade == Velocidade.TEMPO_REAL) {
			simulado = Instant.now();
		}
	}

	/** O instante que a cena esta mostrando. */
	protected Instant instante() {
		return aceleravel ? simulado : Instant.now();
	}

	/** O que cada tela desenha, no instante do ceu que estiver correndo. */
	protected abstract void desenhar(Graphics2D g2, Instant instante);

	/** Teclas proprias da cena, para entrar no rodape. Nulo quando nao ha. */
	protected String dicasExtras() {
		return null;
	}

	protected void atalho(String tecla, Runnable acao) {
		Object nome = "tecla " + tecla;
		getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke(tecla), nome);
		getActionMap().put(nome, new AbstractAction() {
			public void actionPerformed(ActionEvent evento) {
				acao.run();
				repaint();
			}
		});
	}

	/**
	 * Anda com o relogio do ceu o tanto que passou desde a ultima vez, no
	 * ritmo escolhido.
	 */
	private void correrOTempo() {
		long agora = System.currentTimeMillis();
		if (aceleravel) {
			double dias = (agora - ultimoTick) / 1000d * velocidade.diasPorSegundo;
			simulado = simulado.plusMillis((long) (dias * 86400_000L));
		}
		ultimoTick = agora;
		repaint();
	}

	public void addNotify() {
		super.addNotify();
		ultimoTick = System.currentTimeMillis();
		animacao.start();
	}

	public void removeNotify() {
		super.removeNotify();
		animacao.stop();
	}

	public void paintComponent(Graphics g) {
		super.paintComponent(g);

		Graphics2D g2 = (Graphics2D) g;
		g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

		Instant instante = instante();

		g2.setColor(COR_TEXTO);
		desenharTextoCentralizado(g2, titulo, getWidth() / 2, 14);
		desenharTextoCentralizado(g2, String.format(PT_BR, "%1$td/%1$tm/%1$tY %1$tH:%1$tM:%1$tS - %2$s",
				LocalDateTime.ofInstant(instante, ZoneId.systemDefault()),
				aceleravel ? velocidade.nome : "tempo real"), getWidth() / 2, 34);

		desenhar(g2, instante);

		String rodape = aceleravel
				? "Setas mudam o ritmo do tempo (agora em " + velocidade.nome
						+ ") - T volta para tempo real e para agora - A volta para agora"
				: "Tempo real";
		if (dicasExtras() != null) {
			rodape += " - " + dicasExtras();
		}

		g2.setColor(COR_APAGADA);
		g2.drawString(rodape + " - F2 a F5 trocam de tela - F11 tela cheia", 14, getHeight() - 14);
	}

	protected double diasDesdeJ2000(Instant instante) {
		return Duration.between(J2000, instante).toMillis() / 86_400_000d;
	}

	/** Longitude do Sol vista da Terra, em graus, por elementos medios. */
	protected double longitudeDoSol(double diasDesdeJ2000) {
		return grau(280.460 + 0.9856474 * diasDesdeJ2000);
	}

	protected double grau(double angulo) {
		double resto = angulo % 360;
		return resto < 0 ? resto + 360 : resto;
	}

	protected double fracao(double valor) {
		double resto = valor % 1;
		return resto < 0 ? resto + 1 : resto;
	}

	protected void desenharTextoCentralizado(Graphics2D g2, String texto, int x, int y) {
		FontMetrics fm = g2.getFontMetrics();
		g2.drawString(texto, x - fm.stringWidth(texto) / 2, y + fm.getAscent() / 2);
	}
}
