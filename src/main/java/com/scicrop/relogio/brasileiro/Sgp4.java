package com.scicrop.relogio.brasileiro;

/**
 * O propagador SGP4: dado o TLE de um satelite, diz onde ele esta e a que
 * velocidade anda em qualquer instante.
 *
 * E o modelo para o qual os TLE foram feitos. Ele leva em conta o achatamento
 * da Terra (J2, J3 e J4) e o arrasto da atmosfera, e e a versao para orbitas
 * perto da Terra, de periodo menor que 225 minutos, que cobre toda a orbita
 * baixa. Satelites geoestacionarios ou de orbita muito alta precisam do SGP4
 * de espaco profundo, que aqui nao esta.
 *
 * O resultado fica no referencial TEME: inercial, com o eixo z no polo e o
 * eixo x apontando para o equinocio. A passagem para a Terra que gira e feita
 * em Satelite, com o tempo sideral.
 *
 * Segue a formulacao de Hoots e Roehrich (Spacetrack Report no. 3), na
 * organizacao de D. Vallado, com as constantes WGS-72 que os TLE esperam.
 *
 */
public final class Sgp4
{
	/** Raio equatorial da Terra do WGS-72, em km. */
	public static final double RAIO_DA_TERRA_KM = 6378.135;

	private static final double MU = 398600.8;
	private static final double XKE = 60.0 / Math.sqrt(RAIO_DA_TERRA_KM * RAIO_DA_TERRA_KM * RAIO_DA_TERRA_KM / MU);
	private static final double J2 = 0.001082616;
	private static final double J3 = -0.00000253881;
	private static final double J4 = -0.00000165597;
	private static final double J3_SOBRE_J2 = J3 / J2;
	private static final double DOIS_PI = 2 * Math.PI;
	private static final double DOIS_TERCOS = 2.0 / 3.0;

	// elementos iniciais, em radianos e radianos por minuto
	private final double inclinacao;
	private final double nodo;
	private final double excentricidade;
	private final double argumentoDoPerigeu;
	private final double anomaliaMedia;
	private final double bstar;
	private final double movimentoMedio;

	// constantes da inicializacao
	private final boolean simples;
	private final double cc1, cc4, cc5, d2, d3, d4, delmo, eta, argpdot, omgcof, sinmao, t2cof, t3cof, t4cof, t5cof;
	private final double x1mth2, x7thm1, xlcof, aycof, xmcof, mdot, nodedot, nodecf, con41;

