<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Services\ConexionIA;
use App\Services\ConfiguracionIAService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class ConfiguracionController extends Controller
{
    public function index(Request $request, ConfiguracionIAService $iaService): Response
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
        $configuracionIA = $iaService->obtenerConfiguracionPublica($user);

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
            if (config('funciones.whatsapp')) {
                $enlacesGenerados = DB::table('enlace_whats_apps')->count();
                $misEnlaces = DB::table('enlace_whats_apps')
                    ->where('user_id', $user->id)
                    ->count();
            }
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

                if (config('funciones.whatsapp')) {
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
                }
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

                if (config('funciones.whatsapp')) {
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
            }
        } catch (\Throwable $e) {
            // Ignorar si las tablas aún no están migradas en entorno local
        }

        return Inertia::render('Configuracion/Index', [
            'iaConfigurada' => $iaConfigurada || count($configuracionIA['modelos_personalizados']) > 0,
            'iaSistemaConfigurada' => $iaConfigurada,
            'modeloIA' => $configuracionIA['modelo_activo_id'],
            'proveedorIA' => $configuracionIA['modelo_activo_proveedor'],
            'configuracionIA' => $configuracionIA,
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

    public function guardarConfiguracionIA(Request $request, ConfiguracionIAService $iaService): JsonResponse
    {
        $user = $request->user();
        $accion = (string) $request->input('accion', 'actualizar_preferencias');

        if ($accion === 'agregar_modelo') {
            $validado = $request->validate([
                'proveedor' => 'required|string|in:groq,openai,gemini,anthropic,openrouter,custom',
                'model_id' => 'required|string|max:120',
                'nombre' => 'nullable|string|max:60',
                'subtitulo' => 'nullable|string|max:60',
                'api_key' => 'required|string|min:6|max:300',
                'base_url' => 'nullable|url|max:255',
                'activar_inmediatamente' => 'nullable|boolean',
            ]);

            $error = $this->validarAccesoAlModelo($iaService->credencialesModeloPersonalizado($validado));
            if ($error) {
                return $error;
            }

            $configActualizada = $iaService->agregarModeloPersonalizado($user->refresh(), $validado);

            return response()->json([
                'ok' => true,
                'message' => 'Modelo guardado de forma encriptada en tu cuenta.',
                'configuracionIA' => $configActualizada,
            ]);
        }

        if ($accion === 'eliminar_modelo') {
            $validado = $request->validate([
                'modelo_id' => 'required|string|max:120',
            ]);

            $configActualizada = $iaService->eliminarModeloPersonalizado($user, $validado['modelo_id']);

            return response()->json([
                'ok' => true,
                'message' => 'Modelo personalizado eliminado.',
                'configuracionIA' => $configActualizada,
            ]);
        }

        if ($accion === 'reiniciar_metricas') {
            $configActualizada = $iaService->reiniciarMetricasConsumo($user);

            return response()->json([
                'ok' => true,
                'message' => 'Contador de tokens reiniciado.',
                'configuracionIA' => $configActualizada,
            ]);
        }

        if ($accion === 'consultar_cuota') {
            $credenciales = $iaService->resolverCredencialesAgente($user, 'chat', [
                'modelo_id' => $request->input('modelo_id') ?: null,
            ]);

            if (empty($credenciales['api_key'])) {
                return response()->json([
                    'ok' => false,
                    'message' => 'No hay API Key configurada para consultar cuota.',
                ], 422);
            }

            try {
                $ping = ConexionIA::cliente($credenciales['base_url'], $credenciales['headers'], 10)
                    ->post('chat/completions', [
                        'model' => $credenciales['model'],
                        'messages' => [['role' => 'user', 'content' => 'OK']],
                        'max_tokens' => 1,
                    ]);

                if ($ping->successful()) {
                    $iaService->registrarConsumoYCuota($user, $credenciales, $ping);
                    $configActualizada = $iaService->obtenerConfiguracionPublica($user);

                    return response()->json([
                        'ok' => true,
                        'message' => "Cuota actualizada para {$credenciales['modelo_nombre']}.",
                        'configuracionIA' => $configActualizada,
                    ]);
                }

                return response()->json([
                    'ok' => false,
                    'message' => 'El proveedor respondió con estado HTTP '.$ping->status().'.',
                ], 502);
            } catch (\Throwable $e) {
                Log::warning('Falló la consulta de cuota de IA.', ['tipo' => $e::class]);

                return response()->json([
                    'ok' => false,
                    'message' => 'No fue posible consultar la cuota del proveedor.',
                ], 503);
            }
        }

        $validado = $request->validate([
            'modelo_activo_id' => 'nullable|string|max:120',
            'usar_mismo_modelo_agentes' => 'nullable|boolean',
            'modelo_chat_id' => 'nullable|string|max:120',
            'modelo_informes_id' => 'nullable|string|max:120',
            'tono_ia' => 'nullable|string|in:formal_decreto67,cercano_familia,ejecutivo_breve',
            'extension_ia' => 'nullable|string|in:breve,equilibrada,detallada',
            'precision_ia' => 'nullable|string|in:estricto,balanceado,dinamico',
            'instrucciones_ia' => 'nullable|string|max:350',
            'formato_visual_ia' => 'nullable|string|in:markdown,texto_plano',
            'efecto_escritura_ia' => 'nullable|boolean',
            'tamano_texto_chat' => 'nullable|string|in:normal,amplio',
            'mostrar_sugerencias_chat' => 'nullable|boolean',
        ]);

        $modeloActivoId = $validado['modelo_activo_id'] ?? null;
        if ($modeloActivoId !== null) {
            $config = $iaService->obtenerConfiguracionCruda($user);
            $modeloPersonalizado = collect($config['modelos_personalizados'])->firstWhere('id', $modeloActivoId);
            if ($modeloPersonalizado && $modeloActivoId !== $config['modelo_activo_id']) {
                $error = $this->validarAccesoAlModelo($iaService->credencialesModeloPersonalizado($modeloPersonalizado));
                if ($error) {
                    return $error;
                }

                $modelosActuales = $iaService->obtenerConfiguracionCruda($user->refresh())['modelos_personalizados'];
                if (! in_array($modeloPersonalizado, (array) $modelosActuales, true)) {
                    return response()->json([
                        'ok' => false,
                        'message' => 'El modelo cambió durante la verificación. Actualiza la página e inténtalo de nuevo.',
                    ], 409);
                }
            }
        }

        $configActualizada = $iaService->actualizarPreferenciasIA($user, $validado);

        return response()->json([
            'ok' => true,
            'message' => 'Configuración de IA y agentes actualizada.',
            'configuracionIA' => $configActualizada,
        ]);
    }

    public function probarConexionIA(Request $request, ConfiguracionIAService $iaService): JsonResponse
    {
        $validado = $request->validate([
            'api_key' => 'nullable|string|min:6|max:300',
            'proveedor' => 'nullable|string|in:groq,openai,gemini,anthropic,openrouter,custom',
            'modelo_id' => 'nullable|string|max:120',
            'model_id' => 'required_with:api_key|nullable|string|max:120',
            'base_url' => 'nullable|url|max:255',
        ]);
        $claveNueva = ! empty($validado['api_key']);
        $credenciales = $claveNueva
            ? $iaService->credencialesModeloPersonalizado($validado)
            : $iaService->resolverCredencialesAgente($request->user(), 'chat', [
                'modelo_id' => $validado['modelo_id'] ?? null,
            ]);

        $inicio = microtime(true);
        $error = $this->validarAccesoAlModelo($credenciales);
        if ($error) {
            return $error;
        }

        $latenciaMs = (int) round((microtime(true) - $inicio) * 1000);
        $modelos = $claveNueva ? $this->listarModelosProveedor($credenciales) : [];

        return response()->json([
            'ok' => true,
            'latencyMs' => $latenciaMs,
            'modelsCount' => count($modelos),
            'models' => array_slice($modelos, 0, 40),
            'activeModel' => $credenciales['model'],
            'message' => "Modelo verificado con {$credenciales['proveedor_nombre']}.",
        ]);
    }

    private function validarAccesoAlModelo(array $credenciales): ?JsonResponse
    {
        $proveedorNombre = $credenciales['proveedor_nombre'];
        if ($credenciales['api_key'] === '') {
            return response()->json([
                'ok' => false,
                'message' => 'No se encontró API Key configurada para este proveedor.',
            ], 422);
        }

        try {
            $response = ConexionIA::cliente($credenciales['base_url'], $credenciales['headers'], 15)
                ->post('chat/completions', [
                    'model' => $credenciales['model'],
                    'messages' => [['role' => 'user', 'content' => 'Responde OK.']],
                    'max_tokens' => 16,
                ]);
        } catch (ConnectionException $e) {
            Log::warning('Falló la prueba de conexión de IA.', ['tipo' => $e::class]);

            return response()->json([
                'ok' => false,
                'message' => "No fue posible conectar con {$proveedorNombre}.",
            ], 503);
        }

        if ($response->successful() && is_array($response->json('choices.0.message'))) {
            return null;
        }

        $message = match ($response->status()) {
            401 => "{$proveedorNombre} rechazó la API Key. Revisa la clave y vuelve a intentarlo.",
            403 => "{$proveedorNombre} denegó el acceso. Revisa los permisos de la API Key para este modelo.",
            402, 429 => "Revisa los créditos o la cuota de tu cuenta en {$proveedorNombre}.",
            400, 404, 422 => "{$proveedorNombre} no pudo usar este modelo. Revisa el ID y su disponibilidad.",
            default => "{$proveedorNombre} no pudo verificar este modelo. Inténtalo de nuevo.",
        };

        return response()->json(['ok' => false, 'message' => $message], 502);
    }

    private function listarModelosProveedor(array $credenciales): array
    {
        try {
            $response = ConexionIA::cliente($credenciales['base_url'], $credenciales['headers'], 5)->get('models');
        } catch (ConnectionException) {
            return [];
        }

        $modelos = $response->json('data');
        if (! $response->successful() || ! is_array($modelos)) {
            return [];
        }

        return collect($modelos)->pluck('id')
            ->filter(fn ($id) => is_string($id) && $id !== '')
            ->values()
            ->all();
    }
}
