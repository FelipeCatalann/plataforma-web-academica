<?php

namespace Tests\Unit;

use App\Services\PrivacidadService;
use PHPUnit\Framework\TestCase;

/**
 * INDG-27 / HUNF-02 — Privacidad y Tokenización (sin BD).
 * Nombres 100% ficticios, inventados para el test.
 */
class PrivacidadServiceTest extends TestCase
{
    private PrivacidadService $servicio;

    private array $alumnos;

    protected function setUp(): void
    {
        parent::setUp();
        $this->servicio = new PrivacidadService;
        $this->alumnos = [
            ['nombres' => 'Javiera Ignacia', 'apellidos' => 'Muñoz Rojas'],
            ['nombres' => 'Benjamín Andrés', 'apellidos' => 'Soto Paredes'],
        ];
    }

    /** CA-1: ningún nombre llega al texto anonimizado. */
    public function test_anonimiza_nombres_completos(): void
    {
        ['texto' => $texto, 'mapa' => $mapa] = $this->servicio->anonimizar(
            'Javiera Muñoz va mal en MAT y Benjamín Soto falta mucho.',
            $this->alumnos
        );

        foreach (['Javiera', 'Muñoz', 'Benjamín', 'Soto'] as $nombre) {
            $this->assertStringNotContainsString($nombre, $texto);
        }
        $this->assertCount(2, $mapa);
    }

    /** Mismo alumno → mismo token; distintos → distintos. */
    public function test_tokens_estables_y_distintos(): void
    {
        ['texto' => $texto] = $this->servicio->anonimizar(
            'Javiera primero, Javiera después y Benjamín al final.',
            $this->alumnos
        );

        $this->assertSame(2, substr_count($texto, '[ALUMNO_1]'));
        $this->assertSame(1, substr_count($texto, '[ALUMNO_2]'));
    }

    /** Texto sin nombres queda inalterado y el mapa vacío. */
    public function test_sin_nombres_no_toca_nada(): void
    {
        $original = 'El curso tiene buen promedio general en ciencias.';

        ['texto' => $texto, 'mapa' => $mapa] = $this->servicio->anonimizar($original, $this->alumnos);

        $this->assertSame($original, $texto);
        $this->assertSame([], $mapa);
    }

    /** Apellido suelto de palabra común no se reemplaza. */
    public function test_apellido_suelto_comun_no_se_toca(): void
    {
        ['texto' => $texto] = $this->servicio->anonimizar(
            'El soto del colegio es grande y las paredes están pintadas.',
            $this->alumnos
        );

        $this->assertStringContainsString('soto', $texto);
        $this->assertStringContainsString('paredes', $texto);
    }

    /** CA-2: restaurar devuelve los nombres reales. */
    public function test_restaurar_devuelve_original(): void
    {
        $original = 'Javiera Muñoz necesita apoyo y Benjamín Soto también.';
        ['texto' => $anonimo, 'mapa' => $mapa] = $this->servicio->anonimizar($original, $this->alumnos);
        $respuestaIA = 'Recomiendo para '.$anonimo.' un plan lector.';

        $this->assertSame(
            'Recomiendo para Javiera Ignacia Muñoz Rojas necesita apoyo y Benjamín Andrés Soto Paredes también. un plan lector.',
            $this->servicio->restaurar($respuestaIA, $mapa)
        );
    }

    /** Restaurar con mapa vacío no altera nada. */
    public function test_restaurar_mapa_vacio(): void
    {
        $this->assertSame('Hola mundo.', $this->servicio->restaurar('Hola mundo.', []));
    }

    /** Nombre completo de un alumno posterior debe coincidir íntegro sin partirse con nombres compartidos previos. */
    public function test_nombre_completo_tiene_prioridad_global_sobre_nombres_compartidos_de_otros_alumnos(): void
    {
        $curso = [
            ['nombres' => 'Camila Emilio', 'apellidos' => 'Contreras Núñez'],
            ['nombres' => 'Martín Paz', 'apellidos' => 'Cifuentes Sandoval'],
            ['nombres' => 'Martín Emilio', 'apellidos' => 'Sandoval Sandoval'],
        ];

        ['texto' => $anonimo, 'mapa' => $mapa] = $this->servicio->anonimizar(
            'Diseña un plan de acción para Martín Emilio Sandoval Sandoval.',
            $curso
        );

        $this->assertSame('Diseña un plan de acción para [ALUMNO_3].', $anonimo);
        $this->assertSame(['[ALUMNO_3]' => 'Martín Emilio Sandoval Sandoval'], $mapa);
        $this->assertSame(
            'Diseña un plan de acción para Martín Emilio Sandoval Sandoval.',
            $this->servicio->restaurar($anonimo, $mapa)
        );
    }

    /** Un primer nombre compartido por varios alumnos se anonimiza sin atribuirlo a un alumno equivocado. */
    public function test_nombre_suelto_compartido_se_oculta_sin_atribuirlo_a_otro_estudiante(): void
    {
        $curso = [
            ['nombres' => 'Martín Paz', 'apellidos' => 'Cifuentes Sandoval'],
            ['nombres' => 'Martín Emilio', 'apellidos' => 'Sandoval Sandoval'],
        ];

        ['texto' => $anonimo, 'mapa' => $mapa] = $this->servicio->anonimizar(
            '¿Cómo va Martín este semestre?',
            $curso
        );

        $this->assertStringNotContainsString('Martín', $anonimo);
        $this->assertStringContainsString('[ALUMNO_SIN_ESPECIFICAR]', $anonimo);
        $this->assertSame([], $mapa);
    }
}
