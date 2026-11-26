<?php

namespace App\Http\Controllers;

use App\Models\Apoderado;
use App\Models\ComunicacionCorreo;
use App\Models\Curso;
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

            $correosPorMatricula = ComunicacionCorreo::whereIn('matricula_id', $matriculaIds)
                ->orderByDesc('generado_en')
                ->get()
                ->groupBy('matricula_id');

            $asistenciaPorMatricula = $this->asistenciaAnual($matriculaIds, (int) $curso->anioEscolar);

            $curso->estudiantes->each(function ($estudiante) use ($apoderadosPorId, $correosPorMatricula, $asistenciaPorMatricula) {
                $apoderadoId = $estudiante->pivot?->apoderado_id;
                $matriculaId = $estudiante->pivot?->id;
                $apoderado = $apoderadoId ? $apoderadosPorId->get($apoderadoId) : null;
                $correos = $matriculaId ? ($correosPorMatricula->get($matriculaId) ?? collect()) : collect();
                $ultimoCorreo = $correos->first();

                $estudiante->setAttribute('matricula_id', $matriculaId);
                $estudiante->setAttribute('asistencia_anual', $asistenciaPorMatricula->get($matriculaId));
                $estudiante->setAttribute('apoderado_nombre', $apoderado?->nombre ?? 'Apoderado Titular');
                $estudiante->setAttribute('apoderado_correo', $apoderado?->correo ?? '');
                $estudiante->setAttribute('total_correos', $correos->count());
                $estudiante->setAttribute('ultimo_correo', $ultimoCorreo ? [
                    'id' => $ultimoCorreo->id,
                    'correo' => $ultimoCorreo->correo_destino,
                    'asunto' => $ultimoCorreo->asunto,
                    'origen' => $ultimoCorreo->origen,
                    'tipo_destinatario' => $ultimoCorreo->tipo_destinatario,
                    'fecha' => $ultimoCorreo->generado_en?->toIso8601String(),
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
                'profesorJefe:id,name,email',
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

        $apoderadoIds = $cursos
            ->flatMap(fn ($c) => $c->estudiantes->pluck('pivot.apoderado_id'))
            ->filter()
            ->unique()
            ->values();
        $apoderadosPorId = $apoderadoIds->isNotEmpty()
            ? Apoderado::whereIn('id', $apoderadoIds)->get()->keyBy('id')
            : collect();

        // La misma persona puede tener matrículas en varios cursos del docente.
        foreach ($cursos as $curso) {
            $curso->setAttribute('profesor_jefe_nombre', $curso->profesorJefe?->name);
            $curso->setAttribute('profesor_jefe_email', $curso->profesorJefe?->email);

            foreach ($curso->estudiantes as $estudiante) {
                $apoderadoId = $estudiante->pivot?->apoderado_id;
                $apoderado = $apoderadoId ? $apoderadosPorId->get($apoderadoId) : null;
                $estudiante->setAttribute('apoderado_nombre', $apoderado?->nombre ?? 'Apoderado Titular');
                $estudiante->setAttribute('apoderado_correo', $apoderado?->correo ?? '');
                $estudiante->setRelation('calificaciones', $estudiante->calificaciones->where('curso_id', $curso->id)->values());
                $estudiante->makeHidden('pivot');
            }
        }

        return Inertia::render('Profesor/PanelAsignatura', [
            'cursos' => $cursos,
        ]);
    }
}
