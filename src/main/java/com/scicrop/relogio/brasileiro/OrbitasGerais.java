package com.scicrop.relogio.brasileiro;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.time.Instant;


/**
 * As orbitas juntas: a ecliptica, que e o plano em que a Terra e o Sol se
 * veem, e o plano da orbita da Lua, inclinado 5,1 graus em relacao a ela.
 *
 * Os dois planos se cortam numa reta que passa pela Terra, a linha dos nos. A
 * Lua so cruza a ecliptica nos dois nos, e por isso nao ha eclipse todo mes:
 * so quando a lua nova ou a cheia acontece perto de um no. A linha dos nos
 * ainda gira para tras, dando uma volta completa a cada 18,6 anos, o que faz
 * as temporadas de eclipse andarem pelo calendario.
 *
 * Tudo se move: o tempo corre acelerado, um dia por segundo, e as posicoes do
 * Sol, da Lua e dos nos saem das formulas de elementos medios, com precisao
 * de cerca de um grau.
 *
 */
public class OrbitasGerais extends Cena
{
	private static final Color COR_ECLIPTICA = new Color(190, 190, 205);
	private static final Color COR_PLANO_ECLIPTICA = new Color(190, 190, 205, 38);
	private static final Color COR_ORBITA_LUA = new Color(150, 190, 250);
	private static final Color COR_PLANO_LUA = new Color(120, 170, 250, 45);
	private static final Color COR_NOS = new Color(255, 205, 80);
	private static final Color COR_SOL = new Color(255, 200, 40);
	private static final Color COR_TERRA = new Color(70, 140, 230);
	private static final Color COR_LUA_CLARA = new Color(238, 238, 228);
	private static final Color COR_LUA_ESCURA = new Color(60, 60, 75);
	private static final Color COR_ALERTA = new Color(255, 120, 90);

	/** Inclinacao da orbita da Lua em relacao a ecliptica. */
	private static final double INCLINACAO = 5.1;

	/**
	 * A inclinacao verdadeira quase nao aparece num desenho deste tamanho,
	 * entao ela e desenhada multiplicada, como nos diagramas de livro.
	 */
	private static final int EXAGERO_DA_INCLINACAO = 2;

	/** De quanto o Sol pode estar longe de um no e ainda haver eclipse. */
	private static final double LIMITE_DA_TEMPORADA = 17;

	/** Altura de onde a cena e vista, contada a partir do plano da ecliptica. */
	private static final double ELEVACAO = Math.toRadians(25);

	public OrbitasGerais() {
		super("OrbitasGerais");
	}

	protected void desenhar(Graphics2D g2, Instant agora) {
		double dias = diasDesdeJ2000(agora);

		double longitudeDoSol = longitudeDoSol(dias);
		double longitudeDaLua = grau(218.316 + 13.176396 * dias);
		double longitudeDoNo = grau(125.0445 - 0.0529538083 * dias);

		// a cena ocupa o que sobra entre o cabecalho e as linhas de baixo, e o
		// quadro de canto fica ancorado no canto, seja qual for o tamanho
		int centroY = (60 + getHeight() - 96) / 2;
		int raio = Math.min((getHeight() - 156) / 2 - 10, getWidth() / 2 - 70);
		int raioDoQuadro = (int) (Math.min(getWidth(), getHeight()) * 0.125);

		desenharLegenda(g2, longitudeDoSol, longitudeDaLua, longitudeDoNo);
		desenharCena(g2, getWidth() / 2, centroY, raio, longitudeDoSol, longitudeDaLua, longitudeDoNo);
		desenharVisaoDeCima(g2, getWidth() - raioDoQuadro - 66, getHeight() - raioDoQuadro - 24, raioDoQuadro,
				longitudeDoSol, longitudeDoNo);
		desenharSituacao(g2, longitudeDoSol, longitudeDaLua, longitudeDoNo);
	}

	private void desenharLegenda(Graphics2D g2, double sol, double lua, double no) {
		int y = 70;
		y = linhaDaLegenda(g2, COR_ECLIPTICA, "Eclíptica: o caminho aparente do Sol", y);
		y = linhaDaLegenda(g2, COR_ORBITA_LUA, "Plano da órbita da Lua, 5,1° à eclíptica", y);
		y = linhaDaLegenda(g2, COR_NOS, "Linha dos nós: onde os planos se cortam", y);

		g2.setColor(COR_APAGADA);
		y += 10;
		String[] legenda = {
				String.format(PT_BR, "Longitude do Sol: %.1f°", sol),
				String.format(PT_BR, "Longitude da Lua: %.1f°", lua),
				String.format(PT_BR, "Nó ascendente: %.1f°", no),
				"",
				"Inclinação real de 5,1°, desenhada " + EXAGERO_DA_INCLINACAO + " vezes",
				"maior para dar para ver. Distâncias fora de escala." };
		for (String linha : legenda) {
			g2.drawString(linha, 14, y);
			y += 17;
		}
	}

