package com.scicrop.relogio.brasileiro;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.time.Duration;
import java.time.Instant;

/**
 * O ceu visto de casa, agora.
 *
 * E o ceu inteiro que esta acima do horizonte, achatado num disco: o zenite,
 * o ponto exatamente acima da cabeca, fica no centro, e a borda e o horizonte.
 * Como se olha para cima, e nao para um mapa, o leste fica a esquerda.
 *
 * A projecao e a estereografica, a mesma dos planisferios de papel: o raio
 * cresce com a tangente de metade da distancia ao zenite, o que mantem as
 * formas das constelacoes reconheciveis mesmo perto do horizonte.
 *
 * As estrelas sao as 5042 do catalogo Hipparcos que vem com o WorldWind, ate
 * magnitude 6. O tamanho de cada ponto vem do brilho e a cor vem do indice B
 * menos V. O Sol e a Lua entram por cima, com a Lua na fase certa.
 *
 * O fundo acompanha a altura do Sol: azul de dia, passando pelos crepusculos
 * ate o preto da noite fechada, e as estrelas somem no clarao do dia.
 *
 */
public class CeuDaCasa extends Cena
{
	private static final Instant J2000 = Instant.parse("2000-01-01T12:00:00Z");

	private static final Color COR_NOITE = new Color(6, 8, 20);
	private static final Color COR_DIA = new Color(92, 142, 212);
	private static final Color COR_GRADE = new Color(70, 90, 130);
	private static final Color COR_HORIZONTE = new Color(150, 170, 210);
	private static final Color COR_SOL = new Color(255, 225, 90);
	private static final Color COR_LUA_CLARA = new Color(240, 240, 228);
	private static final Color COR_LUA_ESCURA = new Color(70, 70, 85);

	/** Abaixo disso o Sol ja nao clareia mais o ceu. */
	private static final double FIM_DO_CREPUSCULO = -18;

	private static final Color COR_CONSTELACAO = new Color(95, 125, 185);

	/** Margens que o disco respeita, para o cabecalho e as linhas de baixo. */
	private static final int MARGEM_DE_CIMA = 56;
	private static final int MARGEM_DE_BAIXO = 76;

	private final Configuracao casa = Configuracao.ler();
	private final CatalogoDeEstrelas estrelas = CatalogoDeEstrelas.carregar();
	private final LinhasDasConstelacoes constelacoes = LinhasDasConstelacoes.carregar();

	private double zoom = 1;
	private int deslocamentoX;
	private int deslocamentoY;
	private Point arrasto;

	public CeuDaCasa() {
		// o ceu anda so no tempo real: nada de acelerar as estrelas
		super("CeuDaCasa", false);

		atalho("typed +", () -> aproximar(1.25, getWidth() / 2, centroY()));
		atalho("typed -", () -> aproximar(1 / 1.25, getWidth() / 2, centroY()));
		atalho("0", () -> {
			zoom = 1;
			deslocamentoX = 0;
			deslocamentoY = 0;
		});

		addMouseWheelListener(e -> {
			aproximar(Math.pow(1.2, -e.getWheelRotation()), e.getX(), e.getY());
			repaint();
		});

		MouseAdapter mao = new MouseAdapter() {
			public void mousePressed(MouseEvent e) {
				arrasto = e.getPoint();
			}

			public void mouseDragged(MouseEvent e) {
				if (arrasto != null) {
					deslocamentoX += e.getX() - arrasto.x;
					deslocamentoY += e.getY() - arrasto.y;
					arrasto = e.getPoint();
					repaint();
				}
			}

			public void mouseReleased(MouseEvent e) {
				arrasto = null;
			}
		};
		addMouseListener(mao);
		addMouseMotionListener(mao);
	}

	protected String dicasExtras() {
		return String.format(PT_BR, "roda do mouse aproxima (%.1fx), arrastar move, 0 volta ao normal", zoom);
	}

	/**
	 * Aproxima ou afasta mantendo parado o ponto do ceu que esta sob o cursor.
	 */
	private void aproximar(double fator, int ancoraX, int ancoraY) {
		double anterior = zoom;
		zoom = Math.max(1, Math.min(20, zoom * fator));

		double mudanca = zoom / anterior;
		int baseX = getWidth() / 2;
		int baseY = centroDaBase();
		deslocamentoX = (int) ((ancoraX - baseX) - mudanca * (ancoraX - baseX - deslocamentoX));
		deslocamentoY = (int) ((ancoraY - baseY) - mudanca * (ancoraY - baseY - deslocamentoY));
	}

