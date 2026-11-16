<?php

namespace Tests\Unit;

use App\Services\RendimientoAcademico;
use PHPUnit\Framework\TestCase;

class RendimientoAcademicoTest extends TestCase
{
    public function test_promedio_y_alerta_comparten_redondeo_y_excluyen_conceptos(): void
    {
        $calificacion = fn (string $id, mixed $valor, int $semestre) => (object) [
            'asignatura_curso_id' => $id,
            'asignatura_nombre' => $id,
            'valor' => $valor,
            'semestre' => $semestre,
        ];

        $rendimiento = RendimientoAcademico::resumir([
            $calificacion('Matemática', '3.90', 1),
            $calificacion('Matemática', '4.00', 2),
            $calificacion('Lenguaje', '3.80', 2),
            $calificacion('Lenguaje', '0.00', 2),
        ]);

        $this->assertSame(4.0, $rendimiento['asignaturas'][0]['promedio']);
        $this->assertSame(['Lenguaje'], array_column($rendimiento['alertas'], 'asignatura'));
        $this->assertSame([['semestre' => 2, 'valor' => 3.8]], $rendimiento['alertas'][0]['notas']);
        $sinNotas = RendimientoAcademico::resumir([$calificacion('Lenguaje', 0, 1)]);
        $this->assertNull($sinNotas['promedio']);
        $this->assertSame([], $sinNotas['alertas']);
    }
}
