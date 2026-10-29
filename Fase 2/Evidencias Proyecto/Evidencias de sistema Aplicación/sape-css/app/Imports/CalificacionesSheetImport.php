<?php

namespace App\Imports;

use Carbon\Carbon;
use Exception;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class CalificacionesSheetImport implements ToCollection, WithHeadingRow
{
    public function collection(Collection $rows): void
    {
        $now = now();
        $anoActual = $now->year;
        $paresLimpiados = [];

        foreach ($rows as $row) {
            // Validar regla de negocio de eximición
            $tieneNota = ! empty($row['nota_final']);
            $tieneConceptual = ! empty($row['nota_conceptual']);
            $esEximido = (strtoupper($row['eximido'] ?? '') === 'EX');

            if ((int) $tieneNota + (int) $tieneConceptual + (int) $esEximido > 1) {
                throw new Exception("Error en RUN {$row['run_token']}: Un alumno no puede tener nota numérica, conceptual y estar eximido simultáneamente.");
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

            // 2. Buscar al estudiante y su matrícula en el curso correspondiente a la fila
            $estudiante = DB::table('estudiantes')->where('identificadorInterno', $row['run_token'])->first();
            if (! $estudiante) {
                continue;
            }

            $grado = trim((string) ($row['grado'] ?? ''));
            $cursoLetra = trim((string) ($row['curso'] ?? ''));
            $cursoRow = ($grado !== '' && $cursoLetra !== '')
                ? DB::table('cursos')->where('nivel', $grado)->where('letra', $cursoLetra)->first()
                : null;

            $matriculaQuery = DB::table('matriculas')->where('estudiante_id', $estudiante->id);
            if ($cursoRow) {
                $matriculaQuery->where('curso_id', $cursoRow->id);
            }
            $matricula = $matriculaQuery->first();
            if (! $matricula) {
                continue;
            }

            // 3. Conectar Asignatura con el Curso
            $asigCurso = DB::table('asignatura_curso')
                ->where('asignatura_id', $asignaturaId)
                ->where('curso_id', $matricula->curso_id)
                ->first();

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
            $clavePar = "{$matricula->id}:{$asigCursoId}";
            if (! isset($paresLimpiados[$clavePar])) {
                DB::table('calificaciones')
                    ->where('matricula_id', $matricula->id)
                    ->where('asignatura_curso_id', $asigCursoId)
                    ->delete();
                $paresLimpiados[$clavePar] = true;
            }

            // 4. Transformar la Calificación
            $notaCruda = str_replace(',', '.', (string) ($row['nota_final'] ?? ''));
            $valorDecimal = is_numeric($notaCruda) ? (float) $notaCruda : 0.0;
            $evaluacion = $esEximido ? 'EXIMIDO' : ($row['nota_conceptual'] ?? 'REGULAR');

            $semestreExcel = (int) ($row['semestre'] ?? 1);
            $mesFalso = $semestreExcel === 1 ? mt_rand(3, 7) : mt_rand(8, 12);
            $diaFalso = mt_rand(1, 28);
            $fechaNota = Carbon::create($anoActual, $mesFalso, $diaFalso);

            // 5. Insertar en la base de datos
            DB::table('calificaciones')->insert([
                'id' => (string) Str::uuid(),
                'matricula_id' => $matricula->id,
                'asignatura_curso_id' => $asigCursoId,
                'valor' => $valorDecimal,
                'ponderacion' => 1.00,
                'evaluacion' => $evaluacion,
                'semestre' => $semestreExcel,
                'fecha' => $now,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }
}
