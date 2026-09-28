package com.scicrop.relogio.brasileiro;

import javax.swing.JFrame;

/**
 * Ponto de entrada da aplicacao. O que aparece na area de exibicao esta na
 * classe Tela, que troca de conteudo com o F2.
 *
 */
public class App
{
    public static void main( String[] args )
    {
       JFrame janela = new JFrame("relogio.brasileiro");
       janela.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
       janela.setResizable(false);
       janela.setContentPane(new Tela());
       janela.pack();
       janela.setLocationRelativeTo(null);
       janela.setVisible(true);
    }
}
