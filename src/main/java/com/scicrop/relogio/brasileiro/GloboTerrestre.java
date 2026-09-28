package com.scicrop.relogio.brasileiro;

import java.awt.BorderLayout;
import java.awt.Color;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Locale;

import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.Timer;

import gov.nasa.worldwind.BasicModel;
import gov.nasa.worldwind.Model;
import gov.nasa.worldwind.avlist.AVKey;
import gov.nasa.worldwind.awt.WorldWindowGLCanvas;
import gov.nasa.worldwind.geom.LatLon;
import gov.nasa.worldwind.geom.Position;
import gov.nasa.worldwind.globes.EarthFlat;
import gov.nasa.worldwind.layers.LayerList;
import gov.nasa.worldwind.layers.RenderableLayer;
import gov.nasa.worldwind.layers.Earth.BMNGOneImage;
import gov.nasa.worldwind.layers.Earth.BMNGWMSLayer;
import gov.nasa.worldwind.render.BasicShapeAttributes;
import gov.nasa.worldwind.render.Material;
import gov.nasa.worldwind.render.PointPlacemark;
import gov.nasa.worldwind.render.PointPlacemarkAttributes;
import gov.nasa.worldwind.render.SurfaceCircle;
import gov.nasa.worldwind.view.orbit.FlatOrbitView;

/**
 * Onde o Sol esta batendo na Terra agora, e onde fica a casa.
 *
 * O mapa e desenhado pelo NASA WorldWind, cujo fonte esta em src/worldwind e e
 * compilado junto com o projeto. O globo e o plano, para dar para ver o
 * planeta inteiro de uma vez.
 *
 * A noite e um circulo de 90 graus de raio centrado no ponto oposto ao
 * subsolar: tudo que esta a mais de um quarto de volta do lugar onde o Sol
 * esta a pino nao ve o Sol. A borda desse circulo e o terminador, a linha
 * entre o dia e a noite, e ela anda 15 graus por hora.
 *
 * As coordenadas de casa saem de data/config.json.
 *
 */
public class GloboTerrestre extends JPanel
{
	private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

	/** Um quarto da volta da Terra: a distancia do subsolar ate o terminador. */
	private static final double RAIO_DA_NOITE = 10_007_543;

	private static final Color COR_DIA = new Color(255, 210, 70);
	private static final Color COR_NOITE = new Color(120, 170, 255);

	private static WorldWindowGLCanvas globo;
	private static SurfaceCircle noite;
	private static PointPlacemark solAPino;
	private static PointPlacemark casa;

	private final Configuracao configuracao = Configuracao.ler();
	private final JLabel informacoes = new JLabel();
	private final Timer relogio = new Timer(1000, e -> atualizar());

	public GloboTerrestre() {
		setLayout(new BorderLayout());
		setBackground(Color.BLACK);
		add(globo(), BorderLayout.CENTER);

		informacoes.setOpaque(true);
		informacoes.setBackground(Color.BLACK);
		informacoes.setForeground(Color.WHITE);
		informacoes.setBorder(BorderFactory.createEmptyBorder(8, 12, 8, 12));
		add(informacoes, BorderLayout.SOUTH);
	}

	public WorldWindowGLCanvas getGlobo() {
		return globo();
	}

	public void addNotify() {
		super.addNotify();
		atualizar();
		relogio.start();
	}

	public void removeNotify() {
		super.removeNotify();
		relogio.stop();
	}

	/**
	 * O WorldWindowGLCanvas e pesado e carrega um contexto OpenGL caro de
	 * criar, entao e montado uma vez so e reaproveitado a cada F4.
	 */
	private synchronized WorldWindowGLCanvas globo() {
		if (globo != null) {
			return globo;
		}

		RenderableLayer marcas = new RenderableLayer();
		marcas.setName("Sol e casa");

		BasicShapeAttributes atributosDaNoite = new BasicShapeAttributes();
		atributosDaNoite.setInteriorMaterial(new Material(new Color(0, 0, 25)));
		atributosDaNoite.setInteriorOpacity(0.62);
		atributosDaNoite.setOutlineMaterial(new Material(new Color(90, 130, 200)));
		atributosDaNoite.setOutlineOpacity(0.8);
		atributosDaNoite.setOutlineWidth(1.5);
		atributosDaNoite.setDrawOutline(true);

		noite = new SurfaceCircle(atributosDaNoite, LatLon.fromDegrees(0, 0), RAIO_DA_NOITE, 180);
		marcas.addRenderable(noite);

		solAPino = marcar("Sol a pino", COR_DIA, 12);
		marcas.addRenderable(solAPino);

		if (configuracao != null) {
			casa = marcar("casa", COR_NOITE, 9);
			casa.setPosition(Position.fromDegrees(configuracao.getLatitude(), configuracao.getLongitude(), 0));
			marcas.addRenderable(casa);
		}

		LayerList camadas = new LayerList();
		camadas.add(new BMNGOneImage());
		camadas.add(new BMNGWMSLayer());
		camadas.add(marcas);

		Model modelo = new BasicModel(new EarthFlat(), camadas);

		globo = new WorldWindowGLCanvas();
		globo.setModel(modelo);
		globo.setView(new FlatOrbitView());
		// altura que enquadra o mundo inteiro na area de 1024 por 768
		globo.getView().setEyePosition(Position.fromDegrees(0, 0, 48_000_000));
		return globo;
	}

