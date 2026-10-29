<?php

namespace Tests\Unit;

use App\Models\EnlaceWhatsApp;
use PHPUnit\Framework\TestCase;

/**
 * INDG-19 / HUF-05 — Pruebas unitarias de normalización telefónica y armado
 * de enlace Click-to-Chat (wa.me) sin uso de bots ni API pagada.
 */
class EnlaceWhatsAppTest extends TestCase
{
    public function test_normaliza_distintos_formatos_de_telefono_chileno(): void
    {
        $this->assertSame('56912345678', EnlaceWhatsApp::normalizarTelefono('+56912345678'));
        $this->assertSame('56912345678', EnlaceWhatsApp::normalizarTelefono('+56 9 1234-5678'));
        $this->assertSame('56912345678', EnlaceWhatsApp::normalizarTelefono('912345678'));
        $this->assertSame('56912345678', EnlaceWhatsApp::normalizarTelefono('12345678'));
    }

    public function test_construye_url_wa_me_con_mensaje_preestructurado_codificado(): void
    {
        $mensaje = 'Estimado(a) apoderado(a): Citación para seguimiento de Juan Pérez (1° Medio A).';
        $url = EnlaceWhatsApp::construirUrl('+56 9 8234 1567', $mensaje);

        $this->assertStringStartsWith('https://wa.me/56982341567?text=', $url);
        $this->assertStringContainsString(rawurlencode('Juan Pérez'), $url);
        $this->assertSame($mensaje, rawurldecode(substr($url, strlen('https://wa.me/56982341567?text='))));
    }
}
