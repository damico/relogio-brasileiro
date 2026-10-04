package com.scicrop.relogio.brasileiro;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.scicrop.relogio.brasileiro.web.AstroController;

class AppTest
{
    @Test
    void solEmInstanteFixoVoltaNoMapa() {
        var r = new AstroController().sol(Instant.parse("2026-06-21T12:00:00Z"));
        assertEquals(Instant.parse("2026-06-21T12:00:00Z"), r.get("instante"));
        // perto do solsticio de junho o Sol esta sobre o tropico de Cancer
        assertTrue(Math.abs((double) r.get("latitudeSubsolar") - 23.4) < 0.5);
    }
}
