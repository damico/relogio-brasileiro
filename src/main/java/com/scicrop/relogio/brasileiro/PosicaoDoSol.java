package com.scicrop.relogio.brasileiro;

import java.time.Duration;
import java.time.Instant;

/**
 * Onde o Sol esta em relacao a Terra, agora.
 *
 * O ponto subsolar e o lugar onde o Sol esta exatamente a pino. Dele sai todo
 * o resto: a metade iluminada do planeta e a que fica a menos de 90 graus de
 * distancia desse ponto, e a altura do Sol em qualquer lugar e a distancia
 * angular ate ele.
 *
 * As contas usam elementos medios com a correcao da equacao do centro, o que
 * da o ponto subsolar com erro bem abaixo de um grau.
 *
 */
public final class PosicaoDoSol
{
	private static final Instant J2000 = Instant.parse("2000-01-01T12:00:00Z");

	/** Altura do Sol considerada nascer ou por, ja contando a refracao. */
	private static final double ALTURA_DO_NASCER = -0.833;

	private final double declinacao;
	private final double longitudeSubsolar;

	private PosicaoDoSol(double declinacao, double longitudeSubsolar) {
		this.declinacao = declinacao;
		this.longitudeSubsolar = longitudeSubsolar;
	}

	public static PosicaoDoSol em(Instant instante) {
		double dias = Duration.between(J2000, instante).toMillis() / 86_400_000d;

		double longitudeMedia = grau(280.460 + 0.9856474 * dias);
		double anomalia = Math.toRadians(grau(357.528 + 0.9856003 * dias));
		double eclipticaLongitude = Math.toRadians(
				grau(longitudeMedia + 1.915 * Math.sin(anomalia) + 0.020 * Math.sin(2 * anomalia)));
		double obliquidade = Math.toRadians(23.439 - 0.0000004 * dias);

		double declinacao = Math.toDegrees(Math.asin(Math.sin(obliquidade) * Math.sin(eclipticaLongitude)));

		double ascensaoReta = Math.toDegrees(Math.atan2(
				Math.cos(obliquidade) * Math.sin(eclipticaLongitude), Math.cos(eclipticaLongitude)));
		double tempoSideralDeGreenwich = (18.697374558 + 24.06570982441908 * dias) % 24;
		double longitude = meridiano(ascensaoReta - tempoSideralDeGreenwich * 15);

		return new PosicaoDoSol(declinacao, longitude);
	}

	/** Latitude do ponto onde o Sol esta a pino: a declinacao do Sol. */
	public double getLatitude() {
		return declinacao;
	}

	/** Longitude do ponto onde o Sol esta a pino. */
	public double getLongitude() {
		return longitudeSubsolar;
	}

	/** O ponto da noite mais funda, do lado oposto ao subsolar. */
	public double getLatitudeDaMeiaNoite() {
		return -declinacao;
	}

	public double getLongitudeDaMeiaNoite() {
		return meridiano(longitudeSubsolar + 180);
	}

	/**
	 * Angulo horario do Sol visto de uma longitude: negativo de manha, zero ao
	 * meio dia solar e positivo a tarde.
	 */
	public double anguloHorario(double longitude) {
		return meridiano(longitude - longitudeSubsolar);
	}

	/** Altura do Sol acima do horizonte, em graus. Negativa quando e noite. */
	public double altura(double latitude, double longitude) {
		double lat = Math.toRadians(latitude);
		double dec = Math.toRadians(declinacao);
		double angulo = Math.toRadians(anguloHorario(longitude));

		return Math.toDegrees(Math.asin(
				Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(angulo)));
	}

	/** Azimute do Sol, contado do norte para leste. */
	public double azimute(double latitude, double longitude) {
		double lat = Math.toRadians(latitude);
		double dec = Math.toRadians(declinacao);
		double angulo = Math.toRadians(anguloHorario(longitude));
		double altura = Math.toRadians(altura(latitude, longitude));

		double seno = -Math.sin(angulo) * Math.cos(dec) / Math.cos(altura);
		double cosseno = (Math.sin(dec) - Math.sin(lat) * Math.sin(altura)) / (Math.cos(lat) * Math.cos(altura));
		return grau(Math.toDegrees(Math.atan2(seno, cosseno)));
	}

	public boolean eDia(double latitude, double longitude) {
		return altura(latitude, longitude) > 0;
	}

	/**
	 * Quantas horas faltam para o proximo nascer do Sol num lugar, ou -1 se o
	 * Sol nao vai nascer, como acontece no inverno polar.
	 */
	public double horasAteONascer(double latitude, double longitude) {
		return horasAte(latitude, longitude, -1);
	}

	/** Quantas horas faltam para o proximo por do Sol, ou -1 se ele nao se poe. */
	public double horasAteOPor(double latitude, double longitude) {
		return horasAte(latitude, longitude, 1);
	}

	/**
	 * O Sol nasce e se poe quando o angulo horario vale menos ou mais o angulo
	 * do nascer. Como o angulo horario cresce 15 graus por hora, a conta e a
	 * diferenca dividida por 15.
	 *
	 * @param lado -1 para o nascer, do lado da manha, e 1 para o por
	 */
	private double horasAte(double latitude, double longitude, int lado) {
		double lat = Math.toRadians(latitude);
		double dec = Math.toRadians(declinacao);

		double cosseno = (Math.sin(Math.toRadians(ALTURA_DO_NASCER)) - Math.sin(lat) * Math.sin(dec))
				/ (Math.cos(lat) * Math.cos(dec));
		if (cosseno < -1 || cosseno > 1) {
			return -1;
		}

		double anguloDoNascer = lado * Math.toDegrees(Math.acos(cosseno));
		double horas = (anguloDoNascer - anguloHorario(longitude)) / 15;
		return horas < 0 ? horas + 24 : horas;
	}

	private static double grau(double angulo) {
		double resto = angulo % 360;
		return resto < 0 ? resto + 360 : resto;
	}

	/** Leva o angulo para a faixa de -180 a 180, que e a das longitudes. */
	private static double meridiano(double angulo) {
		double resto = grau(angulo);
		return resto > 180 ? resto - 360 : resto;
	}
}
