<?php

namespace App\Services;

class RendimientoAcademico
{
    public const MINIMO_APROBACION = 4.0;

    public static function nota(mixed $valor): ?float
    {
        return is_numeric($valor) && (float) $valor >= 1 && (float) $valor <= 7
            ? (float) $valor
            : null;
    }

    /** @param array<float> $notas */
    public static function promedio(array $notas): ?float
    {
        return $notas === [] ? null : round(array_sum($notas) / count($notas), 1, PHP_ROUND_HALF_UP);
    }

    /**
     * Identifica las asignaturas bajo el mínimo usando el mismo promedio que se muestra al docente.
     * Conserva el semestre y los valores originales de cada nota como evidencia.
     */
    public static function resumir(iterable $calificaciones): array
    {
        $notas = [];
        $porAsignatura = [];
        foreach ($calificaciones as $calificacion) {
            $valor = self::nota($calificacion->valor);
            if ($valor === null) {
                continue;
            }

            $notas[] = $valor;
            $id = (string) $calificacion->asignatura_curso_id;
            $porAsignatura[$id]['asignatura'] = $calificacion->asignatura_nombre;
            $porAsignatura[$id]['notas'][] = [
                'semestre' => (int) $calificacion->semestre,
                'valor' => $valor,
            ];
        }

        $asignaturas = [];
        foreach ($porAsignatura as $id => $detalle) {
            $promedio = self::promedio(array_column($detalle['notas'], 'valor'));
            $porSemestre = collect($detalle['notas'])->groupBy('semestre')
                ->map(fn ($notas) => self::promedio($notas->pluck('valor')->all()))->all();
            $asignaturas[] = ['id' => $id, ...$detalle, 'promedio' => $promedio, 'promedios_semestre' => $porSemestre];
        }

        return [
            'promedio' => self::promedio($notas),
            'notas' => $notas,
            'asignaturas' => $asignaturas,
            'alertas' => array_values(array_filter(
                $asignaturas,
                fn (array $asignatura) => $asignatura['promedio'] < self::MINIMO_APROBACION,
            )),
        ];
    }
}
