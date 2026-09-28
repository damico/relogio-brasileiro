package com.scicrop.relogio.brasileiro;

/**
 * A conversao entre as coordenadas do ceu e as de quem olha para cima.
 *
 * O catalogo de estrelas guarda ascensao reta e declinacao, que sao fixas no
 * ceu. Quem esta num lugar da Terra ve altura acima do horizonte e azimute,
 * contado do norte para o leste, e isso muda a cada instante porque a Terra
 * gira. A ponte entre os dois e o tempo sideral, que e a ascensao reta que
 * esta passando pelo meridiano do observador agora.
 *
 */
public final class Horizonte
{
	private Horizonte() {
	}

	/** Tempo sideral de Greenwich, em graus. */
	public static double tempoSideralDeGreenwich(double diasDesdeJ2000) {
		return grau((18.697374558 + 24.06570982441908 * diasDesdeJ2000) * 15);
	}

	/**
	 * Tempo sideral local, em graus: a ascensao reta que esta cruzando o
	 * meridiano de quem observa. Uma estrela com essa ascensao reta esta no
	 * ponto mais alto da noite dela.
	 */
	public static double tempoSideralLocal(double diasDesdeJ2000, double longitude) {
		return grau(tempoSideralDeGreenwich(diasDesdeJ2000) + longitude);
	}

	/** Quanto a estrela ja passou do meridiano, em graus, de -180 a 180. */
	public static double anguloHorario(double ascensaoReta, double tempoSideralLocal) {
		double diferenca = grau(tempoSideralLocal - ascensaoReta);
		return diferenca > 180 ? diferenca - 360 : diferenca;
	}

	/** Altura acima do horizonte, em graus. Negativa quando esta abaixo dele. */
	public static double altura(double ascensaoReta, double declinacao, double latitude, double tempoSideralLocal) {
		double lat = Math.toRadians(latitude);
		double dec = Math.toRadians(declinacao);
		double angulo = Math.toRadians(anguloHorario(ascensaoReta, tempoSideralLocal));

		return Math.toDegrees(Math.asin(
				Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(angulo)));
	}

	/** Azimute, contado do norte para o leste, de 0 a 360 graus. */
	public static double azimute(double ascensaoReta, double declinacao, double latitude, double tempoSideralLocal) {
		double lat = Math.toRadians(latitude);
		double dec = Math.toRadians(declinacao);
		double angulo = Math.toRadians(anguloHorario(ascensaoReta, tempoSideralLocal));

		double seno = -Math.sin(angulo) * Math.cos(dec);
		double cosseno = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(angulo);
		return grau(Math.toDegrees(Math.atan2(seno, cosseno)));
	}

	/**
	 * Passa do plano da orbita da Terra para o do equador celeste, que e a
	 * mesma inclinacao de 23,44 graus que gera as estacoes.
	 *
	 * @param longitude longitude ecliptica, em graus
	 * @param latitude latitude ecliptica, em graus
	 * @return ascensao reta e declinacao, em graus
	 */
	public static double[] doPlanoDaOrbita(double longitude, double latitude, double diasDesdeJ2000) {
		double obliquidade = Math.toRadians(23.439 - 0.0000004 * diasDesdeJ2000);
		double lon = Math.toRadians(longitude);
		double lat = Math.toRadians(latitude);

		double ascensaoReta = Math.atan2(
				Math.sin(lon) * Math.cos(obliquidade) - Math.tan(lat) * Math.sin(obliquidade), Math.cos(lon));
		double declinacao = Math.asin(Math.sin(lat) * Math.cos(obliquidade)
				+ Math.cos(lat) * Math.sin(obliquidade) * Math.sin(lon));

		return new double[] { grau(Math.toDegrees(ascensaoReta)), Math.toDegrees(declinacao) };
	}

	private static double grau(double angulo) {
		double resto = angulo % 360;
		return resto < 0 ? resto + 360 : resto;
	}
}
