<?php

namespace App\Http\Controllers;

use App\Imports\ImportadorSyscol;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class ImportController extends Controller
{
    // Muestra el formulario de importación (GET).
    public function index()
    {
        return Inertia::render('Admin/ImportarNotas');
    }

    public function importar(Request $request)
    {
        // 1. AUMENTAR EL TIEMPO LÍMITE A 5 MINUTOS (300 segundos)
        set_time_limit(300);

        $request->validate([
            'archivo_excel' => 'required|mimes:xlsx,xls,csv',
        ]);

        $archivo = $request->file('archivo_excel');
        $hash = hash_file('sha256', $archivo->getRealPath());

        // CA-2 (INDG-15/INDG-16), hash idempotencia: la re-carga idéntica no duplica
        // siempre y cuando sigan existiendo cursos con calificaciones en el sistema.
        $yaProcesada = DB::table('importacion_excels')
            ->where('checksum', $hash)
            ->where('estadoImportacion', 'PROCESADA')
            ->exists();

        if ($yaProcesada && DB::table('calificaciones')->count() > 0) {
            return back()->with('success', 'El archivo ya fue importado anteriormente (hash idéntico). No se duplicaron registros.');
        }

        // Limpiar cualquier registro previo con el mismo checksum (ej. REPETIDO o curso borrado previamente)
        DB::table('importacion_excels')->where('checksum', $hash)->delete();

        $importacionId = (string) Str::uuid();
        $calificacionesAntes = DB::table('calificaciones')->count();

        try {
            DB::beginTransaction();

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

            Excel::import(new ImportadorSyscol, $archivo);

            DB::table('importacion_excels')->where('id', $importacionId)->update([
                'estadoImportacion' => 'PROCESADA',
                'finalizadaEn' => now(),
                'filasProcesadas' => max(0, DB::table('calificaciones')->count() - $calificacionesAntes),
                'updated_at' => now(),
            ]);

            DB::commit();

            return back()->with('success', 'El archivo ha sido procesado e importado exitosamente.');
        } catch (\Exception $e) {
            DB::rollBack();

            return back()->withErrors(['archivo_excel' => 'Error crítico al procesar: '.$e->getMessage()]);
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

            // Limpiar el historial de importación (checksum) de este curso para permitir re-subir su Excel
            $patron1 = "_{$curso->nivel}M{$curso->letra}";
            $patron2 = "_{$curso->nivel}{$curso->letra}";
            $borradosPorNombre = DB::table('importacion_excels')
                ->where('archivoOriginal', 'like', "%{$patron1}%")
                ->orWhere('archivoOriginal', 'like', "%{$patron2}%")
                ->delete();

            if ($borradosPorNombre === 0 && $calificacionesBorradas > 0) {
                DB::table('importacion_excels')
                    ->where('filasProcesadas', $calificacionesBorradas)
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

            return back()->withErrors(['curso' => 'Error al eliminar los datos del curso: '.$e->getMessage()]);
        }
    }
}