	private PointPlacemark marcar(String rotulo, Color cor, double tamanho) {
		PointPlacemark marca = new PointPlacemark(Position.fromDegrees(0, 0, 0));
		marca.setLabelText(rotulo);
		marca.setAltitudeMode(gov.nasa.worldwind.WorldWind.CLAMP_TO_GROUND);

		PointPlacemarkAttributes atributos = new PointPlacemarkAttributes();
		atributos.setUsePointAsDefaultImage(true);
		atributos.setScale(tamanho);
		atributos.setLineMaterial(new Material(cor));
		atributos.setLabelMaterial(new Material(Color.WHITE));
		marca.setAttributes(atributos);
		return marca;
	}

	/** Recoloca o Sol e a noite onde eles estao agora, e reescreve o texto. */
	private void atualizar() {
		Instant agora = Instant.now();
		PosicaoDoSol sol = PosicaoDoSol.em(agora);

		noite.setCenter(LatLon.fromDegrees(sol.getLatitudeDaMeiaNoite(), sol.getLongitudeDaMeiaNoite()));
		solAPino.setPosition(Position.fromDegrees(sol.getLatitude(), sol.getLongitude(), 0));

		informacoes.setText(texto(agora, sol));

		if (globo != null) {
			globo.redraw();
		}
	}

	private String texto(Instant agora, PosicaoDoSol sol) {
		ZoneId zona = ZoneId.systemDefault();
		StringBuilder texto = new StringBuilder("<html>");

		texto.append(String.format(PT_BR, "%1$tH:%1$tM:%1$tS aqui, %2$tH:%2$tM:%2$tS UTC &nbsp;&nbsp;|&nbsp;&nbsp; "
				+ "Sol a pino em %3$.2f, %4$.2f",
				LocalDateTime.ofInstant(agora, zona), LocalDateTime.ofInstant(agora, ZoneId.of("UTC")),
				sol.getLatitude(), sol.getLongitude()));

		if (configuracao == null) {
			texto.append("<br>Sem data/config.json com a chave home, entao a casa nao aparece no mapa");
			return texto.append("</html>").toString();
		}

		double latitude = configuracao.getLatitude();
		double longitude = configuracao.getLongitude();
		double altura = sol.altura(latitude, longitude);
		boolean dia = sol.eDia(latitude, longitude);

		if (casa != null) {
			casa.getAttributes().setLineMaterial(new Material(dia ? COR_DIA : COR_NOITE));
		}

		texto.append(String.format(PT_BR, "<br>Casa em %.4f, %.4f: %s, Sol a %.1f de altura e %.0f de azimute",
				latitude, longitude, dia ? "dia" : "noite", altura, sol.azimute(latitude, longitude)));

		double nascer = sol.horasAteONascer(latitude, longitude);
		double por = sol.horasAteOPor(latitude, longitude);
		if (nascer >= 0 && por >= 0) {
			texto.append(String.format(PT_BR, " &nbsp;&nbsp;|&nbsp;&nbsp; nasce %s, se poe %s",
					horario(agora, nascer, zona), horario(agora, por, zona)));
		}

		return texto.append("</html>").toString();
	}

	private String horario(Instant agora, double horas, ZoneId zona) {
		LocalTime quando = LocalDateTime.ofInstant(agora.plusSeconds((long) (horas * 3600)), zona).toLocalTime();
		return String.format(PT_BR, "%02d:%02d", quando.getHour(), quando.getMinute());
	}
}