	public Sgp4(Tle tle) {
		inclinacao = Math.toRadians(tle.inclinacao());
		nodo = Math.toRadians(tle.nodo());
		excentricidade = tle.excentricidade();
		argumentoDoPerigeu = Math.toRadians(tle.argumentoDoPerigeu());
		anomaliaMedia = Math.toRadians(tle.anomaliaMedia());
		bstar = tle.bstar();

		double noKozai = tle.movimentoMedio() * DOIS_PI / 1440.0;

		// remove do movimento medio do TLE a parte que vem do achatamento (a media de Kozai)
		double cosio = Math.cos(inclinacao);
		double cosio2 = cosio * cosio;
		double omeosq = 1.0 - excentricidade * excentricidade;
		double rteosq = Math.sqrt(omeosq);
		double ak = Math.pow(XKE / noKozai, DOIS_TERCOS);
		double d1 = 0.75 * J2 * (3.0 * cosio2 - 1.0) / (rteosq * omeosq);
		double del = d1 / (ak * ak);
		double adel = ak * (1.0 - del * del - del * (1.0 / 3.0 + 134.0 * del * del / 81.0));
		del = d1 / (adel * adel);
		double no = noKozai / (1.0 + del);
		movimentoMedio = no;

		double ao = Math.pow(XKE / no, DOIS_TERCOS);
		double sinio = Math.sin(inclinacao);
		double po = ao * omeosq;
		double con42 = 1.0 - 5.0 * cosio2;
		con41 = -con42 - cosio2 - cosio2;
		double posq = po * po;
		double rp = ao * (1.0 - excentricidade);

		if (DOIS_PI / no >= 225.0) {
			throw new UnsupportedOperationException(
					"orbita de periodo longo (espaco profundo) nao e suportada por este SGP4");
		}

		double ss = 78.0 / RAIO_DA_TERRA_KM + 1.0;
		double qzms2t = Math.pow((120.0 - 78.0) / RAIO_DA_TERRA_KM, 4);

		simples = rp < 220.0 / RAIO_DA_TERRA_KM + 1.0;

		// para perigeu baixo a atmosfera muda os parametros s e q0 - s
		double sfour = ss;
		double qzms24 = qzms2t;
		double perige = (rp - 1.0) * RAIO_DA_TERRA_KM;
		if (perige < 156.0) {
			sfour = perige - 78.0;
			if (perige < 98.0) {
				sfour = 20.0;
			}
			qzms24 = Math.pow((120.0 - sfour) / RAIO_DA_TERRA_KM, 4);
			sfour = sfour / RAIO_DA_TERRA_KM + 1.0;
		}
		double pinvsq = 1.0 / posq;

		double tsi = 1.0 / (ao - sfour);
		eta = ao * excentricidade * tsi;
		double etasq = eta * eta;
		double eeta = excentricidade * eta;
		double psisq = Math.abs(1.0 - etasq);
		double coef = qzms24 * Math.pow(tsi, 4.0);
		double coef1 = coef / Math.pow(psisq, 3.5);
		double cc2 = coef1 * no * (ao * (1.0 + 1.5 * etasq + eeta * (4.0 + etasq))
				+ 0.375 * J2 * tsi / psisq * con41 * (8.0 + 3.0 * etasq * (8.0 + etasq)));
		cc1 = bstar * cc2;
		double cc3 = 0.0;
		if (excentricidade > 1.0e-4) {
			cc3 = -2.0 * coef * tsi * J3_SOBRE_J2 * no * sinio / excentricidade;
		}
		x1mth2 = 1.0 - cosio2;
		cc4 = 2.0 * no * coef1 * ao * omeosq * (eta * (2.0 + 0.5 * etasq) + excentricidade * (0.5 + 2.0 * etasq)
				- J2 * tsi / (ao * psisq) * (-3.0 * con41 * (1.0 - 2.0 * eeta + etasq * (1.5 - 0.5 * eeta))
						+ 0.75 * x1mth2 * (2.0 * etasq - eeta * (1.0 + etasq)) * Math.cos(2.0 * argumentoDoPerigeu)));
		cc5 = 2.0 * coef1 * ao * omeosq * (1.0 + 2.75 * (etasq + eeta) + eeta * etasq);

		double cosio4 = cosio2 * cosio2;
		double temp1 = 1.5 * J2 * pinvsq * no;
		double temp2 = 0.5 * temp1 * J2 * pinvsq;
		double temp3 = -0.46875 * J4 * pinvsq * pinvsq * no;
		mdot = no + 0.5 * temp1 * rteosq * con41 + 0.0625 * temp2 * rteosq * (13.0 - 78.0 * cosio2 + 137.0 * cosio4);
		argpdot = -0.5 * temp1 * con42 + 0.0625 * temp2 * (7.0 - 114.0 * cosio2 + 395.0 * cosio4)
				+ temp3 * (3.0 - 36.0 * cosio2 + 49.0 * cosio4);
		double xhdot1 = -temp1 * cosio;
		nodedot = xhdot1 + (0.5 * temp2 * (4.0 - 19.0 * cosio2) + 2.0 * temp3 * (3.0 - 7.0 * cosio2)) * cosio;
		omgcof = bstar * cc3 * Math.cos(argumentoDoPerigeu);
		xmcof = excentricidade > 1.0e-4 ? -DOIS_TERCOS * coef * bstar / eeta : 0.0;
		nodecf = 3.5 * omeosq * xhdot1 * cc1;
		t2cof = 1.5 * cc1;

		double divisor = Math.abs(cosio + 1.0) > 1.5e-12 ? 1.0 + cosio : 1.5e-12;
		xlcof = -0.25 * J3_SOBRE_J2 * sinio * (3.0 + 5.0 * cosio) / divisor;
		aycof = -0.5 * J3_SOBRE_J2 * sinio;
		delmo = Math.pow(1.0 + eta * Math.cos(anomaliaMedia), 3);
		sinmao = Math.sin(anomaliaMedia);
		x7thm1 = 7.0 * cosio2 - 1.0;

		if (!simples) {
			double cc1sq = cc1 * cc1;
			d2 = 4.0 * ao * tsi * cc1sq;
			double temp = d2 * tsi * cc1 / 3.0;
			d3 = (17.0 * ao + sfour) * temp;
			d4 = 0.5 * temp * ao * tsi * (221.0 * ao + 31.0 * sfour) * cc1;
			t3cof = d2 + 2.0 * cc1sq;
			t4cof = 0.25 * (3.0 * d3 + cc1 * (12.0 * d2 + 10.0 * cc1sq));
			t5cof = 0.2 * (3.0 * d4 + 12.0 * cc1 * d3 + 6.0 * d2 * d2 + 15.0 * cc1sq * (2.0 * d2 + cc1sq));
		} else {
			d2 = d3 = d4 = t3cof = t4cof = t5cof = 0.0;
		}
	}