	private int centroDaBase() {
		return (MARGEM_DE_CIMA + getHeight() - MARGEM_DE_BAIXO) / 2;
	}

	private int centroX() {
		return getWidth() / 2 + deslocamentoX;
	}

	private int centroY() {
		return centroDaBase() + deslocamentoY;
	}

	private int raio() {
		int base = Math.min((getHeight() - MARGEM_DE_CIMA - MARGEM_DE_BAIXO) / 2 - 18, getWidth() / 2 - 60);
		return (int) (base * zoom);
	}

	protected void desenhar(Graphics2D g2, Instant instante) {
		if (casa == null) {
			g2.setColor(COR_TEXTO);
			desenharTextoCentralizado(g2, "Sem data/config.json com a chave home", getWidth() / 2, getHeight() / 2);
			return;
		}

		int centroX = centroX();
		int centroY = centroY();
		int raio = raio();

		double dias = Duration.between(J2000, instante).toMillis() / 86_400_000d;
		double tempoSideral = Horizonte.tempoSideralLocal(dias, casa.getLongitude());
		PosicaoDoSol sol = PosicaoDoSol.em(instante);
		double alturaDoSol = sol.altura(casa.getLatitude(), casa.getLongitude());

		double claridade = claridade(alturaDoSol);

		desenharCeu(g2, centroX, centroY, raio, claridade);
		desenharGrade(g2, centroX, centroY, raio);
		desenharConstelacoes(g2, centroX, centroY, raio, tempoSideral, claridade);
		int visiveis = desenharEstrelas(g2, centroX, centroY, raio, tempoSideral, claridade);
		desenharLua(g2, centroX, centroY, raio, instante, dias, tempoSideral);
		desenharSol(g2, centroX, centroY, raio, sol);
		desenharRosaDosVentos(g2, centroX, centroY, raio);
		desenharSituacao(g2, tempoSideral, alturaDoSol, visiveis, instante, dias);
	}

	/**
	 * De 0 na noite fechada a 1 com o Sol acima do horizonte, passando pelos
	 * crepusculos.
	 */
	private double claridade(double alturaDoSol) {
		double fracao = (alturaDoSol - FIM_DO_CREPUSCULO) / -FIM_DO_CREPUSCULO;
		return Math.max(0, Math.min(1, fracao));
	}

	private void desenharCeu(Graphics2D g2, int centroX, int centroY, int raio, double claridade) {
		g2.setColor(misturar(COR_NOITE, COR_DIA, claridade));
		g2.fillOval(centroX - raio, centroY - raio, raio * 2, raio * 2);
	}

	/** Circulos de altura de 30 em 30 graus e linhas de azimute de 45 em 45. */
	private void desenharGrade(Graphics2D g2, int centroX, int centroY, int raio) {
		g2.setColor(COR_GRADE);
		g2.setStroke(new BasicStroke(1));

		for (int altura = 30; altura <= 60; altura += 30) {
			int r = (int) (raio * projetar(altura));
			g2.drawOval(centroX - r, centroY - r, r * 2, r * 2);
		}

		for (int azimute = 0; azimute < 360; azimute += 45) {
			double radianos = Math.toRadians(azimute);
			g2.drawLine(centroX, centroY,
					(int) (centroX - raio * Math.sin(radianos)), (int) (centroY - raio * Math.cos(radianos)));
		}

		g2.setColor(COR_HORIZONTE);
		g2.setStroke(new BasicStroke(2));
		g2.drawOval(centroX - raio, centroY - raio, raio * 2, raio * 2);
	}

