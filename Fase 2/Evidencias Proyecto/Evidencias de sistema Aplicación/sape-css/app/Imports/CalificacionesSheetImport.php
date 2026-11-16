<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class CalificacionesSheetImport implements ToCollection, WithHeadingRow
{
    public function __construct(private NominaSheetImport $nomina) {}

    public function collection(Collection $rows): void
    {
        $now = now();
        $paresLimpiados = [];

        foreach ($rows as $indice => $row) {
            if ($row->filter(fn ($valor) => $valor !== null && $valor !== '')->isEmpty()) {
                continue;
            }
            $numero = $indice + 2;
            $identidad = IdentidadSyscol::datos($row, 'CALIFICACIONES', $numero);
            if (! $this->nomina->incluyeMatricula($identidad)) {
                IdentidadSyscol::rechazar('CALIFICACIONES', $numero, 'La matrícula de ese curso y año debe aparecer en la nómina de la planilla.');
            }
            if ($this->nomina->omiteCurso($identidad['curso'])) {
                continue;
            }
            $curso = IdentidadSyscol::curso($identidad['curso'], 'CALIFICACIONES', $numero);
            $estudiante = DB::table('estudiantes')->where('identificadorInterno', $identidad['run'])->first();
            $matriculas = $curso && $estudiante
                ? DB::table('matriculas')->where('curso_id', $curso->id)->where('estudiante_id', $estudiante->id)->limit(2)->get()
                : collect();
            if ($matriculas->count() !== 1) {
                IdentidadSyscol::rechazar('CALIFICACIONES', $numero, 'Se requiere una matrícula única para el estudiante, curso y año indicados.');
            }
            $matricula = $matriculas->first();
            if (empty($row['cod_subsector']) || empty($row['subsector'])) {
                IdentidadSyscol::rechazar('CALIFICACIONES', $numero, 'Falta el código o nombre de la asignatura.');
            }
            // Validar regla de negocio de eximición
            $notaCruda = str_replace(',', '.', trim((string) ($row['nota_final'] ?? '')));
            $tieneNota = $notaCruda !== '';
            $tieneConceptual = ! empty($row['nota_conceptual']);
            $esEximido = (strtoupper($row['eximido'] ?? '') === 'EX');

            if ((int) $tieneNota + (int) $tieneConceptual + (int) $esEximido > 1) {
                IdentidadSyscol::rechazar('CALIFICACIONES', $numero, 'Indica solo un tipo de evaluación: nota, concepto o eximición.');
            }
            if ($tieneNota && (! is_numeric($notaCruda) || (float) $notaCruda < 1 || (float) $notaCruda > 7)) {
                IdentidadSyscol::rechazar('CALIFICACIONES', $numero, 'La calificación numérica debe estar entre 1 y 7.');
            }
            $semestreExcel = trim((string) ($row['semestre'] ?? ''));
            if (! in_array($semestreExcel, ['1', '2'], true)) {
                IdentidadSyscol::rechazar('CALIFICACIONES', $numero, 'El semestre debe ser 1 o 2.');
            }

            // 1. Buscar la Asignatura
            $asignatura = DB::table('asignaturas')->where('codigo', $row['cod_subsector'])->first();
            $asignaturaId = $asignatura ? $asignatura->id : (string) Str::uuid();
            if (! $asignatura) {
                DB::table('asignaturas')->insert([
                    'id' => $asignaturaId,
                    'codigo' => $row['cod_subsector'],
                    'nombre' => $row['subsector'],
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }

            // 3. Conectar Asignatura con el Curso (reutilizando fila si un docente fue asignado previamente por nombre de subsector)
            $asigCurso = DB::table('asignatura_curso')
                ->where('asignatura_id', $asignaturaId)
                ->where('curso_id', $matricula->curso_id)
                ->orderByRaw('CASE WHEN profesor_id IS NOT NULL THEN 0 ELSE 1 END')
                ->first();

            if (! $asigCurso && ! empty($row['subsector'])) {
                $nombreSubsector = mb_strtolower(trim((string) $row['subsector']));
                $asigCursoPorNombre = DB::table('asignatura_curso')
                    ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
                    ->where('asignatura_curso.curso_id', $matricula->curso_id)
                    ->whereRaw('LOWER(TRIM(asignaturas.nombre)) = ?', [$nombreSubsector])
                    ->select('asignatura_curso.*')
                    ->first();

                if ($asigCursoPorNombre) {
                    DB::table('asignatura_curso')
                        ->where('id', $asigCursoPorNombre->id)
                        ->update([
                            'asignatura_id' => $asignaturaId,
                            'updated_at' => $now,
                        ]);
                    $asigCurso = $asigCursoPorNombre;
                }
            }

            $asigCursoId = $asigCurso ? $asigCurso->id : (string) Str::uuid();
            if (! $asigCurso) {
                DB::table('asignatura_curso')->insert([
                    'id' => $asigCursoId,
                    'asignatura_id' => $asignaturaId,
                    'curso_id' => $matricula->curso_id,
                    'ponderacion' => 1.00,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }

            // 3.5. Si ya existían calificaciones previas para este alumno y asignatura en una carga anterior,
            // se reemplazan una sola vez al inicio de la importación del archivo para no mezclar notas antiguas con nuevas.
            $clavePar = "{$matricula->id}:{$asigCursoId}:{$semestreExcel}";
            if (! isset($paresLimpiados[$clavePar])) {
                DB::table('calificaciones')
                    ->where('matricula_id', $matricula->id)
                    ->where('asignatura_curso_id', $asigCursoId)
                    ->where('semestre', (int) $semestreExcel)
                    ->delete();
                $paresLimpiados[$clavePar] = true;
            }

            // 4. Transformar la Calificación
            $valorDecimal = is_numeric($notaCruda) ? (float) $notaCruda : 0.0;
            $evaluacion = $esEximido ? 'EXIMIDO' : ($row['nota_conceptual'] ?? 'REGULAR');

            // 5. Insertar en la base de datos
            DB::table('calificaciones')->insert([
                'id' => (string) Str::uuid(),
                'matricula_id' => $matricula->id,
                'asignatura_curso_id' => $asigCursoId,
                'valor' => $valorDecimal,
                'ponderacion' => 1.00,
                'evaluacion' => $evaluacion,
                'semestre' => (int) $semestreExcel,
                'fecha' => $now,
                'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->nomina->registrarCalificacion($identidad['curso']);
        }
    }
}