	/**
	 * Periodo da orbita, em minutos.
	 */
	public double periodoEmMinutos() {
		return DOIS_PI / movimentoMedio;
	}

	/**
	 * Posicao e velocidade no referencial TEME.
	 *
	 * @param minutos tempo desde a epoca do TLE, podendo ser negativo
	 * @return { x, y, z } em km e { vx, vy, vz } em km/s
	 * @throws IllegalStateException se a orbita nao fizer mais sentido (o satelite ja reentrou)
	 */
	public double[][] propagar(double minutos) {
		double t = minutos;
		double vkmpersec = RAIO_DA_TERRA_KM * XKE / 60.0;

		// atualiza para o arrasto e para o achatamento da Terra
		double xmdf = anomaliaMedia + mdot * t;
		double argpdf = argumentoDoPerigeu + argpdot * t;
		double nodedf = nodo + nodedot * t;
		double argpm = argpdf;
		double mm = xmdf;
		double t2 = t * t;
		double nodem = nodedf + nodecf * t2;
		double tempa = 1.0 - cc1 * t;
		double tempe = bstar * cc4 * t;
		double templ = t2cof * t2;

		if (!simples) {
			double delomg = omgcof * t;
			double delm = xmcof * (Math.pow(1.0 + eta * Math.cos(xmdf), 3) - delmo);
			double temp = delomg + delm;
			mm = xmdf + temp;
			argpm = argpdf - temp;
			double t3 = t2 * t;
			double t4 = t3 * t;
			tempa = tempa - d2 * t2 - d3 * t3 - d4 * t4;
			tempe = tempe + bstar * cc5 * (Math.sin(mm) - sinmao);
			templ = templ + t3cof * t3 + t4 * (t4cof + t * t5cof);
		}

		double nm = movimentoMedio;
		double em = excentricidade;
		double inclm = inclinacao;

		double am = Math.pow(XKE / nm, DOIS_TERCOS) * tempa * tempa;
		nm = XKE / Math.pow(am, 1.5);
		em = em - tempe;
		if (em >= 1.0 || em < -0.001) {
			throw new IllegalStateException("excentricidade fora do intervalo: " + em);
		}
		if (em < 1.0e-6) {
			em = 1.0e-6;
		}
		mm = mm + movimentoMedio * templ;
		double xlm = mm + argpm + nodem;

		nodem = nodem % DOIS_PI;
		argpm = argpm % DOIS_PI;
		xlm = xlm % DOIS_PI;
		mm = (xlm - argpm - nodem) % DOIS_PI;

		double sinim = Math.sin(inclm);
		double cosim = Math.cos(inclm);

		// termos de longo periodo
		double ep = em;
		double argpp = argpm;
		double omegap = nodem;
		double mp = mm;
		double axnl = ep * Math.cos(argpp);
		double temp = 1.0 / (am * (1.0 - ep * ep));
		double aynl = ep * Math.sin(argpp) + temp * aycof;
		double xl = mp + argpp + omegap + temp * xlcof * axnl;

		// equacao de Kepler, na forma de Newton
		double u = (xl - omegap) % DOIS_PI;
		double eo1 = u;
		double sineo1 = 0, coseo1 = 0;
		double tem5 = 9999.9;
		for (int ktr = 1; Math.abs(tem5) >= 1.0e-12 && ktr <= 10; ktr++) {
			sineo1 = Math.sin(eo1);
			coseo1 = Math.cos(eo1);
			tem5 = 1.0 - coseo1 * axnl - sineo1 * aynl;
			tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / tem5;
			if (Math.abs(tem5) >= 0.95) {
				tem5 = tem5 > 0.0 ? 0.95 : -0.95;
			}
			eo1 = eo1 + tem5;
		}

		// termos de curto periodo
		double ecose = axnl * coseo1 + aynl * sineo1;
		double esine = axnl * sineo1 - aynl * coseo1;
		double el2 = axnl * axnl + aynl * aynl;
		double pl = am * (1.0 - el2);
		if (pl < 0.0) {
			throw new IllegalStateException("semi-latus rectum negativo");
		}

		double rl = am * (1.0 - ecose);
		double rdotl = Math.sqrt(am) * esine / rl;
		double rvdotl = Math.sqrt(pl) / rl;
		double betal = Math.sqrt(1.0 - el2);
		temp = esine / (1.0 + betal);
		double sinu = am / rl * (sineo1 - aynl - axnl * temp);
		double cosu = am / rl * (coseo1 - axnl + aynl * temp);
		double su = Math.atan2(sinu, cosu);
		double sin2u = (cosu + cosu) * sinu;
		double cos2u = 1.0 - 2.0 * sinu * sinu;
		temp = 1.0 / pl;
		double temp1 = 0.5 * J2 * temp;
		double temp2 = temp1 * temp;

		double mrt = rl * (1.0 - 1.5 * temp2 * betal * con41) + 0.5 * temp1 * x1mth2 * cos2u;
		su = su - 0.25 * temp2 * x7thm1 * sin2u;
		double xnode = omegap + 1.5 * temp2 * cosim * sin2u;
		double xinc = inclm + 1.5 * temp2 * cosim * sinim * cos2u;
		double mvt = rdotl - nm * temp1 * x1mth2 * sin2u / XKE;
		double rvdot = rvdotl + nm * temp1 * (x1mth2 * cos2u + 1.5 * con41) / XKE;

		if (mrt < 1.0) {
			throw new IllegalStateException("o satelite ja reentrou na atmosfera");
		}

		// vetores de orientacao
		double sinsu = Math.sin(su), cossu = Math.cos(su);
		double snod = Math.sin(xnode), cnod = Math.cos(xnode);
		double sini = Math.sin(xinc), cosi = Math.cos(xinc);
		double xmx = -snod * cosi;
		double xmy = cnod * cosi;
		double ux = xmx * sinsu + cnod * cossu;
		double uy = xmy * sinsu + snod * cossu;
		double uz = sini * sinsu;
		double vx = xmx * cossu - cnod * sinsu;
		double vy = xmy * cossu - snod * sinsu;
		double vz = sini * cossu;

		double raio = mrt * RAIO_DA_TERRA_KM;
		return new double[][] {
				{ raio * ux, raio * uy, raio * uz },
				{ (mvt * ux + rvdot * vx) * vkmpersec, (mvt * uy + rvdot * vy) * vkmpersec,
						(mvt * uz + rvdot * vz) * vkmpersec } };
	}
}
