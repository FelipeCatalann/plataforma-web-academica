<?php

namespace App\Imports;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class NominaSheetImport implements ToCollection, WithHeadingRow
{
    private array $matriculasPlanilla = [];

    private array $cursos = [];

    public function __construct(private array $cursosConfirmados = []) {}

    public function resumen(): array
    {
        return $this->cursos;
    }

    public function omiteCurso(array $curso): bool
    {
        return isset($this->cursosConfirmados[implode(':', $curso)]);
    }

    public function registrarCalificacion(array $curso): void
    {
        $this->cursos[implode(':', $curso)]['calificaciones']++;
    }

    public function incluyeMatricula(array $identidad): bool
    {
        return isset($this->matriculasPlanilla[$this->clave($identidad)]);
    }

    private function clave(array $identidad): string
    {
        return implode(':', $identidad['curso']).':'.$identidad['run'];
    }

    public function collection(Collection $rows): void
    {
        $this->matriculasPlanilla = [];
        $this->cursos = [];
        foreach ($rows as $indice => $row) {
            if ($row->filter(fn ($valor) => $valor !== null && $valor !== '')->isEmpty()) {
                continue;
            }

            $numero = $indice + 2;
            $identidad = IdentidadSyscol::datos($row, 'NOMINA', $numero);
            $runToken = $identidad['run'];
            if ($this->incluyeMatricula($identidad) || trim((string) ($row['nombres'] ?? '')) === '') {
                IdentidadSyscol::rechazar('NOMINA', $numero, 'Falta el nombre o la matrícula está repetida en la planilla.');
            }
            $this->matriculasPlanilla[$this->clave($identidad)] = true;
            $claveCurso = implode(':', $identidad['curso']);

            if (! isset($this->cursos[$claveCurso])) {
                $confirmado = $this->cursosConfirmados[$claveCurso] ?? null;
                $curso = $confirmado ? null : IdentidadSyscol::curso($identidad['curso'], 'NOMINA', $numero);
                $cursoId = $confirmado ?? $curso?->id ?? (string) Str::uuid();
                $this->cursos[$claveCurso] = [
                    ...$identidad['curso'],
                    'curso_id' => $cursoId,
                    'accion' => $confirmado ? 'sin_cambios' : ($curso ? 'actualizar' : 'crear'),
                    'matriculas' => 0,
                    'calificaciones' => 0,
                ];

                if (! $confirmado && ! $curso) {
                    DB::table('cursos')->insert([
                        'id' => $cursoId,
                        ...$identidad['curso'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            $this->cursos[$claveCurso]['matriculas']++;
            if ($this->omiteCurso($identidad['curso'])) {
                continue;
            }
            $cursoId = $this->cursos[$claveCurso]['curso_id'];
            $now = now();

            // Limpieza básica de texto
            $telefonoApoderado = ! empty($row['telefono_apoderado']) ? trim((string) $row['telefono_apoderado']) : null;

            // 2. Buscar o crear el Apoderado
            $apoderadoId = null;
            if ($telefonoApoderado) {
                $apoderado = DB::table('apoderados')->where('telefono', $telefonoApoderado)->first();
                $apoderadoId = $apoderado ? $apoderado->id : (string) Str::uuid();

                if (! $apoderado) {
                    DB::table('apoderados')->insert([
                        'id' => $apoderadoId,
                        'nombre' => 'Apoderado no registrado',
                        'telefono' => $telefonoApoderado,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            // 3. Buscar o crear el Estudiante
            $estudiante = DB::table('estudiantes')->where('identificadorInterno', $runToken)->first();
            $estudianteId = $estudiante ? $estudiante->id : (string) Str::uuid();

            if (! $estudiante) {
                DB::table('estudiantes')->insert([
                    'id' => $estudianteId,
                    'nombres' => trim($row['nombres']),
                    'apellidos' => trim($row['apellidos']),
                    'identificadorInterno' => $runToken,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            // 4. Conectar todo en la Matrícula
            $matriculas = DB::table('matriculas')
                ->where('estudiante_id', $estudianteId)
                ->where('curso_id', $cursoId)
                ->limit(2)->get();
            if ($matriculas->count() > 1) {
                IdentidadSyscol::rechazar('NOMINA', $numero, 'El estudiante tiene más de una matrícula en ese curso.');
            }
            $matriculaExistente = $matriculas->first();
            $retirado = ! empty($row['fecha_retiro']);

            if (! $matriculaExistente) {
                // Formatear correctamente la fecha desde Excel
                $fechaIngreso = $identidad['curso']['anioEscolar'].'-01-01';
                if (! empty($row['fecha_incorporacion'])) {
                    if (is_numeric($row['fecha_incorporacion'])) {
                        $fechaIngreso = Carbon::instance(ExcelDate::excelToDateTimeObject($row['fecha_incorporacion']))->toDateString();
                    } else {
                        $fechaIngreso = Carbon::parse($row['fecha_incorporacion'])->toDateString();
                    }
                }

                DB::table('matriculas')->insert([
                    'id' => (string) Str::uuid(),
                    'estudiante_id' => $estudianteId,
                    'curso_id' => $cursoId,
                    'apoderado_id' => $apoderadoId,
                    'fechaIngreso' => $fechaIngreso,
                    'estado' => $retirado ? 'RETIRADO' : 'ACTIVO',
                    'vigente' => ! $retirado,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            } elseif ($retirado && $matriculaExistente->vigente) {
                DB::table('matriculas')->where('id', $matriculaExistente->id)
                    ->update(['estado' => 'RETIRADO', 'vigente' => false, 'updated_at' => $now]);
            }
        }
    }
}