	private int linhaDaLegenda(Graphics2D g2, Color cor, String texto, int y) {
		g2.setColor(cor);
		g2.setStroke(new BasicStroke(2));
		g2.drawLine(14, y - 4, 34, y - 4);
		g2.drawString(texto, 42, y);
		return y + 19;
	}

	/**
	 * A cena principal, como no diagrama dos dois planos: a Terra no meio, a
	 * ecliptica com o Sol correndo por ela, o plano da Lua cortando a
	 * ecliptica e a linha dos nos saindo dos dois lados.
	 */
	private void desenharCena(Graphics2D g2, int centroX, int centroY, int raio,
			double longitudeDoSol, double longitudeDaLua, double longitudeDoNo) {
		double inclinacao = Math.toRadians(INCLINACAO * EXAGERO_DA_INCLINACAO);
		double no = Math.toRadians(longitudeDoNo);
		int achatamento = (int) (raio * Math.sin(ELEVACAO));

		g2.setColor(COR_PLANO_ECLIPTICA);
		g2.fillOval(centroX - raio, centroY - achatamento, raio * 2, achatamento * 2);
		g2.setColor(COR_ECLIPTICA);
		g2.setStroke(new BasicStroke(1));
		g2.drawOval(centroX - raio, centroY - achatamento, raio * 2, achatamento * 2);

		Polygon planoDaLua = new Polygon();
		for (int passo = 0; passo <= 180; passo++) {
			double u = passo * 2 * Math.PI / 180;
			planoDaLua.addPoint(telaX(centroX, raio, u, no, inclinacao), telaY(centroY, raio, u, no, inclinacao));
		}
		g2.setColor(COR_PLANO_LUA);
		g2.fillPolygon(planoDaLua);
		g2.setColor(COR_ORBITA_LUA);
		g2.setStroke(new BasicStroke(2));
		g2.drawPolygon(planoDaLua);

		desenharLinhaDosNos(g2, centroX, centroY, raio, no);

		int solX = (int) (centroX + raio * Math.cos(Math.toRadians(longitudeDoSol)));
		int solY = (int) (centroY - raio * Math.sin(Math.toRadians(longitudeDoSol)) * Math.sin(ELEVACAO));
		desenharSol(g2, solX, solY);

		double u = Math.toRadians(longitudeDaLua - longitudeDoNo);
		int luaX = telaX(centroX, raio, u, no, inclinacao);
		int luaY = telaY(centroY, raio, u, no, inclinacao);
		double fase = fracao((longitudeDaLua - longitudeDoSol) / 360);
		Lua.desenharDisco(g2, luaX, luaY, 11, fase, COR_LUA_CLARA, COR_LUA_ESCURA, COR_ORBITA_LUA);

		g2.setColor(COR_TERRA);
		g2.fillOval(centroX - 16, centroY - 16, 32, 32);

		g2.setColor(COR_TEXTO);
		desenharTextoCentralizado(g2, "Terra", centroX, centroY + 30);
		desenharTextoCentralizado(g2, "Sol", solX, solY - 26);
		desenharTextoCentralizado(g2, "Lua", luaX, luaY - 22);

		g2.setColor(COR_ECLIPTICA);
		desenharTextoCentralizado(g2, "Eclíptica", centroX, centroY + achatamento + 18);
	}

	/** A reta onde os dois planos se cortam, com um no em cada ponta. */
	private void desenharLinhaDosNos(Graphics2D g2, int centroX, int centroY, int raio, double no) {
		int ascendenteX = (int) (centroX + raio * 1.22 * Math.cos(no));
		int ascendenteY = (int) (centroY - raio * 1.22 * Math.sin(no) * Math.sin(ELEVACAO));
		int descendenteX = (int) (centroX - raio * 1.22 * Math.cos(no));
		int descendenteY = (int) (centroY + raio * 1.22 * Math.sin(no) * Math.sin(ELEVACAO));

		g2.setColor(COR_NOS);
		g2.setStroke(new BasicStroke(1));
		g2.drawLine(descendenteX, descendenteY, ascendenteX, ascendenteY);

		int noX = (int) (centroX + raio * Math.cos(no));
		int noY = (int) (centroY - raio * Math.sin(no) * Math.sin(ELEVACAO));
		g2.fillOval(noX - 5, noY - 5, 10, 10);
		g2.drawOval((int) (centroX - raio * Math.cos(no)) - 5, (int) (centroY + raio * Math.sin(no) * Math.sin(ELEVACAO)) - 5, 10, 10);

		desenharTextoCentralizado(g2, "nó ascendente", noX, noY + 18);
		desenharTextoCentralizado(g2, "nó descendente", (int) (centroX - raio * Math.cos(no)),
				(int) (centroY + raio * Math.sin(no) * Math.sin(ELEVACAO)) - 16);
		desenharTextoCentralizado(g2, "linha dos nós", ascendenteX, ascendenteY + 18);
	}

