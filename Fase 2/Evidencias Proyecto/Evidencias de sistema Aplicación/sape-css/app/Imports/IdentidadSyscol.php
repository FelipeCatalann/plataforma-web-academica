<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IdentidadSyscol
{
    public static function datos(Collection $fila, string $hoja, int $numero): array
    {
        $anio = trim((string) ($fila['ano'] ?? ''));
        $nivel = trim((string) ($fila['grado'] ?? ''));
        $letra = strtoupper(trim((string) ($fila['curso'] ?? '')));
        $run = trim((string) ($fila['run_token'] ?? ''));

        if (! preg_match('/^20\d{2}$/D', $anio) || ! preg_match('/^[1-8]$/D', $nivel)
            || ! preg_match('/^[A-Z]$/D', $letra) || $run === '' || mb_strlen($run) > 32) {
            self::rechazar($hoja, $numero, 'Revisa año, grado, letra e identificador del estudiante.');
        }

        return [
            'curso' => ['anioEscolar' => (int) $anio, 'nivel' => $nivel, 'letra' => $letra],
            'run' => $run,
        ];
    }

    public static function curso(array $identidad, string $hoja, int $numero): ?object
    {
        $cursos = DB::table('cursos')->where($identidad)->limit(2)->get();
        if ($cursos->count() > 1) {
            self::rechazar($hoja, $numero, 'El año, grado y letra coinciden con más de un curso.');
        }

        return $cursos->first();
    }

    public static function rechazar(string $hoja, int $numero, string $motivo): never
    {
        throw ValidationException::withMessages([
            'archivo_excel' => "Hoja {$hoja}, fila {$numero}. {$motivo}",
        ]);
    }
}
