package com.scicrop.relogio.brasileiro;

import java.util.Arrays;

import javax.swing.JFrame;
import javax.swing.SwingUtilities;

import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;

/**
 * Ponto de entrada da aplicacao, em dois modos escolhidos na linha de comando.
 *
 * Sem argumentos abre a janela desktop, como sempre foi: o Spring sobe sem
 * servidor web e a classe Tela faz o resto. Com --web nao abre janela alguma e
 * sobe so o servidor web (porta 8080, ou a de --server.port=N). Os dois modos
 * saem do mesmo jar.
 *
 */
@SpringBootApplication
public class App
{
    public static void main( String[] args )
    {
        boolean web = Arrays.asList(args).contains("--web");

        new SpringApplicationBuilder(App.class)
                .headless(web)
                .web(web ? WebApplicationType.SERVLET : WebApplicationType.NONE)
                .bannerMode(org.springframework.boot.Banner.Mode.OFF)
                .run(args);

        if (!web) {
            SwingUtilities.invokeLater(App::abrirJanela);
        }
    }

    private static void abrirJanela() {
       JFrame janela = new JFrame("relogio.brasileiro");
       janela.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
       janela.setResizable(false);
       janela.setContentPane(new Tela());
       janela.pack();
       janela.setLocationRelativeTo(null);
       janela.setVisible(true);
    }
}
