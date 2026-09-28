package com.scicrop.relogio.brasileiro;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.GraphicsDevice;
import java.awt.GraphicsEnvironment;
import java.awt.Window;
import java.awt.Dimension;
import java.awt.GridLayout;
import java.awt.event.ActionEvent;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.KeyStroke;

/**
 * A area de exibicao de 1024 por 768 e o que ela mostra.
 *
 * F2 a F5 limpam a tela e montam outra: os relogios com a orbita da Terra,
 * a OrbitasGerais, a OrbitaEstacoes, o GloboTerrestre ou o CeuDaCasa. F11
 * alterna a tela cheia, sem bordas de janela. Apertar a mesma tecla de novo volta para
 * os relogios. Cada troca constroi os paineis de novo, do zero.
 *
 */
public class Tela extends JPanel
{
	private enum Conteudo
	{
		RELOGIOS, ORBITAS_GERAIS, ORBITA_ESTACOES, GLOBO, CEU
	}

	private Conteudo conteudo = Conteudo.RELOGIOS;
	private boolean telaCheia;

	public Tela() {
		setLayout(new BorderLayout());
		setPreferredSize(new Dimension(1024, 768));
		registrar("F2", Conteudo.ORBITAS_GERAIS);
		registrar("F3", Conteudo.ORBITA_ESTACOES);
		registrar("F4", Conteudo.GLOBO);
		registrar("F5", Conteudo.CEU);
		registrarTelaCheia();
		reconstruir();
	}

	/** Tira tudo o que estiver na tela e monta a tela ativa de novo. */
	private void reconstruir() {
		removeAll();
		add(montar(), BorderLayout.CENTER);
		revalidate();
		repaint();
	}

	private JPanel montar() {
		switch (conteudo) {
		case ORBITAS_GERAIS:
			return new OrbitasGerais();
		case ORBITA_ESTACOES:
			return new OrbitaEstacoes();
		case GLOBO:
			return montarGlobo();
		case CEU:
			return new CeuDaCasa();
		default:
			return montarRelogios();
		}
	}

	private JPanel montarRelogios() {
		JPanel metadeDeCima = new JPanel(new GridLayout(1, 3));
		metadeDeCima.add(new RelogioNorteOcidental());
		metadeDeCima.add(new RelogioNorteOcidentalGlobal());
		metadeDeCima.add(new RelogioEstacoes());

		JPanel tudo = new JPanel(new GridLayout(2, 1));
		tudo.add(metadeDeCima);
		tudo.add(new OrbitaTerraSol());
		return tudo;
	}

	/**
	 * F11 tira e poe as bordas da janela. Em tela cheia a area de exibicao
	 * passa a ser a do monitor, e como cada tela se desenha a partir do
	 * tamanho que recebe, todas se reajustam sozinhas.
	 */
	private void alternarTelaCheia() {
		Window janela = SwingUtilities.getWindowAncestor(this);
		if (!(janela instanceof JFrame)) {
			return;
		}

		JFrame quadro = (JFrame) janela;
		GraphicsDevice monitor = GraphicsEnvironment.getLocalGraphicsEnvironment().getDefaultScreenDevice();
		telaCheia = !telaCheia;

		// so da para mexer nas bordas com a janela desfeita
		quadro.dispose();
		quadro.setUndecorated(telaCheia);

		if (telaCheia) {
			if (monitor.isFullScreenSupported()) {
				monitor.setFullScreenWindow(quadro);
			} else {
				quadro.setBounds(monitor.getDefaultConfiguration().getBounds());
			}
		} else {
			monitor.setFullScreenWindow(null);
			quadro.pack();
			quadro.setLocationRelativeTo(null);
		}

		quadro.setVisible(true);
		requestFocusInWindow();
	}

	private void registrarTelaCheia() {
		getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("F11"), "F11");
		getActionMap().put("F11", new AbstractAction() {
			public void actionPerformed(ActionEvent evento) {
				alternarTelaCheia();
			}
		});
	}

	/**
	 * O globo e a unica tela que depende do OpenGL. Quando as bibliotecas nao
	 * estao no classpath, em vez de derrubar o programa, a tela explica o que
	 * falta e as outras continuam funcionando.
	 */
	private JPanel montarGlobo() {
		try {
			return new GloboTerrestre();
		} catch (Throwable faltaAlgo) {
			JPanel aviso = new JPanel(new GridLayout(4, 1));
			aviso.setBackground(Color.BLACK);
			for (String linha : new String[] {
					"O globo precisa das bibliotecas de OpenGL, que nao estao no classpath.",
					"Rode com: java -jar target/relogio.brasileiro-0.0.1-SNAPSHOT.jar",
					"depois de um mvn package. As outras telas seguem funcionando.",
					faltaAlgo.getClass().getSimpleName() + ": " + faltaAlgo.getMessage() }) {
				JLabel texto = new JLabel(linha, SwingConstants.CENTER);
				texto.setForeground(Color.WHITE);
				aviso.add(texto);
			}
			return aviso;
		}
	}

	/** A tecla leva para a sua tela, e apertada de novo volta para os relogios. */
	private void registrar(String tecla, Conteudo destino) {
		getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke(tecla), tecla);
		getActionMap().put(tecla, new AbstractAction() {
			public void actionPerformed(ActionEvent evento) {
				conteudo = conteudo == destino ? Conteudo.RELOGIOS : destino;
				reconstruir();
			}
		});
	}
}
