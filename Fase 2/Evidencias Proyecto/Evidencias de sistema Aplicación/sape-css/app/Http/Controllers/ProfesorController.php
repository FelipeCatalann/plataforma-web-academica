<?php

namespace App\Http\Controllers;

use App\Models\Apoderado;
use App\Models\Curso;
use App\Models\EnlaceWhatsApp;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ProfesorController extends Controller
{
    public function panelJefe(Request $request)
    {
        $cursoBase = Curso::where('profesor_jefe_id', $request->user()->id)
            ->whereHas('estudiantes', fn ($query) => $query->where('matriculas.vigente', true))
            ->orderByDesc('anioEscolar')
            ->first();

        $curso = null;

        if ($cursoBase) {
            $cursoId = $cursoBase->id;
            $curso = Curso::with([
                'asignaturas:id,nombre',
                'estudiantes' => fn ($query) => $query->where('matriculas.vigente', true),
                'estudiantes.calificaciones' => function ($query) use ($cursoId) {
                    $query->select(
                        'calificaciones.*',
                        'asignaturas.nombre as asignatura_nombre',
                        'asignatura_curso.asignatura_id',
                        'asignatura_curso.curso_id as curso_id'
                    )
                        ->join('asignatura_curso', 'calificaciones.asignatura_curso_id', '=', 'asignatura_curso.id')
                        ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
                        ->where('asignatura_curso.curso_id', $cursoId)
                        ->where('matriculas.curso_id', $cursoId)
                        ->where('matriculas.vigente', true);
                },
            ])->find($cursoId);
        }

        if ($curso && $curso->estudiantes->isNotEmpty()) {
            $apoderadoIds = $curso->estudiantes
                ->pluck('pivot.apoderado_id')
                ->filter()
                ->unique()
                ->values();

            $apoderadosPorId = Apoderado::whereIn('id', $apoderadoIds)
                ->get()
                ->keyBy('id');

            $matriculaIds = $curso->estudiantes
                ->pluck('pivot.id')
                ->filter()
                ->unique()
                ->values();

            $enlacesPorMatricula = EnlaceWhatsApp::whereIn('matricula_id', $matriculaIds)
                ->orderByDesc('generadoEn')
                ->get()
                ->groupBy('matricula_id');

            $asistenciaPorMatricula = $this->asistenciaAnual($matriculaIds, (int) $curso->anioEscolar);

            $curso->estudiantes->each(function ($estudiante) use ($apoderadosPorId, $enlacesPorMatricula, $asistenciaPorMatricula) {
                $apoderadoId = $estudiante->pivot?->apoderado_id;
                $matriculaId = $estudiante->pivot?->id;
                $apoderado = $apoderadoId ? $apoderadosPorId->get($apoderadoId) : null;
                $enlaces = $matriculaId ? ($enlacesPorMatricula->get($matriculaId) ?? collect()) : collect();
                $ultimoEnlace = $enlaces->first();

                $estudiante->setAttribute('matricula_id', $matriculaId);
                $estudiante->setAttribute('asistencia_anual', $asistenciaPorMatricula->get($matriculaId));
                $estudiante->setAttribute('apoderado_nombre', $apoderado?->nombre ?? 'Apoderado Titular');
                $estudiante->setAttribute('apoderado_telefono', $apoderado?->telefono ?? '');
                $estudiante->setAttribute('apoderado_telefono_vigente', (bool) ($apoderado?->telefonoVigente ?? true));
                $estudiante->setAttribute('total_whatsapps', $enlaces->count());
                $estudiante->setAttribute('ultimo_whatsapp', $ultimoEnlace ? [
                    'id' => $ultimoEnlace->id,
                    'estado' => $ultimoEnlace->estado,
                    'telefono' => $ultimoEnlace->telefonoDestinoSnapshot,
                    'mensaje' => $ultimoEnlace->mensajePrellenado,
                    'fecha' => $ultimoEnlace->generadoEn?->toIso8601String(),
                ] : null);
            });
        }

        return Inertia::render('Profesor/PanelJefe', [
            'curso' => $curso,
        ]);
    }

    private function asistenciaAnual(Collection $matriculaIds, int $anio): Collection
    {
        $importada = DB::table('matriculas')->whereIn('id', $matriculaIds)
            ->whereNotNull('asistencia_pct')
            ->pluck('asistencia_pct', 'id')
            ->map(fn ($porcentaje) => (float) $porcentaje);

        $sinAsistencia = $matriculaIds->diff($importada->keys());
        if ($sinAsistencia->isEmpty()) {
            return $importada;
        }

        $desdeRegistros = DB::table('registro_asistencias')->whereIn('matricula_id', $sinAsistencia)
            ->whereBetween('fecha', ["$anio-01-01", "$anio-12-31"])
            ->whereIn('estado', ['PRESENTE', 'ATRASO', 'AUSENTE', 'JUSTIFICADA'])
            ->selectRaw("matricula_id, count(*) as total, sum(case when estado in ('PRESENTE', 'ATRASO') then 1 else 0 end) as presentes")
            ->groupBy('matricula_id')
            ->get()
            ->mapWithKeys(fn ($registro) => [$registro->matricula_id => round(100 * $registro->presentes / $registro->total, 2)]);

        return $importada->union($desdeRegistros);
    }

    public function panelAsignatura(Request $request)
    {
        $profesorId = $request->user()->id;

        $cursos = Curso::whereHas('estudiantes', fn ($query) => $query->where('matriculas.vigente', true))
            ->whereHas('asignaturas', function ($query) use ($profesorId) {
                $query->where('asignatura_curso.profesor_id', $profesorId);
            })
            ->with([
                'estudiantes' => fn ($query) => $query->where('matriculas.vigente', true),
                'asignaturas' => function ($q) use ($profesorId) {
                    $q->where('asignatura_curso.profesor_id', $profesorId);
                },
                'estudiantes.calificaciones' => function ($query) use ($profesorId) {
                    $query->select(
                        'calificaciones.*',
                        'asignaturas.nombre as asignatura_nombre',
                        'asignatura_curso.asignatura_id',
                        'asignatura_curso.curso_id as curso_id'
                    )
                        ->join('asignatura_curso', 'calificaciones.asignatura_curso_id', '=', 'asignatura_curso.id')
                        ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
                        ->where('asignatura_curso.profesor_id', $profesorId)
                        ->whereColumn('matriculas.curso_id', 'asignatura_curso.curso_id')
                        ->where('matriculas.vigente', true);
                },
            ])
            ->get();

        // La misma persona puede tener matrículas en varios cursos del docente.
        foreach ($cursos as $curso) {
            foreach ($curso->estudiantes as $estudiante) {
                $estudiante->setRelation('calificaciones', $estudiante->calificaciones->where('curso_id', $curso->id)->values());
                $estudiante->makeHidden('pivot');
            }
        }

        return Inertia::render('Profesor/PanelAsignatura', [
            'cursos' => $cursos,
        ]);
    }
}
