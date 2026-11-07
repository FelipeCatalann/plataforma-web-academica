<?php

namespace App\Http\Controllers;

use App\Models\Asignatura;
use App\Models\Curso;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

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

        // Promedios por estudiante y asignatura en cada curso (evita hidratar 26.000+ modelos Eloquent en memoria)
        $promediosPorEstudianteAsig = DB::table('calificaciones')
            ->join('matriculas', 'calificaciones.matricula_id', '=', 'matriculas.id')
            ->where('calificaciones.valor', '>', 0)
            ->select(
                'matriculas.curso_id',
                'matriculas.estudiante_id',
                'calificaciones.asignatura_curso_id',
                DB::raw('AVG(calificaciones.valor) as promedio_asignatura')
            )
            ->groupBy('matriculas.curso_id', 'matriculas.estudiante_id', 'calificaciones.asignatura_curso_id')
            ->get();

        $estudiantesResumenPorCurso = [];
        foreach ($promediosPorEstudianteAsig as $fila) {
            $cursoId = $fila->curso_id;
            $estId = $fila->estudiante_id;
            if (! isset($estudiantesResumenPorCurso[$cursoId][$estId])) {
                $estudiantesResumenPorCurso[$cursoId][$estId] = [
                    'id' => $estId,
                    'calificaciones' => [],
                ];
            }
            $estudiantesResumenPorCurso[$cursoId][$estId]['calificaciones'][] = [
                'asignatura_id' => $fila->asignatura_curso_id,
                'valor' => round((float) $fila->promedio_asignatura, 4),
            ];
        }
        foreach ($estudiantesResumenPorCurso as $cursoId => $mapaEstudiantes) {
            $estudiantesResumenPorCurso[$cursoId] = array_values($mapaEstudiantes);
        }

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
                    'estudiantes' => $cursoSubido ? ($estudiantesResumenPorCurso[$cursoSubido->id] ?? []) : [],
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
                    'estudiantes' => $estudiantesResumenPorCurso[$cursoExtra->id] ?? [],
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
            $profesores = User::role(['Profesor Jefe', 'Profesor de Asignatura'])
                ->select('id', 'name', 'email')
                ->orderBy('name')
                ->get();
            if ($profesores->isNotEmpty()) {
                return $profesores;
            }
        }

        return User::select('id', 'name', 'email')->orderBy('name')->get();
    }

    public function crearProfesor(Request $request)
    {
        $validated = $request->validate(
            [
                'rol_inicial' => ['required', 'in:Profesor Jefe,Profesor de Asignatura'],
                'nombre' => ['required', 'string', 'max:60', 'regex:/^[\pL\s]+$/u'],
                'primer_apellido' => ['required', 'string', 'max:60', 'regex:/^[\pL\s]+$/u'],
                'segundo_apellido' => ['required', 'string', 'max:60', 'regex:/^[\pL\s]+$/u'],
                'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
                'password' => [
                    'required',
                    'string',
                    'min:6',
                    'max:100',
                    'regex:/[A-ZÁÉÍÓÚÑ]/',
                    'regex:/[a-záéíóúñ]/',
                    'regex:/[0-9]/',
                    'regex:/[^A-Za-z0-9\s]/',
                ],
            ],
            [
                'rol_inicial.required' => 'Selecciona primero el rol del profesor.',
                'rol_inicial.in' => 'El rol seleccionado no es válido.',
                'nombre.required' => 'Ingresa el nombre del profesor.',
                'nombre.regex' => 'El nombre solo puede contener letras.',
                'primer_apellido.required' => 'Ingresa el primer apellido del profesor.',
                'primer_apellido.regex' => 'El primer apellido solo puede contener letras.',
                'segundo_apellido.required' => 'Ingresa el segundo apellido del profesor.',
                'segundo_apellido.regex' => 'El segundo apellido solo puede contener letras.',
                'email.required' => 'Completa el nombre y apellidos para generar el correo electrónico.',
                'email.email' => 'El formato del correo electrónico generado no es válido.',
                'email.unique' => 'Ya existe un usuario registrado con este correo electrónico.',
                'password.required' => 'Ingresa una contraseña de acceso para el profesor.',
                'password.min' => 'La contraseña debe tener al menos 6 caracteres.',
                'password.regex' => 'La contraseña debe incluir mayúsculas, minúsculas, números y al menos un signo especial.',
            ]
        );

        $nombreCompleto = collect([
            trim($validated['nombre']),
            trim($validated['primer_apellido']),
            trim($validated['segundo_apellido']),
        ])->filter()->implode(' ');

        $profesor = new User([
            'name' => $nombreCompleto,
            'email' => trim($validated['email']),
            'password' => Hash::make($validated['password']),
        ]);
        $profesor->email_verified_at = now();
        $profesor->save();

        Role::firstOrCreate(['name' => $validated['rol_inicial']]);
        $profesor->assignRole($validated['rol_inicial']);

        return back()->with(
            'success',
            "Docente \"{$profesor->name}\" registrado correctamente. Ya puedes asignarle cursos o asignaturas."
        );
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
            $asignaturaSolicitada = Asignatura::findOrFail($request->asignatura_id);
            $nombreNormalizado = mb_strtolower(trim((string) $asignaturaSolicitada->nombre));

            // Buscar filas existentes en asignatura_curso para este curso y asignatura (priorizando la que ya tiene calificaciones cargadas)
            $filasExistentes = DB::table('asignatura_curso')
                ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
                ->leftJoin('calificaciones', 'calificaciones.asignatura_curso_id', '=', 'asignatura_curso.id')
                ->where('asignatura_curso.curso_id', $curso->id)
                ->where(function ($query) use ($asignaturaSolicitada, $nombreNormalizado) {
                    $query->where('asignatura_curso.asignatura_id', $asignaturaSolicitada->id)
                        ->orWhereRaw('LOWER(TRIM(asignaturas.nombre)) = ?', [$nombreNormalizado]);
                })
                ->select('asignatura_curso.id', DB::raw('COUNT(calificaciones.id) as total_notas'))
                ->groupBy('asignatura_curso.id')
                ->orderByDesc('total_notas')
                ->get();

            if ($filasExistentes->isNotEmpty()) {
                $filaPrincipal = $filasExistentes->first();

                DB::table('asignatura_curso')
                    ->where('id', $filaPrincipal->id)
                    ->update([
                        'profesor_id' => $profesor->id,
                        'updated_at' => now(),
                    ]);

                // Limpiar duplicados vacíos si existían para la misma asignatura y curso
                $idsDuplicados = $filasExistentes->slice(1)->pluck('id')->all();
                if (! empty($idsDuplicados)) {
                    DB::table('calificaciones')
                        ->whereIn('asignatura_curso_id', $idsDuplicados)
                        ->update(['asignatura_curso_id' => $filaPrincipal->id]);

                    DB::table('asignatura_curso')
                        ->whereIn('id', $idsDuplicados)
                        ->delete();
                }
            } else {
                DB::table('asignatura_curso')->insert([
                    'id' => Str::uuid()->toString(),
                    'curso_id' => $curso->id,
                    'asignatura_id' => $asignaturaSolicitada->id,
                    'profesor_id' => $profesor->id,
                    'ponderacion' => 1.00,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $profesor->assignRole('Profesor de Asignatura');
        }

        return back()->with('success', '✅ ¡Asignación de carga académica guardada correctamente!');
    }
}
