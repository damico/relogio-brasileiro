package com.scicrop.relogio.brasileiro;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.temporal.ChronoUnit;

/**
 * Relogio do ano: a volta completa vale um ano, dividido nos doze meses, e o
 * ponteiro mostra em que dia estamos. Os quatro arcos coloridos por fora sao
 * as estacoes do hemisferio sul, e embaixo fica escrito em que estacao
 * estamos e quantos dias faltam para a proxima.
 *
 */
public class RelogioEstacoes extends Relogio
{
	private static final String[] MESES = { "jan", "fev", "mar", "abr", "mai", "jun",
			"jul", "ago", "set", "out", "nov", "dez" };

	/**
	 * As estacoes na ordem em que comecam, com a data de inicio no hemisferio
	 * sul. As datas mudam um dia para mais ou para menos conforme o ano, aqui
	 * estao fixas.
	 */
	private enum Estacao
	{
		VERAO("Verão", MonthDay.of(12, 21), new Color(240, 150, 40)),
		OUTONO("Outono", MonthDay.of(3, 20), new Color(170, 100, 40)),
		INVERNO("Inverno", MonthDay.of(6, 21), new Color(70, 140, 210)),
		PRIMAVERA("Primavera", MonthDay.of(9, 22), new Color(60, 160, 70));

		private final String nome;
		private final MonthDay inicio;
		private final Color cor;

		Estacao(String nome, MonthDay inicio, Color cor) {
			this.nome = nome;
			this.inicio = inicio;
			this.cor = cor;
		}

		Estacao proxima() {
			return values()[(ordinal() + 1) % values().length];
		}

		LocalDate inicioEm(int ano) {
			return inicio.atYear(ano);
		}
	}

	public RelogioEstacoes() {
		super("RelogioEstacoes", 60000);
	}

	protected int marcacoesPorVolta() {
		return 12;
	}

	protected String rotuloDaMarcacao(int marcacao) {
		return MESES[marcacao];
	}

	protected void desenharPonteiros(Graphics2D g2) {
		LocalDate hoje = LocalDate.now();
		Estacao atual = estacaoDe(hoje);
		LocalDate proximoInicio = proximoInicio(hoje, atual);
		long diasQueFaltam = ChronoUnit.DAYS.between(hoje, proximoInicio);

		desenharEstacoes(g2, hoje.getYear());

		desenharPonteiro(g2, fracaoDoAno(hoje), 0.85, 5, COR_PONTEIRO_MAIOR);

		g2.setColor(Color.BLACK);
		desenharTextoCentralizado(g2, atual.nome, getCentroX(), getCentroY() + getRaio() + 28);
		desenharTextoCentralizado(g2, String.format("faltam %d dias para o %s", diasQueFaltam, atual.proxima().nome),
				getCentroX(), getCentroY() + getRaio() + 44);
	}

	/**
	 * Um arco colorido por fora do mostrador para cada estacao, com o nome
	 * dela escrito por dentro.
	 */
	private void desenharEstacoes(Graphics2D g2, int ano) {
		int raioDoArco = (int) (getRaio() * 1.06);

		for (Estacao estacao : Estacao.values()) {
			double inicio = fracaoDoAno(estacao.inicioEm(ano));
			double fim = fracaoDoAno(estacao.proxima().inicioEm(ano));
			double duracao = fim - inicio;
			if (duracao < 0) {
				duracao += 1;
			}

			g2.setColor(estacao.cor);
			g2.setStroke(new BasicStroke(8));
			g2.drawArc(getCentroX() - raioDoArco, getCentroY() - raioDoArco, raioDoArco * 2, raioDoArco * 2,
					(int) Math.round(90 - 360 * (inicio + duracao)), (int) Math.round(360 * duracao));

			double meio = (inicio + duracao / 2) * 2 * Math.PI;
			desenharTextoCentralizado(g2, estacao.nome,
					(int) (getCentroX() + getRaio() * 0.42 * Math.sin(meio)),
					(int) (getCentroY() - getRaio() * 0.42 * Math.cos(meio)));
		}
	}

	/**
	 * Antes do inicio do outono ainda estamos no verao que comecou em
	 * dezembro do ano anterior, por isso ele e o ponto de partida.
	 */
	private Estacao estacaoDe(LocalDate data) {
		Estacao atual = Estacao.VERAO;
		for (Estacao estacao : new Estacao[] { Estacao.OUTONO, Estacao.INVERNO, Estacao.PRIMAVERA, Estacao.VERAO }) {
			if (!data.isBefore(estacao.inicioEm(data.getYear()))) {
				atual = estacao;
			}
		}
		return atual;
	}

	private LocalDate proximoInicio(LocalDate data, Estacao atual) {
		LocalDate inicio = atual.proxima().inicioEm(data.getYear());
		return inicio.isAfter(data) ? inicio : atual.proxima().inicioEm(data.getYear() + 1);
	}

	/** Posicao da data na volta completa, com 1 de janeiro no topo. */
	private double fracaoDoAno(LocalDate data) {
		return (data.getDayOfYear() - 1) / (double) data.lengthOfYear();
	}
}
