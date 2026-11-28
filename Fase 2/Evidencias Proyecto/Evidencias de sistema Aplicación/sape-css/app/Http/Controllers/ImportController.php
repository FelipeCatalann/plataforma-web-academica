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

        $yaProcesada = DB::table('importacion_excels')
            ->where('checksum', $hash)
            ->where('estadoImportacion', 'PROCESADA')
            ->exists() && DB::table('calificaciones')->count() > 0;

        $resumen = [
            'cursos' => [],
            'estudiantes' => 0,
            'calificaciones' => 0,
            'ya_procesada' => $yaProcesada,
        ];

        // El importador valida contra los datos reales y simula toda la escritura.
        DB::beginTransaction();
        try {
            $importador = new ImportadorSyscol;
            Excel::import($importador, $archivo);

            $cursosIds = $importador->cursosProcesados();
            if ($cursosIds !== []) {
                $resumen['cursos'] = DB::table('cursos')
                    ->whereIn('id', $cursosIds)
                    ->orderBy('anioEscolar')
                    ->orderBy('nivel')
                    ->orderBy('letra')
                    ->get()
                    ->map(fn ($curso) => "{$curso->nivel}° Medio {$curso->letra} ({$curso->anioEscolar})")
                    ->values()
                    ->all();

                $resumen['estudiantes'] = DB::table('matriculas')
                    ->whereIn('curso_id', $cursosIds)
                    ->count();

                $resumen['calificaciones'] = DB::table('calificaciones')
                    ->join('matriculas', 'calificaciones.matricula_id', '=', 'matriculas.id')
                    ->whereIn('matriculas.curso_id', $cursosIds)
                    ->count();
            }
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
            'resumen' => $resumen,
        ]);
    }

    public function importar(Request $request)
    {
        // 1. AUMENTAR EL TIEMPO LÍMITE A 5 MINUTOS (300 segundos)
        set_time_limit(300);

        $request->validate(self::REGLAS_ARCHIVO);

        $archivo = $request->file('archivo_excel');
        $hash = hash_file('sha256', $archivo->getRealPath());
        $revision = $request->session()->pull('importacion_revisada');
        if (! $revision || $revision['hash'] !== $hash || $revision['expira'] <= now()->timestamp) {
            throw ValidationException::withMessages([
                'archivo_excel' => 'Revisa esta planilla antes de confirmar la importación.',
            ]);
        }

        // CA-2 (INDG-15/INDG-16), hash idempotencia: la re-carga idéntica no duplica
        // siempre y cuando sigan existiendo cursos con calificaciones en el sistema.
        $yaProcesada = DB::table('importacion_excels')
            ->where('checksum', $hash)
            ->where('estadoImportacion', 'PROCESADA')
            ->exists();

        // Limpiar cualquier registro previo con el mismo checksum (ej. REPETIDO o curso borrado previamente)
        $importacionId = (string) Str::uuid();
        $calificacionesAntes = DB::table('calificaciones')->count();

        try {
            DB::beginTransaction();

            if ($yaProcesada && DB::table('calificaciones')->count() > 0) {
                Excel::import(new ImportadorSyscol(soloCompletarAsistencia: true), $archivo);
                DB::commit();

                return back()->with('success', 'El archivo ya fue importado anteriormente. Se completaron los datos de asistencia disponibles.');
            }

            DB::table('importacion_excels')->where('checksum', $hash)
                ->where('estadoImportacion', '!=', 'PROCESADA')->delete();

            DB::table('importacion_excels')->insert([
                'id' => $importacionId,
                'archivoOriginal' => $archivo->getClientOriginalName(),
                'checksum' => $hash,
                'iniciadaEn' => now(),
                'estadoImportacion' => 'PROCESANDO',
                'filasProcesadas' => 0,
                'filasRechazadas' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $importador = new ImportadorSyscol;
            Excel::import($importador, $archivo);

            foreach ($importador->cursosProcesados() as $cursoProcesadoId) {
                DB::table('importacion_excel_curso')->insertOrIgnore([
                    'importacion_excel_id' => $importacionId,
                    'curso_id' => $cursoProcesadoId,
                ]);
            }

            DB::table('importacion_excels')->where('id', $importacionId)->update([
                'estadoImportacion' => 'PROCESADA',
                'finalizadaEn' => now(),
                'filasProcesadas' => max(0, DB::table('calificaciones')->count() - $calificacionesAntes),
                'updated_at' => now(),
            ]);

            DB::commit();

            return back()->with('success', 'El archivo ha sido procesado e importado exitosamente.');
        } catch (ValidationException $e) {
            DB::rollBack();

            throw $e;
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::warning('Falló la importación de calificaciones.', ['tipo' => $e::class]);

            return back()->withErrors(['archivo_excel' => 'No se pudo importar el archivo. Revisa el formato y las calificaciones.']);
        }
    }

    /**
     * Elimina de forma íntegra los datos importados por Excel de un curso específico
     * (calificaciones, matrículas, asignaturas asociadas al curso, estudiantes/apoderados
     * huérfanos y registro de checksum de importación) para que no queden datos fantasma
     * en los gráficos ni bloqueos al volver a subir el archivo.
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

            $importacionesVinculadas = DB::table('importacion_excel_curso')
                ->where('curso_id', $curso->id)
                ->pluck('importacion_excel_id')
                ->all();

            DB::table('importacion_excel_curso')->where('curso_id', $curso->id)->delete();
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

            // Limpiar únicamente el historial de importación asociado a este curso (sin afectar otros cursos)
            $borradosPorRelacion = 0;
            if (! empty($importacionesVinculadas)) {
                $importacionesCompartidas = DB::table('importacion_excel_curso')
                    ->whereIn('importacion_excel_id', $importacionesVinculadas)
                    ->pluck('importacion_excel_id')
                    ->all();
                $importacionesExclusivas = array_values(array_diff($importacionesVinculadas, $importacionesCompartidas));
                if (! empty($importacionesExclusivas)) {
                    $borradosPorRelacion = DB::table('importacion_excels')
                        ->whereIn('id', $importacionesExclusivas)
                        ->delete();
                }
            }

            // Respaldo acotado para registros históricos previos a la tabla pivote (solo por nombre y sin vínculo a otros cursos)
            if ($borradosPorRelacion === 0) {
                $patron1 = "_{$curso->nivel}M{$curso->letra}";
                $patron2 = "_{$curso->nivel}{$curso->letra}";
                DB::table('importacion_excels')
                    ->whereNotIn('id', DB::table('importacion_excel_curso')->select('importacion_excel_id'))
                    ->where(function ($query) use ($patron1, $patron2) {
                        $query->where('archivoOriginal', 'like', "%{$patron1}%")
                            ->orWhere('archivoOriginal', 'like', "%{$patron2}%");
                    })
                    ->delete();
            }

            // Si ya no quedan cursos en la BD, limpiamos cualquier registro remanente en importacion_excels
            if (DB::table('cursos')->count() === 0) {
                DB::table('importacion_excels')->delete();
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
