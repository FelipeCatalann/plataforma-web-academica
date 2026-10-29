<?php

namespace App\Http\Controllers;

use App\Models\Apoderado;
use App\Models\Curso;
use App\Models\EnlaceWhatsApp;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProfesorController extends Controller
{
    public function panelJefe(Request $request)
    {
        $cursoBase = Curso::where('profesor_jefe_id', $request->user()->id)
            ->whereHas('estudiantes')
            ->first();

        $curso = null;

        if ($cursoBase) {
            $cursoId = $cursoBase->id;
            $curso = Curso::with([
                'estudiantes',
                'estudiantes.calificaciones' => function ($query) use ($cursoId) {
                    $query->select(
                        'calificaciones.*',
                        'asignaturas.nombre as asignatura_nombre',
                        'asignatura_curso.asignatura_id',
                        'asignatura_curso.curso_id as curso_id'
                    )
                        ->join('asignatura_curso', 'calificaciones.asignatura_curso_id', '=', 'asignatura_curso.id')
                        ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
                        ->where('asignatura_curso.curso_id', $cursoId);
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

            $curso->estudiantes->each(function ($estudiante) use ($apoderadosPorId, $enlacesPorMatricula) {
                $apoderadoId = $estudiante->pivot?->apoderado_id;
                $matriculaId = $estudiante->pivot?->id;
                $apoderado = $apoderadoId ? $apoderadosPorId->get($apoderadoId) : null;
                $enlaces = $matriculaId ? ($enlacesPorMatricula->get($matriculaId) ?? collect()) : collect();
                $ultimoEnlace = $enlaces->first();

                $estudiante->setAttribute('matricula_id', $matriculaId);
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

    public function panelAsignatura(Request $request)
    {
        $profesorId = $request->user()->id;

        $cursos = Curso::whereHas('estudiantes')
            ->whereHas('asignaturas', function ($query) use ($profesorId) {
                $query->where('asignatura_curso.profesor_id', $profesorId);
            })
            ->with([
                'estudiantes',
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
                        ->where('asignatura_curso.profesor_id', $profesorId);
                },
            ])
            ->get();

        return Inertia::render('Profesor/PanelAsignatura', [
            'cursos' => $cursos,
        ]);
    }
}
