package com.scicrop.relogio.brasileiro;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Onde estao os planetas, vistos da Terra, num instante.
 *
 * A conta usa os elementos keplerianos aproximados da JPL (E. M. Standish,
 * "Keplerian Elements for Approximate Positions of the Major Planets",
 * tabela valida de 1800 a 2050): cada planeta e uma elipse em torno do Sol, e
 * a posicao vista da Terra e a diferenca entre a posicao do planeta e a da
 * propria Terra. O erro fica em poucos minutos de arco, bem abaixo do que o
 * olho nu distingue, mas nao serve para uma ocultacao precisa.
 *
 * As posicoes saem em ascensao reta e declinacao do J2000, o mesmo sistema do
 * catalogo de estrelas, entao entram nas telas do ceu do mesmo jeito que elas.
 *
 */
public final class Planetas
{
	private static final Instant J2000 = Instant.parse("2000-01-01T12:00:00Z");

	/** Inclinacao da ecliptica no J2000. */
	private static final double OBLIQUIDADE = Math.toRadians(23.43928);

	/**
	 * Nome e elementos de cada planeta, cada um com o valor em J2000 e a taxa
	 * por seculo: semi eixo maior (UA), excentricidade, inclinacao, longitude
	 * media, longitude do periélio e longitude do nodo ascendente (graus).
	 */
	private record Elementos(String nome, double[] a, double[] e, double[] i, double[] l, double[] w, double[] o)
	{
	}

	private static final Elementos TERRA = new Elementos("Terra",
			new double[] { 1.00000261, 0.00000562 }, new double[] { 0.01671123, -0.00004392 },
			new double[] { -0.00001531, -0.01294668 }, new double[] { 100.46457166, 35999.37244981 },
			new double[] { 102.93768193, 0.32327364 }, new double[] { 0.0, 0.0 });

	private static final Elementos[] PLANETAS = {
			new Elementos("Mercúrio",
					new double[] { 0.38709927, 0.00000037 }, new double[] { 0.20563593, 0.00001906 },
					new double[] { 7.00497902, -0.00594749 }, new double[] { 252.25032350, 149472.67411175 },
					new double[] { 77.45779628, 0.16047689 }, new double[] { 48.33076593, -0.12534081 }),
			new Elementos("Vênus",
					new double[] { 0.72333566, 0.00000390 }, new double[] { 0.00677672, -0.00004107 },
					new double[] { 3.39467605, -0.00078890 }, new double[] { 181.97909950, 58517.81538729 },
					new double[] { 131.60246718, 0.00268329 }, new double[] { 76.67984255, -0.27769418 }),
			new Elementos("Marte",
					new double[] { 1.52371034, 0.00001847 }, new double[] { 0.09339410, 0.00007882 },
					new double[] { 1.84969142, -0.00813131 }, new double[] { -4.55343205, 19140.30268499 },
					new double[] { -23.94362959, 0.44441088 }, new double[] { 49.55953891, -0.29257343 }),
			new Elementos("Júpiter",
					new double[] { 5.20288700, -0.00011607 }, new double[] { 0.04838624, -0.00013253 },
					new double[] { 1.30439695, -0.00183714 }, new double[] { 34.39644051, 3034.74612775 },
					new double[] { 14.72847983, 0.21252668 }, new double[] { 100.47390909, 0.20469106 }),
			new Elementos("Saturno",
					new double[] { 9.53667594, -0.00125060 }, new double[] { 0.05386179, -0.00050991 },
					new double[] { 2.48599187, 0.00193609 }, new double[] { 49.95424423, 1222.49362201 },
					new double[] { 92.59887831, -0.41897216 }, new double[] { 113.66242448, -0.28867794 }),
			new Elementos("Urano",
					new double[] { 19.18916464, -0.00196176 }, new double[] { 0.04725744, -0.00004397 },
					new double[] { 0.77263783, -0.00242939 }, new double[] { 313.23810451, 428.48202785 },
					new double[] { 170.95427630, 0.40805281 }, new double[] { 74.01692503, 0.04240589 }),
			new Elementos("Netuno",
					new double[] { 30.06992276, 0.00026291 }, new double[] { 0.00859048, 0.00005105 },
					new double[] { 1.77004347, 0.00035372 }, new double[] { -55.12002969, 218.45945325 },
					new double[] { 44.96476227, -0.32241464 }, new double[] { 131.78422574, -0.00508664 }) };

	/**
	 * Um planeta visto da Terra.
	 *
	 * @param ascensaoReta em graus, J2000
	 * @param declinacao em graus, J2000
	 * @param magnitude brilho aparente: quanto menor, mais brilhante
	 * @param distanciaEmUA distancia ate a Terra
	 */
	public record Planeta(String nome, double ascensaoReta, double declinacao, double magnitude, double distanciaEmUA)
	{
	}

	private Planetas() {
	}

