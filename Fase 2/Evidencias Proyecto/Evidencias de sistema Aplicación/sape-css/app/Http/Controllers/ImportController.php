<?php

namespace App\Http\Controllers;

use App\Imports\ImportadorSyscol;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class ImportController extends Controller
{
    private const REGLAS_ARCHIVO = ['archivo_excel' => 'required|file|mimes:xlsx,xls|max:10240'];

    // Muestra el formulario de importación (GET).
    public function index()
    {
        return Inertia::render('Admin/ImportarNotas');
    }

    public function revisar(Request $request)
    {
        $request->session()->forget('importacion_revisada');
        $request->validate(self::REGLAS_ARCHIVO);
        $archivo = $request->file('archivo_excel');
        $hash = hash_file('sha256', $archivo->getRealPath());

        $importacionId = DB::table('importacion_excels')->where('checksum', $hash)->value('id');
        $importador = new ImportadorSyscol($this->cursosConfirmados($importacionId));

        // Usa las mismas validaciones que al confirmar y revierte la escritura.
        DB::beginTransaction();
        try {
            Excel::import($importador, $archivo);
            $resumen = $this->verificarResumen($importador);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::warning('Falló la revisión de la planilla.', ['tipo' => $e::class]);
            throw ValidationException::withMessages([
                'archivo_excel' => 'No se pudo revisar la planilla. Comprueba las hojas NOMINA y CALIFICACIONES.',
            ]);
        } finally {
            DB::rollBack();
        }

        $request->session()->put('importacion_revisada', [
            'hash' => $hash,
            'expira' => now()->addMinutes(15)->timestamp,
        ]);

        return response()->json([
            'message' => 'Planilla revisada. Puedes confirmar la importación.',
            'cursos' => array_values(array_map(fn ($curso) => [
                'anio' => $curso['anioEscolar'],
                'nivel' => $curso['nivel'],
                'letra' => $curso['letra'],
                'accion' => $curso['accion'],
                'matriculas' => $curso['matriculas'],
                'calificaciones' => $curso['calificaciones'],
            ], $resumen)),
        ]);
    }

    public function importar(Request $request)
    {
        set_time_limit(300);
        $request->validate(self::REGLAS_ARCHIVO);
        $archivo = $request->file('archivo_excel');
        $hash = hash_file('sha256', $archivo->getRealPath());
        $revision = $request->session()->get('importacion_revisada');
        if (! $revision || $revision['hash'] !== $hash || $revision['expira'] <= now()->timestamp) {
            throw ValidationException::withMessages([
                'archivo_excel' => 'Revisa esta planilla antes de confirmar la importación.',
            ]);
        }

        try {
            $conCambios = DB::transaction(function () use ($archivo, $hash): bool {
                $ahora = now();
                DB::table('importacion_excels')->insertOrIgnore([
                    'id' => (string) Str::uuid(),
                    'archivoOriginal' => $archivo->getClientOriginalName(),
                    'checksum' => $hash,
                    'iniciadaEn' => $ahora,
                    'estadoImportacion' => 'PROCESANDO',
                    'filasProcesadas' => 0,
                    'filasRechazadas' => 0,
                    'created_at' => $ahora,
                    'updated_at' => $ahora,
                ]);

                $importacion = DB::table('importacion_excels')->where('checksum', $hash)->lockForUpdate()->first();
                $importador = new ImportadorSyscol($this->cursosConfirmados($importacion->id));
                Excel::import($importador, $archivo);
                $resumen = $this->verificarResumen($importador);

                $vinculos = [];
                foreach ($resumen as $identidad => $curso) {
                    if ($curso['accion'] !== 'sin_cambios') {
                        $vinculos[] = [
                            'importacion_id' => $importacion->id,
                            'identidad_curso' => $identidad,
                            'curso_id' => $curso['curso_id'],
                            'filas_calificaciones' => $curso['calificaciones'],
                        ];
                    }
                }

                if ($vinculos === []) {
                    return false;
                }

                DB::table('importacion_excel_curso')->upsert(
                    $vinculos,
                    ['importacion_id', 'identidad_curso'],
                    ['curso_id', 'filas_calificaciones'],
                );
                DB::table('importacion_excels')->where('id', $importacion->id)->update([
                    'estadoImportacion' => 'PROCESADA',
                    'finalizadaEn' => now(),
                    'filasProcesadas' => DB::table('importacion_excel_curso')
                        ->where('importacion_id', $importacion->id)->sum('filas_calificaciones'),
                    'updated_at' => now(),
                ]);

                return true;
            }, 3);

            $request->session()->forget('importacion_revisada');

            return back()->with('success', $conCambios
                ? 'El archivo ha sido procesado e importado exitosamente.'
                : 'El archivo ya fue importado anteriormente (hash idéntico). No se duplicaron registros.');
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::warning('Falló la importación de calificaciones.', ['tipo' => $e::class]);

            return back()->withErrors(['archivo_excel' => 'No se pudo importar el archivo. Revisa el formato y las calificaciones.']);
        }
    }

    private function cursosConfirmados(?string $importacionId): array
    {
        if ($importacionId === null) {
            return [];
        }

        return DB::table('importacion_excel_curso')
            ->where('importacion_id', $importacionId)
            ->whereNotNull('curso_id')
            ->pluck('curso_id', 'identidad_curso')
            ->all();
    }

    private function verificarResumen(ImportadorSyscol $importador): array
    {
        $resumen = $importador->resumen();
        if ($resumen === [] || (array_sum(array_column($resumen, 'calificaciones')) === 0
            && ! in_array('sin_cambios', array_column($resumen, 'accion'), true))) {
            throw ValidationException::withMessages([
                'archivo_excel' => 'La planilla debe contener una nómina y al menos una fila de calificaciones.',
            ]);
        }

        return $resumen;
    }

    /**
     * Elimina de forma íntegra los datos importados por Excel de un curso específico
     * (calificaciones, matrículas, asignaturas asociadas al curso, estudiantes/apoderados
     * huérfanos). La relación con el curso se invalida y conserva el historial de la planilla.
     */
    public function eliminarDatosCurso(string $cursoId)
    {
        $curso = DB::table('cursos')->where('id', $cursoId)->first();

        if (! $curso) {
            return back()->withErrors(['curso' => 'El curso seleccionado ya no existe o fue eliminado.']);
        }

        $etiquetaCurso = "{$curso->nivel}° Medio {$curso->letra}";

        try {
            DB::beginTransaction();

            $matriculas = DB::table('matriculas')->where('curso_id', $curso->id)->get();
            $matriculaIds = $matriculas->pluck('id')->all();
            $estudianteIds = $matriculas->pluck('estudiante_id')->filter()->unique()->values()->all();
            $apoderadoIds = $matriculas->pluck('apoderado_id')->filter()->unique()->values()->all();

            $asignaturaCursoIds = DB::table('asignatura_curso')
                ->where('curso_id', $curso->id)
                ->pluck('id')
                ->all();

            $calificacionesBorradas = 0;

            if (! empty($matriculaIds)) {
                $calificacionesBorradas += DB::table('calificaciones')
                    ->whereIn('matricula_id', $matriculaIds)
                    ->delete();

                DB::table('enlace_whats_apps')->whereIn('matricula_id', $matriculaIds)->delete();
                DB::table('indicador_riesgos')->whereIn('matricula_id', $matriculaIds)->delete();
                DB::table('registro_asistencias')->whereIn('matricula_id', $matriculaIds)->delete();
            }

            if (! empty($asignaturaCursoIds)) {
                $calificacionesBorradas += DB::table('calificaciones')
                    ->whereIn('asignatura_curso_id', $asignaturaCursoIds)
                    ->delete();
            }

            DB::table('cuartil_detalle_curriculars')->where('curso_id', $curso->id)->delete();
            DB::table('matriculas')->where('curso_id', $curso->id)->delete();
            DB::table('asignatura_curso')->where('curso_id', $curso->id)->delete();
            DB::table('cursos')->where('id', $curso->id)->delete();

            // Limpiar estudiantes que ya no tengan matrícula en ningún otro curso
            if (! empty($estudianteIds)) {
                $estudiantesConOtraMatricula = DB::table('matriculas')
                    ->whereIn('estudiante_id', $estudianteIds)
                    ->pluck('estudiante_id')
                    ->all();
                $estudiantesHuerfanos = array_values(array_diff($estudianteIds, $estudiantesConOtraMatricula));
                if (! empty($estudiantesHuerfanos)) {
                    DB::table('estudiantes')->whereIn('id', $estudiantesHuerfanos)->delete();
                }
            }

            // Limpiar apoderados que ya no tengan matrícula en ningún otro curso
            if (! empty($apoderadoIds)) {
                $apoderadosConOtraMatricula = DB::table('matriculas')
                    ->whereIn('apoderado_id', $apoderadoIds)
                    ->pluck('apoderado_id')
                    ->all();
                $apoderadosHuerfanos = array_values(array_diff($apoderadoIds, $apoderadosConOtraMatricula));
                if (! empty($apoderadosHuerfanos)) {
                    DB::table('apoderados')->whereIn('id', $apoderadosHuerfanos)->delete();
                }
            }

            DB::commit();

            return back()->with('success', "Se eliminaron correctamente los datos Excel del curso {$etiquetaCurso} ({$matriculas->count()} estudiantes y {$calificacionesBorradas} calificaciones).");
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Falló la eliminación de datos del curso.', ['tipo' => $e::class]);

            return back()->withErrors(['curso' => 'No se pudieron eliminar los datos del curso. Intenta nuevamente.']);
        }
    }
}
