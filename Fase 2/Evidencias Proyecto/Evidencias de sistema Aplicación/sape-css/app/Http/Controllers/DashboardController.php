<?php

namespace App\Http\Controllers;

use App\Models\Asignatura;
use App\Models\Curso;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // 1. Cargar profesores, cursos enriquecidos, catálogo disponible y asignaturas cuando el Administrador ingresa a /dashboard
        if ($user->hasRole('Administrador')) {
            return Inertia::render('Director/Dashboard', $this->armarPropsDirector());
        }

        if ($user->hasRole('Profesor Jefe') || $user->hasRole('Profesor de Asignatura')) {
            return Inertia::render('Profesor/Dashboard');
        }

        return Inertia::render('Dashboard');
    }

    public function panelDirector()
    {
        return Inertia::render('Director/Dashboard', $this->armarPropsDirector());
    }

    /**
     * Construye todas las propiedades para el Panel de Dirección / Administración,
     * incluyendo métricas reales por curso subido y el catálogo de cursos disponibles.
     */
    private function armarPropsDirector(): array
    {
        $cursosModel = Curso::with(['asignaturas', 'profesorJefe'])
            ->orderBy('nivel')
            ->orderBy('letra')
            ->get();

        // Conteo de matrículas por curso
        $matriculasPorCurso = DB::table('matriculas')
            ->select('curso_id', DB::raw('COUNT(*) as total_estudiantes'))
            ->groupBy('curso_id')
            ->pluck('total_estudiantes', 'curso_id');

        // Conteo y promedio de calificaciones numéricas (> 0) por curso
        $statsCalificacionesPorCurso = DB::table('calificaciones')
            ->join('matriculas', 'calificaciones.matricula_id', '=', 'matriculas.id')
            ->select(
                'matriculas.curso_id',
                DB::raw('COUNT(calificaciones.id) as total_calificaciones'),
                DB::raw('AVG(CASE WHEN calificaciones.valor > 0 THEN calificaciones.valor ELSE NULL END) as promedio_curso')
            )
            ->groupBy('matriculas.curso_id')
            ->get()
            ->keyBy('curso_id');

        // Últimos archivos Excel procesados
        $importacionesProcesadas = DB::table('importacion_excels')
            ->where('estadoImportacion', 'PROCESADA')
            ->orderByDesc('finalizadaEn')
            ->get();

        $cursosEnriquecidos = $cursosModel->map(function (Curso $curso) use ($matriculasPorCurso, $statsCalificacionesPorCurso, $importacionesProcesadas) {
            $estudiantesCount = (int) ($matriculasPorCurso[$curso->id] ?? 0);
            $statCal = $statsCalificacionesPorCurso->get($curso->id);
            $calificacionesCount = (int) ($statCal->total_calificaciones ?? 0);
            $promedio = $statCal && $statCal->promedio_curso !== null
                ? round((float) $statCal->promedio_curso, 1)
                : null;

            // Buscar archivo Excel coincidente por patrón (ej. _1MA.xlsx, _1MB.xlsx)
            $patron1 = "_{$curso->nivel}M{$curso->letra}";
            $patron2 = "_{$curso->nivel}{$curso->letra}";
            $importacionAsociada = $importacionesProcesadas->first(function ($imp) use ($patron1, $patron2) {
                $nombre = strtoupper((string) $imp->archivoOriginal);

                return str_contains($nombre, strtoupper($patron1)) || str_contains($nombre, strtoupper($patron2));
            });

            $curso->setAttribute('estudiantes_count', $estudiantesCount);
            $curso->setAttribute('calificaciones_count', $calificacionesCount);
            $curso->setAttribute('promedio_curso', $promedio);
            $curso->setAttribute('profesor_jefe_nombre', $curso->profesorJefe?->name);
            $curso->setAttribute('archivo_excel', $importacionAsociada?->archivoOriginal);
            $curso->setAttribute('fecha_importacion', $importacionAsociada?->finalizadaEn ?? $curso->updated_at?->toDateTimeString());

            return $curso;
        })
            // Solo considerar cursos que realmente tienen datos cargados como "subidos"
            ->filter(fn ($c) => $c->estudiantes_count > 0 || $c->calificaciones_count > 0)
            ->values();

        // Catálogo oficial de los 12 cursos de Enseñanza Media (1° a 4° Medio, letras A, B, C)
        $catalogoCursos = [];
        $niveles = ['1', '2', '3', '4'];
        $letras = ['A', 'B', 'C'];

        foreach ($niveles as $nivel) {
            foreach ($letras as $letra) {
                $cursoSubido = $cursosEnriquecidos->first(
                    fn ($c) => (string) $c->nivel === $nivel && strtoupper((string) $c->letra) === $letra
                );

                $catalogoCursos[] = [
                    'codigo' => "{$nivel}° Medio {$letra}",
                    'nivel' => $nivel,
                    'letra' => $letra,
                    'subido' => $cursoSubido !== null,
                    'curso_id' => $cursoSubido?->id,
                    'anioEscolar' => $cursoSubido?->anioEscolar ?? now()->year,
                    'estudiantes_count' => $cursoSubido?->estudiantes_count ?? 0,
                    'calificaciones_count' => $cursoSubido?->calificaciones_count ?? 0,
                    'asignaturas_count' => $cursoSubido ? $cursoSubido->asignaturas->count() : 0,
                    'promedio_curso' => $cursoSubido?->promedio_curso,
                    'profesor_jefe_nombre' => $cursoSubido?->profesor_jefe_nombre,
                    'archivo_excel' => $cursoSubido?->archivo_excel,
                    'fecha_importacion' => $cursoSubido?->fecha_importacion,
                ];
            }
        }

        // Si hubiera algún curso extra fuera de A/B/C subido en BD, también lo agregamos
        foreach ($cursosEnriquecidos as $cursoExtra) {
            $existeEnCatalogo = collect($catalogoCursos)->contains(
                fn ($item) => $item['nivel'] === (string) $cursoExtra->nivel && $item['letra'] === strtoupper((string) $cursoExtra->letra)
            );
            if (! $existeEnCatalogo) {
                $catalogoCursos[] = [
                    'codigo' => "{$cursoExtra->nivel}° Medio {$cursoExtra->letra}",
                    'nivel' => (string) $cursoExtra->nivel,
                    'letra' => strtoupper((string) $cursoExtra->letra),
                    'subido' => true,
                    'curso_id' => $cursoExtra->id,
                    'anioEscolar' => $cursoExtra->anioEscolar ?? now()->year,
                    'estudiantes_count' => $cursoExtra->estudiantes_count,
                    'calificaciones_count' => $cursoExtra->calificaciones_count,
                    'asignaturas_count' => $cursoExtra->asignaturas->count(),
                    'promedio_curso' => $cursoExtra->promedio_curso,
                    'profesor_jefe_nombre' => $cursoExtra->profesor_jefe_nombre,
                    'archivo_excel' => $cursoExtra->archivo_excel,
                    'fecha_importacion' => $cursoExtra->fecha_importacion,
                ];
            }
        }

        return [
            'profesores' => $this->obtenerProfesores(),
            'cursos' => $cursosEnriquecidos,
            'catalogoCursos' => $catalogoCursos,
            'asignaturas' => Asignatura::all(),
        ];
    }

    /**
     * Consulta flexible para obtener los profesores/usuarios de la base de datos
     */
    private function obtenerProfesores()
    {
        if (method_exists(User::class, 'role')) {
            $profesores = User::role(['Profesor Jefe', 'Profesor de Asignatura'])->select('id', 'name', 'email')->get();
            if ($profesores->isNotEmpty()) {
                return $profesores;
            }
        }

        return User::select('id', 'name', 'email')->get();
    }

    public function asignarCurso(Request $request)
    {
        $request->validate([
            'profesor_id' => 'required|exists:users,id',
            'curso_id' => 'required|exists:cursos,id',
            'tipo_rol' => 'required|in:jefe,asignatura',
            'asignatura_id' => 'required_if:tipo_rol,asignatura',
        ]);

        $profesor = User::findOrFail($request->profesor_id);
        $curso = Curso::findOrFail($request->curso_id);

        if ($request->tipo_rol === 'jefe') {
            // Limpiamos jefatura anterior de este profesor para evitar que tenga 2 cursos como Profesor Jefe simultáneamente
            Curso::where('profesor_jefe_id', $profesor->id)
                ->where('id', '!=', $curso->id)
                ->update(['profesor_jefe_id' => null]);

            $curso->profesor_jefe_id = $profesor->id;
            $curso->save();

            $profesor->assignRole('Profesor Jefe');

        } else {
            $profesor->cursos()->syncWithoutDetaching([
                $curso->id => [
                    'id' => Str::uuid()->toString(),
                    'asignatura_id' => $request->asignatura_id,
                ],
            ]);

            $profesor->assignRole('Profesor de Asignatura');
        }

        return back()->with('success', '✅ ¡Asignación de carga académica guardada correctamente!');
    }
}