	public static List<Planeta> em(Instant instante) {
		double seculos = Duration.between(J2000, instante).toMillis() / 86_400_000d / 36525d;

		double[] terra = heliocentrica(TERRA, seculos);
		double distanciaTerraSol = norma(terra);

		List<Planeta> lista = new ArrayList<>();
		for (Elementos elementos : PLANETAS) {
			double[] planeta = heliocentrica(elementos, seculos);
			double[] vista = { planeta[0] - terra[0], planeta[1] - terra[1], planeta[2] - terra[2] };

			double distancia = norma(vista);
			double distanciaAoSol = norma(planeta);

			// da ecliptica para o equador
			double x = vista[0];
			double y = vista[1] * Math.cos(OBLIQUIDADE) - vista[2] * Math.sin(OBLIQUIDADE);
			double z = vista[1] * Math.sin(OBLIQUIDADE) + vista[2] * Math.cos(OBLIQUIDADE);

			double ascensaoReta = Math.toDegrees(Math.atan2(y, x));
			if (ascensaoReta < 0) {
				ascensaoReta += 360;
			}
			double declinacao = Math.toDegrees(Math.asin(z / distancia));

			// angulo de fase: o Sol, o planeta e a Terra formam um triangulo
			double cosFase = (distanciaAoSol * distanciaAoSol + distancia * distancia
					- distanciaTerraSol * distanciaTerraSol) / (2 * distanciaAoSol * distancia);
			double fase = Math.toDegrees(Math.acos(Math.max(-1, Math.min(1, cosFase))));

			double magnitude = magnitude(elementos.nome(), distanciaAoSol, distancia, fase, new double[] { x, y, z });
			lista.add(new Planeta(elementos.nome(), ascensaoReta, declinacao, magnitude, distancia));
		}

		return lista;
	}

	/**
	 * Posicao do planeta em coordenadas ecliptica do J2000, com o Sol na
	 * origem, em UA.
	 */
	private static double[] heliocentrica(Elementos el, double seculos) {
		double a = el.a()[0] + el.a()[1] * seculos;
		double e = el.e()[0] + el.e()[1] * seculos;
		double inclinacao = Math.toRadians(el.i()[0] + el.i()[1] * seculos);
		double longitudeMedia = el.l()[0] + el.l()[1] * seculos;
		double longitudePeriélio = el.w()[0] + el.w()[1] * seculos;
		double nodo = Math.toRadians(el.o()[0] + el.o()[1] * seculos);

		double argumentoDoPeriélio = Math.toRadians(longitudePeriélio) - nodo;
		double anomaliaMedia = Math.toRadians(normalizar(longitudeMedia - longitudePeriélio));

		// equacao de Kepler, por Newton
		double anomaliaExcentrica = anomaliaMedia + e * Math.sin(anomaliaMedia);
		for (int i = 0; i < 12; i++) {
			double delta = (anomaliaExcentrica - e * Math.sin(anomaliaExcentrica) - anomaliaMedia)
					/ (1 - e * Math.cos(anomaliaExcentrica));
			anomaliaExcentrica -= delta;
			if (Math.abs(delta) < 1e-12) {
				break;
			}
		}

		// no plano da orbita
		double xOrbita = a * (Math.cos(anomaliaExcentrica) - e);
		double yOrbita = a * Math.sqrt(1 - e * e) * Math.sin(anomaliaExcentrica);

		double cw = Math.cos(argumentoDoPeriélio), sw = Math.sin(argumentoDoPeriélio);
		double co = Math.cos(nodo), so = Math.sin(nodo);
		double ci = Math.cos(inclinacao), si = Math.sin(inclinacao);

		return new double[] {
				(cw * co - sw * so * ci) * xOrbita + (-sw * co - cw * so * ci) * yOrbita,
				(cw * so + sw * co * ci) * xOrbita + (-sw * so + cw * co * ci) * yOrbita,
				(sw * si) * xOrbita + (cw * si) * yOrbita };
	}

	/**
	 * Brilho aparente pelas formulas do Astronomical Almanac. Saturno ainda
	 * perde ou ganha brilho conforme os aneis estao de lado ou abertos para nos.
	 *
	 * @param vista direcao da Terra ao planeta, no equador, para a inclinacao dos aneis
	 */
	private static double magnitude(String nome, double r, double delta, double fase, double[] vista) {
		double distancias = 5 * Math.log10(r * delta);
		switch (nome) {
		case "Mercúrio":
			return -0.42 + distancias + 0.0380 * fase - 0.000273 * fase * fase + 0.000002 * fase * fase * fase;
		case "Vênus":
			return -4.40 + distancias + 0.0009 * fase + 0.000239 * fase * fase - 0.00000065 * fase * fase * fase;
		case "Marte":
			return -1.52 + distancias + 0.016 * fase;
		case "Júpiter":
			return -9.40 + distancias + 0.005 * fase;
		case "Saturno":
			// o polo de Saturno aponta para RA 40,589 e Dec 83,537
			double ra = Math.toRadians(40.589), dec = Math.toRadians(83.537);
			double[] polo = { Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec) };
			double seno = (polo[0] * vista[0] + polo[1] * vista[1] + polo[2] * vista[2]) / delta;
			return -8.88 + distancias - 2.60 * Math.abs(seno) + 1.25 * seno * seno;
		case "Urano":
			return -7.19 + distancias;
		default:
			return -6.87 + distancias;
		}
	}

	private static double norma(double[] v) {
		return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
	}

	/** Leva um angulo, em graus, para o intervalo de -180 a 180. */
	private static double normalizar(double graus) {
		double resto = graus % 360;
		if (resto > 180) {
			resto -= 360;
		} else if (resto < -180) {
			resto += 360;
		}
		return resto;
	}
}