	/**
	 * O quadro de canto, visto de cima da ecliptica: a Terra dando a volta no
	 * Sol e a linha dos nos, que fica quase parada no espaco enquanto a Terra
	 * anda. Quando as duas se alinham, e temporada de eclipses.
	 */
	private void desenharVisaoDeCima(Graphics2D g2, int centroX, int centroY, int raio,
			double longitudeDoSol, double longitudeDoNo) {
		g2.setColor(COR_APAGADA);
		desenharTextoCentralizado(g2, "Visto de cima da eclíptica", centroX, centroY - raio - 24);

		g2.setColor(COR_ECLIPTICA);
		g2.setStroke(new BasicStroke(1));
		g2.drawOval(centroX - raio, centroY - raio, raio * 2, raio * 2);

		g2.setColor(COR_SOL);
		g2.fillOval(centroX - 9, centroY - 9, 18, 18);

		// a Terra fica no lado oposto ao que o Sol aparece no ceu
		double terra = Math.toRadians(longitudeDoSol + 180);
		int terraX = (int) (centroX + raio * Math.cos(terra));
		int terraY = (int) (centroY - raio * Math.sin(terra));
		g2.setColor(COR_TERRA);
		g2.fillOval(terraX - 7, terraY - 7, 14, 14);

		double no = Math.toRadians(longitudeDoNo);
		g2.setColor(COR_NOS);
		g2.drawLine((int) (terraX - raio * 0.5 * Math.cos(no)), (int) (terraY + raio * 0.5 * Math.sin(no)),
				(int) (terraX + raio * 0.5 * Math.cos(no)), (int) (terraY - raio * 0.5 * Math.sin(no)));
	}

	private void desenharSituacao(Graphics2D g2, double longitudeDoSol, double longitudeDaLua, double longitudeDoNo) {
		double distanciaDoNo = distanciaAoNo(longitudeDoSol, longitudeDoNo);
		double fase = fracao((longitudeDaLua - longitudeDoSol) / 360);
		boolean temporada = distanciaDoNo <= LIMITE_DA_TEMPORADA;

		g2.setColor(COR_TEXTO);
		g2.drawString(String.format(PT_BR, "Lua: %s, %.0f%% iluminada", Lua.nomeDaFase(fase), Lua.iluminacao(fase) * 100),
				14, getHeight() - 78);
		g2.drawString(String.format(PT_BR, "Sol a %.1f° do nó mais próximo", distanciaDoNo), 14, getHeight() - 58);

		g2.setColor(temporada ? COR_ALERTA : COR_APAGADA);
		g2.drawString(temporada ? "Temporada de eclipses: a lua nova ou cheia daqui pode cair em cima de um nó"
				: "Fora de temporada: nesta lunação a Lua passa longe da eclíptica na nova e na cheia",
				14, getHeight() - 38);

	}

	private void desenharSol(Graphics2D g2, int x, int y) {
		g2.setColor(COR_SOL);
		g2.fillOval(x - 15, y - 15, 30, 30);
		g2.setStroke(new BasicStroke(1));
		for (int i = 0; i < 12; i++) {
			double a = i * Math.PI / 6;
			g2.drawLine((int) (x + 17 * Math.cos(a)), (int) (y + 17 * Math.sin(a)),
					(int) (x + 23 * Math.cos(a)), (int) (y + 23 * Math.sin(a)));
		}
	}

	/** Quantos graus separam o Sol do no mais proximo, de 0 a 90. */
	private double distanciaAoNo(double longitudeDoSol, double longitudeDoNo) {
		double diferenca = grau(longitudeDoSol - longitudeDoNo) % 180;
		return diferenca > 90 ? 180 - diferenca : diferenca;
	}

	/**
	 * Ponto da orbita da Lua, a um angulo u contado do no ascendente, jogado
	 * na tela.
	 */
	private int telaX(int centroX, int raio, double u, double no, double inclinacao) {
		double x = raio * (Math.cos(u) * Math.cos(no) - Math.sin(u) * Math.sin(no) * Math.cos(inclinacao));
		return (int) (centroX + x);
	}

	private int telaY(int centroY, int raio, double u, double no, double inclinacao) {
		double y = raio * (Math.cos(u) * Math.sin(no) + Math.sin(u) * Math.cos(no) * Math.cos(inclinacao));
		double z = raio * Math.sin(u) * Math.sin(inclinacao);
		return (int) (centroY - (y * Math.sin(ELEVACAO) + z * Math.cos(ELEVACAO)));
	}
}