	/**
	 * As figuras das constelacoes. Um traco so aparece quando as duas pontas
	 * dele estao acima do horizonte: perto da borda a projecao estica sem
	 * limite, e uma ponta abaixo do horizonte jogaria a linha para fora do
	 * mundo.
	 */
	private void desenharConstelacoes(Graphics2D g2, int centroX, int centroY, int raio,
			double tempoSideral, double claridade) {
		double transparencia = (1 - claridade) * 0.75;
		if (transparencia < 0.02) {
			return;
		}

		g2.setColor(transparente(COR_CONSTELACAO, transparencia));
		g2.setStroke(new BasicStroke(1));

		for (int i = 0; i < constelacoes.quantidade(); i++) {
			double[][] traco = constelacoes.getTraco(i);

			for (int ponto = 1; ponto < traco.length; ponto++) {
				double[] antes = traco[ponto - 1];
				double[] agora = traco[ponto];

				double alturaAntes = Horizonte.altura(antes[0], antes[1], casa.getLatitude(), tempoSideral);
				double alturaAgora = Horizonte.altura(agora[0], agora[1], casa.getLatitude(), tempoSideral);
				if (alturaAntes <= 0 || alturaAgora <= 0) {
					continue;
				}

				double azimuteAntes = Horizonte.azimute(antes[0], antes[1], casa.getLatitude(), tempoSideral);
				double azimuteAgora = Horizonte.azimute(agora[0], agora[1], casa.getLatitude(), tempoSideral);

				g2.drawLine(telaX(centroX, raio, alturaAntes, azimuteAntes),
						telaY(centroY, raio, alturaAntes, azimuteAntes),
						telaX(centroX, raio, alturaAgora, azimuteAgora),
						telaY(centroY, raio, alturaAgora, azimuteAgora));
			}
		}
	}

	private int desenharEstrelas(Graphics2D g2, int centroX, int centroY, int raio,
			double tempoSideral, double claridade) {
		int visiveis = 0;
		double transparencia = 1 - claridade;

		for (int i = 0; i < estrelas.tamanho(); i++) {
			double altura = Horizonte.altura(estrelas.getAscensaoReta(i), estrelas.getDeclinacao(i),
					casa.getLatitude(), tempoSideral);
			if (altura <= 0) {
				continue;
			}
			visiveis++;

			if (transparencia < 0.02) {
				continue;
			}

			double azimute = Horizonte.azimute(estrelas.getAscensaoReta(i), estrelas.getDeclinacao(i),
					casa.getLatitude(), tempoSideral);
			int x = telaX(centroX, raio, altura, azimute);
			int y = telaY(centroY, raio, altura, azimute);

			double magnitude = estrelas.getMagnitude(i);
			double tamanho = Math.max(0.7, (6.5 - magnitude) * 0.55);

			g2.setColor(transparente(cor(estrelas.getCor(i)), transparencia));
			g2.fillOval((int) (x - tamanho), (int) (y - tamanho), (int) (tamanho * 2), (int) (tamanho * 2));

			String nome = estrelas.getNome(i);
			if (nome != null && magnitude < 1.8) {
				g2.setColor(transparente(COR_TEXTO, transparencia * 0.85));
				g2.drawString(nome, (int) (x + tamanho + 4), y + 4);
			}
		}

		return visiveis;
	}

	private void desenharSol(Graphics2D g2, int centroX, int centroY, int raio, PosicaoDoSol sol) {
		double altura = sol.altura(casa.getLatitude(), casa.getLongitude());
		if (altura <= -1) {
			return;
		}

		double azimute = sol.azimute(casa.getLatitude(), casa.getLongitude());
		int x = telaX(centroX, raio, altura, azimute);
		int y = telaY(centroY, raio, altura, azimute);

		g2.setColor(COR_SOL);
		g2.fillOval(x - 11, y - 11, 22, 22);
		g2.setColor(COR_TEXTO);
		desenharTextoCentralizado(g2, "Sol", x, y - 20);
	}

	private void desenharLua(Graphics2D g2, int centroX, int centroY, int raio,
			Instant instante, double dias, double tempoSideral) {
		PosicaoDaLua lua = PosicaoDaLua.em(instante);
		double altura = Horizonte.altura(lua.getAscensaoReta(), lua.getDeclinacao(), casa.getLatitude(), tempoSideral);
		if (altura <= -1) {
			return;
		}

		double azimute = Horizonte.azimute(lua.getAscensaoReta(), lua.getDeclinacao(), casa.getLatitude(), tempoSideral);
		int x = telaX(centroX, raio, altura, azimute);
		int y = telaY(centroY, raio, altura, azimute);

		Lua.desenharDisco(g2, x, y, 12, Lua.fracaoDoCiclo(instante), COR_LUA_CLARA, COR_LUA_ESCURA, COR_GRADE);
		g2.setColor(COR_TEXTO);
		desenharTextoCentralizado(g2, "Lua", x, y - 22);
	}

