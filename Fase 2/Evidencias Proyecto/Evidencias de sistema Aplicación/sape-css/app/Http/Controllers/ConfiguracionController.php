<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;

class ConfiguracionController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $esAdministrador = $user && method_exists($user, 'hasRole') && $user->hasRole('Administrador');
        $esProfesorJefe = $user && method_exists($user, 'hasRole') && $user->hasRole('Profesor Jefe');
        $esProfesorAsignatura = $user && method_exists($user, 'hasRole') && $user->hasRole('Profesor de Asignatura');

        $rolEtiqueta = $esAdministrador
            ? 'Administrador / Dirección'
            : ($esProfesorJefe && $esProfesorAsignatura
                ? 'Profesor Jefe y de Asignatura'
                : ($esProfesorJefe
                    ? 'Profesor Jefe'
                    : ($esProfesorAsignatura ? 'Profesor de Asignatura' : 'Docente')));

        $apiKey = (string) env('GROQ_API_KEY', '');
        $iaConfigurada = strlen(trim($apiKey)) > 10;

        $enlacesGenerados = 0;
        $misEnlaces = 0;
        $registrosBitacora = 0;
        $historialImportaciones = [];
        $bitacoraWhatsapp = [];
        $miCargaDocente = [
            'jefaturas' => [],
            'asignaturas' => [],
        ];

        try {
            $enlacesGenerados = DB::table('enlace_whats_apps')->count();
            $misEnlaces = DB::table('enlace_whats_apps')
                ->where('user_id', $user->id)
                ->count();
            $registrosBitacora = DB::table('registro_bitacoras')->count();

            if ($esAdministrador) {
                $historialImportaciones = DB::table('importacion_excels')
                    ->orderByDesc('created_at')
                    ->limit(15)
                    ->get()
                    ->map(fn ($row) => [
                        'id' => $row->id,
                        'archivoOriginal' => $row->archivoOriginal,
                        'estadoImportacion' => $row->estadoImportacion,
                        'filasProcesadas' => (int) ($row->filasProcesadas ?? 0),
                        'finalizadaEn' => $row->finalizadaEn ?? $row->created_at,
                    ])
                    ->values()
                    ->all();

                $bitacoraWhatsapp = DB::table('enlace_whats_apps')
                    ->leftJoin('users', 'enlace_whats_apps.user_id', '=', 'users.id')
                    ->leftJoin('matriculas', 'enlace_whats_apps.matricula_id', '=', 'matriculas.id')
                    ->leftJoin('estudiantes', 'matriculas.estudiante_id', '=', 'estudiantes.id')
                    ->leftJoin('cursos', 'matriculas.curso_id', '=', 'cursos.id')
                    ->select(
                        'enlace_whats_apps.id',
                        'enlace_whats_apps.telefonoDestinoSnapshot',
                        'enlace_whats_apps.estado',
                        'enlace_whats_apps.generadoEn',
                        'users.name as docente_nombre',
                        'estudiantes.nombres as estudiante_nombres',
                        'estudiantes.apellidos as estudiante_apellidos',
                        'cursos.nivel as curso_nivel',
                        'cursos.letra as curso_letra'
                    )
                    ->orderByDesc('enlace_whats_apps.generadoEn')
                    ->limit(15)
                    ->get()
                    ->map(fn ($row) => [
                        'id' => $row->id,
                        'docente' => $row->docente_nombre ?? 'Docente',
                        'estudiante' => trim(($row->estudiante_nombres ?? '').' '.($row->estudiante_apellidos ?? '')) ?: 'Estudiante',
                        'curso' => $row->curso_nivel ? "{$row->curso_nivel}° Medio {$row->curso_letra}" : '-',
                        'telefono' => $row->telefonoDestinoSnapshot ?? '-',
                        'estado' => $row->estado ?? 'ABIERTO_POR_DOCENTE',
                        'fecha' => $row->generadoEn,
                    ])
                    ->values()
                    ->all();
            } else {
                // Datos exclusivos para el rol Profesor
                $jefaturas = Curso::where('profesor_jefe_id', $user->id)
                    ->orderBy('nivel')
                    ->orderBy('letra')
                    ->get()
                    ->map(fn ($c) => [
                        'id' => $c->id,
                        'nombre' => "{$c->nivel}° Medio {$c->letra}",
                        'anioEscolar' => $c->anioEscolar,
                    ])
                    ->values()
                    ->all();

                $asignaturas = DB::table('asignatura_curso')
                    ->join('cursos', 'asignatura_curso.curso_id', '=', 'cursos.id')
                    ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
                    ->where('asignatura_curso.profesor_id', $user->id)
                    ->select(
                        'asignatura_curso.id',
                        'asignaturas.nombre as asignatura_nombre',
                        'cursos.nivel',
                        'cursos.letra',
                        'cursos.anioEscolar'
                    )
                    ->orderBy('cursos.nivel')
                    ->orderBy('cursos.letra')
                    ->get()
                    ->map(fn ($r) => [
                        'id' => $r->id,
                        'asignatura' => $r->asignatura_nombre,
                        'curso' => "{$r->nivel}° Medio {$r->letra}",
                        'anioEscolar' => $r->anioEscolar,
                    ])
                    ->values()
                    ->all();

                $miCargaDocente = [
                    'jefaturas' => $jefaturas,
                    'asignaturas' => $asignaturas,
                ];

                $bitacoraWhatsapp = DB::table('enlace_whats_apps')
                    ->leftJoin('matriculas', 'enlace_whats_apps.matricula_id', '=', 'matriculas.id')
                    ->leftJoin('estudiantes', 'matriculas.estudiante_id', '=', 'estudiantes.id')
                    ->leftJoin('cursos', 'matriculas.curso_id', '=', 'cursos.id')
                    ->where('enlace_whats_apps.user_id', $user->id)
                    ->select(
                        'enlace_whats_apps.id',
                        'enlace_whats_apps.telefonoDestinoSnapshot',
                        'enlace_whats_apps.estado',
                        'enlace_whats_apps.generadoEn',
                        'estudiantes.nombres as estudiante_nombres',
                        'estudiantes.apellidos as estudiante_apellidos',
                        'cursos.nivel as curso_nivel',
                        'cursos.letra as curso_letra'
                    )
                    ->orderByDesc('enlace_whats_apps.generadoEn')
                    ->limit(10)
                    ->get()
                    ->map(fn ($row) => [
                        'id' => $row->id,
                        'docente' => $user->name,
                        'estudiante' => trim(($row->estudiante_nombres ?? '').' '.($row->estudiante_apellidos ?? '')) ?: 'Estudiante',
                        'curso' => $row->curso_nivel ? "{$row->curso_nivel}° Medio {$row->curso_letra}" : '-',
                        'telefono' => $row->telefonoDestinoSnapshot ?? '-',
                        'estado' => $row->estado ?? 'ABIERTO_POR_DOCENTE',
                        'fecha' => $row->generadoEn,
                    ])
                    ->values()
                    ->all();
            }
        } catch (\Throwable $e) {
            // Ignorar si las tablas aún no están migradas en entorno local
        }

        return Inertia::render('Configuracion/Index', [
            'iaConfigurada' => $iaConfigurada,
            'modeloIA' => 'llama-3.3-70b-versatile',
            'proveedorIA' => 'Groq Cloud (OpenAI Compatible)',
            'rolInfo' => [
                'esAdministrador' => $esAdministrador,
                'esProfesorJefe' => $esProfesorJefe,
                'esProfesorAsignatura' => $esProfesorAsignatura,
                'etiqueta' => $rolEtiqueta,
            ],
            'estadisticasSistema' => [
                'enlacesGenerados' => $enlacesGenerados,
                'misEnlaces' => $misEnlaces,
                'registrosBitacora' => $registrosBitacora,
            ],
            'historialImportaciones' => $historialImportaciones,
            'bitacoraWhatsapp' => $bitacoraWhatsapp,
            'miCargaDocente' => $miCargaDocente,
        ]);
    }

    public function probarConexionIA(): JsonResponse
    {
        $apiKey = trim((string) env('GROQ_API_KEY', ''));

        if ($apiKey === '') {
            return response()->json([
                'ok' => false,
                'message' => 'No se encontró GROQ_API_KEY configurada en el archivo .env del servidor.',
            ], 422);
        }

        $inicio = microtime(true);

        try {
            $response = Http::withoutVerifying()
                ->timeout(8)
                ->withHeaders([
                    'Authorization' => 'Bearer '.$apiKey,
                ])
                ->get('https://api.groq.com/openai/v1/models');

            $latenciaMs = (int) round((microtime(true) - $inicio) * 1000);

            if (! $response->successful()) {
                return response()->json([
                    'ok' => false,
                    'latencyMs' => $latenciaMs,
                    'message' => 'Groq respondió con código HTTP '.$response->status().'. Verifica la validez de GROQ_API_KEY.',
                ], 502);
            }

            $data = $response->json();
            $modelos = isset($data['data']) && is_array($data['data']) ? count($data['data']) : 0;

            return response()->json([
                'ok' => true,
                'latencyMs' => $latenciaMs,
                'modelsCount' => $modelos,
                'activeModel' => 'llama-3.3-70b-versatile',
                'message' => "Conexión activa con Groq Cloud ({$latenciaMs} ms · {$modelos} modelos disponibles).",
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'message' => 'No fue posible conectar con api.groq.com: '.$e->getMessage(),
            ], 500);
        }
    }
}