	private void desenharRosaDosVentos(Graphics2D g2, int centroX, int centroY, int raio) {
		g2.setColor(COR_HORIZONTE);
		desenharTextoCentralizado(g2, "N", centroX, centroY - raio - 16);
		desenharTextoCentralizado(g2, "S", centroX, centroY + raio + 16);
		desenharTextoCentralizado(g2, "L", centroX - raio - 16, centroY);
		desenharTextoCentralizado(g2, "O", centroX + raio + 16, centroY);

		g2.setColor(COR_GRADE);
		desenharTextoCentralizado(g2, "zênite", centroX, centroY - 12);
	}

	private void desenharSituacao(Graphics2D g2, double tempoSideral, double alturaDoSol,
			int visiveis, Instant instante, double dias) {
		PosicaoDaLua lua = PosicaoDaLua.em(instante);
		double alturaDaLua = Horizonte.altura(lua.getAscensaoReta(), lua.getDeclinacao(),
				casa.getLatitude(), tempoSideral);
		double fase = Lua.fracaoDoCiclo(instante);

		g2.setColor(COR_TEXTO);
		g2.drawString(String.format(PT_BR, "Casa em %.4f, %.4f - tempo sideral local %.2f h - %d estrelas acima do horizonte",
				casa.getLatitude(), casa.getLongitude(), tempoSideral / 15, visiveis), 14, getHeight() - 58);

		g2.setColor(COR_APAGADA);
		g2.drawString(String.format(PT_BR, "Sol a %+.1f de altura, %s - Lua a %+.1f, %s, %.0f%% iluminada",
				alturaDoSol, nomeDaFaseDoDia(alturaDoSol), alturaDaLua, Lua.nomeDaFase(fase),
				Lua.iluminacao(fase) * 100), 14, getHeight() - 38);
	}

	private String nomeDaFaseDoDia(double alturaDoSol) {
		if (alturaDoSol > 0) {
			return "dia";
		}
		if (alturaDoSol > -6) {
			return "crepúsculo civil";
		}
		if (alturaDoSol > -12) {
			return "crepúsculo náutico";
		}
		if (alturaDoSol > -18) {
			return "crepúsculo astronômico";
		}
		return "noite fechada";
	}

	/**
	 * Projecao estereografica: o zenite vai para o centro e o horizonte para a
	 * borda, e a conta e a tangente de metade da distancia ao zenite.
	 */
	private double projetar(double altura) {
		return Math.tan(Math.toRadians(90 - altura) / 2);
	}

	/** O leste fica a esquerda, porque se esta olhando para cima. */
	private int telaX(int centroX, int raio, double altura, double azimute) {
		return (int) (centroX - raio * projetar(altura) * Math.sin(Math.toRadians(azimute)));
	}

	private int telaY(int centroY, int raio, double altura, double azimute) {
		return (int) (centroY - raio * projetar(altura) * Math.cos(Math.toRadians(azimute)));
	}

	/** A cor da estrela pelo indice B menos V: azulada, branca ou alaranjada. */
	private Color cor(double indice) {
		if (indice < 0.0) {
			return new Color(170, 195, 255);
		}
		if (indice < 0.3) {
			return new Color(225, 235, 255);
		}
		if (indice < 0.6) {
			return new Color(255, 250, 235);
		}
		if (indice < 1.0) {
			return new Color(255, 235, 190);
		}
		if (indice < 1.5) {
			return new Color(255, 205, 150);
		}
		return new Color(255, 175, 130);
	}

	private Color misturar(Color inicio, Color fim, double quanto) {
		return new Color(
				(int) (inicio.getRed() + (fim.getRed() - inicio.getRed()) * quanto),
				(int) (inicio.getGreen() + (fim.getGreen() - inicio.getGreen()) * quanto),
				(int) (inicio.getBlue() + (fim.getBlue() - inicio.getBlue()) * quanto));
	}

	private Color transparente(Color cor, double quanto) {
		return new Color(cor.getRed(), cor.getGreen(), cor.getBlue(),
				(int) Math.max(0, Math.min(255, quanto * 255)));
	}
}
