<?php

namespace App\Http\Controllers;

use App\Models\ConfiguracionIAInstitucional;
use App\Models\Curso;
use App\Services\ConexionIA;
use App\Services\ConfiguracionIAService;
use App\Services\ProveedorIAAdapter;
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

        $configuracionIA = $iaService->obtenerConfiguracionPublica($user);
        $configuracionInstitucional = $iaService->obtenerConfiguracionInstitucionalPublica($esAdministrador);
        $iaConfigurada = (bool) ($configuracionIA['conexion_activa']['configurada'] ?? false);
        $iaSistemaConfigurada = (bool) ($configuracionInstitucional['configurada'] ?? false);

        $correosGenerados = 0;
        $misCorreos = 0;
        $registrosBitacora = 0;
        $historialImportaciones = [];
        $bitacoraCorreos = [];
        $miCargaDocente = [
            'jefaturas' => [],
            'asignaturas' => [],
        ];

        try {
            $correosGenerados = DB::table('comunicaciones_correo')->count();
            $misCorreos = DB::table('comunicaciones_correo')
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

                $bitacoraCorreos = DB::table('comunicaciones_correo')
                    ->leftJoin('users', 'comunicaciones_correo.user_id', '=', 'users.id')
                    ->leftJoin('matriculas', 'comunicaciones_correo.matricula_id', '=', 'matriculas.id')
                    ->leftJoin('estudiantes', 'matriculas.estudiante_id', '=', 'estudiantes.id')
                    ->leftJoin('cursos', 'matriculas.curso_id', '=', 'cursos.id')
                    ->select(
                        'comunicaciones_correo.id',
                        'comunicaciones_correo.tipo_destinatario',
                        'comunicaciones_correo.nombre_destino',
                        'comunicaciones_correo.correo_destino',
                        'comunicaciones_correo.asunto',
                        'comunicaciones_correo.origen',
                        'comunicaciones_correo.generado_en',
                        'users.name as emisor_nombre',
                        'estudiantes.nombres as estudiante_nombres',
                        'estudiantes.apellidos as estudiante_apellidos',
                        'cursos.nivel as curso_nivel',
                        'cursos.letra as curso_letra'
                    )
                    ->orderByDesc('comunicaciones_correo.generado_en')
                    ->limit(15)
                    ->get()
                    ->map(fn ($row) => [
                        'id' => $row->id,
                        'emisor' => $row->emisor_nombre ?? 'Docente',
                        'destinatario' => $row->nombre_destino
                            ?: (trim(($row->estudiante_nombres ?? '').' '.($row->estudiante_apellidos ?? '')) ?: 'Destinatario'),
                        'tipo_destinatario' => $row->tipo_destinatario,
                        'curso' => $row->curso_nivel ? "{$row->curso_nivel}° Medio {$row->curso_letra}" : 'Comunicación interna',
                        'correo' => $row->correo_destino ?? '-',
                        'asunto' => $row->asunto ?? '-',
                        'origen' => $row->origen ?? 'correo_directo',
                        'fecha' => $row->generado_en,
                    ])
                    ->values()
                    ->all();
            } else {
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

                $bitacoraCorreos = DB::table('comunicaciones_correo')
                    ->leftJoin('matriculas', 'comunicaciones_correo.matricula_id', '=', 'matriculas.id')
                    ->leftJoin('estudiantes', 'matriculas.estudiante_id', '=', 'estudiantes.id')
                    ->leftJoin('cursos', 'matriculas.curso_id', '=', 'cursos.id')
                    ->where('comunicaciones_correo.user_id', $user->id)
                    ->select(
                        'comunicaciones_correo.id',
                        'comunicaciones_correo.tipo_destinatario',
                        'comunicaciones_correo.nombre_destino',
                        'comunicaciones_correo.correo_destino',
                        'comunicaciones_correo.asunto',
                        'comunicaciones_correo.origen',
                        'comunicaciones_correo.generado_en',
                        'estudiantes.nombres as estudiante_nombres',
                        'estudiantes.apellidos as estudiante_apellidos',
                        'cursos.nivel as curso_nivel',
                        'cursos.letra as curso_letra'
                    )
                    ->orderByDesc('comunicaciones_correo.generado_en')
                    ->limit(15)
                    ->get()
                    ->map(fn ($row) => [
                        'id' => $row->id,
                        'emisor' => $user->name,
                        'destinatario' => $row->nombre_destino
                            ?: (trim(($row->estudiante_nombres ?? '').' '.($row->estudiante_apellidos ?? '')) ?: 'Destinatario'),
                        'tipo_destinatario' => $row->tipo_destinatario,
                        'curso' => $row->curso_nivel ? "{$row->curso_nivel}° Medio {$row->curso_letra}" : 'Comunicación interna',
                        'correo' => $row->correo_destino ?? '-',
                        'asunto' => $row->asunto ?? '-',
                        'origen' => $row->origen ?? 'correo_directo',
                        'fecha' => $row->generado_en,
                    ])
                    ->values()
                    ->all();
            }
        } catch (\Throwable) {
            // Ignorar si las tablas aún no están migradas en entorno local
        }

        return Inertia::render('Configuracion/Index', [
            'iaConfigurada' => $iaConfigurada,
            'iaSistemaConfigurada' => $iaSistemaConfigurada,
            'modeloIA' => $configuracionIA['conexion_activa']['modelo_nombre'] ?? $configuracionIA['modelo_activo_id'],
            'proveedorIA' => $configuracionIA['conexion_activa']['proveedor_nombre'] ?? $configuracionIA['modelo_activo_proveedor'],
            'configuracionIA' => $configuracionIA,
            'configuracionInstitucional' => $configuracionInstitucional,
            'planesColegio' => array_values(ConfiguracionIAService::PLANES_COLEGIO),
            'rolInfo' => [
                'esAdministrador' => $esAdministrador,
                'esProfesorJefe' => $esProfesorJefe,
                'esProfesorAsignatura' => $esProfesorAsignatura,
                'etiqueta' => $rolEtiqueta,
            ],
            'estadisticasSistema' => [
                'correosGenerados' => $correosGenerados,
                'misCorreos' => $misCorreos,
                'registrosBitacora' => $registrosBitacora,
            ],
            'historialImportaciones' => $historialImportaciones,
            'bitacoraCorreos' => $bitacoraCorreos,
            'miCargaDocente' => $miCargaDocente,
        ]);
    }

    public function guardarConfiguracionIA(Request $request, ConfiguracionIAService $iaService): JsonResponse
    {
        $user = $request->user();
        $accion = (string) $request->input('accion', 'actualizar_preferencias');

        if ($accion === 'guardar_institucional') {
            abort_unless(
                $user && method_exists($user, 'hasRole') && $user->hasRole('Administrador'),
                403,
                'Solo Administración puede configurar el plan institucional de IA.'
            );

            $planesValidos = implode(',', array_keys(ConfiguracionIAService::PLANES_COLEGIO));
            $validado = $request->validate([
                'plan_activo' => "required|string|in:{$planesValidos}",
                'proveedor' => 'required|string|in:groq,openai,gemini,anthropic,openrouter,custom',
                'base_url' => 'nullable|url|max:255',
                'api_key' => 'nullable|string|min:6|max:300',
                'limpiar_api_key' => 'nullable|boolean',
                'modelo_chat' => 'required|string|max:120',
                'modelo_informes' => 'nullable|string|max:120',
                'presupuesto_mensual_usd' => 'nullable|numeric|min:0|max:10000',
                'alerta_porcentaje' => 'nullable|integer|min:10|max:100',
                'solicitudes_diarias_limite' => 'nullable|integer|min:100|max:50000',
                'permitir_clave_personal_docentes' => 'nullable|boolean',
                'verificada' => 'nullable|boolean',
            ]);

            $instActualizada = $iaService->guardarConfiguracionInstitucional($user, $validado);
            $configActualizada = $iaService->obtenerConfiguracionPublica($user);

            return response()->json([
                'ok' => true,
                'message' => 'Plan de IA del colegio guardado y activado.',
                'configuracionInstitucional' => $instActualizada,
                'configuracionIA' => $configActualizada,
            ]);
        }

        if ($accion === 'usar_plan_institucional') {
            $configActualizada = $iaService->actualizarPreferenciasIA($user, [
                'modelo_activo_id' => ConfiguracionIAService::MODELO_INSTITUCIONAL_ID,
                'modelo_chat_id' => ConfiguracionIAService::MODELO_INSTITUCIONAL_ID,
                'modelo_informes_id' => ConfiguracionIAService::MODELO_INSTITUCIONAL_ID,
                'usar_mismo_modelo_agentes' => true,
            ]);

            return response()->json([
                'ok' => true,
                'message' => 'Ahora estás usando el plan de IA del colegio.',
                'configuracionIA' => $configActualizada,
            ]);
        }

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

            $configActualizada = $iaService->agregarModeloPersonalizado($user, $validado);

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

            $proveedor = (string) ($credenciales['proveedor'] ?? 'groq');
            $endpoint = ProveedorIAAdapter::endpointGeneracion($proveedor);
            $payload = ProveedorIAAdapter::prepararPeticion($proveedor, [
                'model' => $credenciales['model'],
                'messages' => [['role' => 'user', 'content' => 'OK']],
                'max_tokens' => 4,
            ]);

            try {
                $ping = ConexionIA::cliente($credenciales['base_url'], $credenciales['headers'], 12)
                    ->post($endpoint, $payload);

                if ($ping->successful()) {
                    $iaService->registrarConsumoYCuota($user, $credenciales, $ping);
                    $configActualizada = $iaService->obtenerConfiguracionPublica($user);
                    $esAdmin = method_exists($user, 'hasRole') && $user->hasRole('Administrador');

                    $etiquetaModelo = $credenciales['modelo_etiqueta'] ?? $credenciales['modelo_nombre'];

                    return response()->json([
                        'ok' => true,
                        'message' => "Cuota actualizada para {$etiquetaModelo}.",
                        'configuracionIA' => $configActualizada,
                        'configuracionInstitucional' => $iaService->obtenerConfiguracionInstitucionalPublica($esAdmin),
                    ]);
                }

                return response()->json([
                    'ok' => false,
                    'message' => ProveedorIAAdapter::mensajeErrorSeguro($ping, (string) $credenciales['proveedor_nombre'], (string) $credenciales['model']),
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

        $configActualizada = $iaService->actualizarPreferenciasIA($user, $validado);

        return response()->json([
            'ok' => true,
            'message' => 'Configuración de IA y agentes actualizada.',
            'configuracionIA' => $configActualizada,
        ]);
    }

    public function probarConexionIA(Request $request, ConfiguracionIAService $iaService): JsonResponse
    {
        $user = $request->user();
        $validado = $request->validate([
            'api_key' => 'nullable|string|max:300',
            'proveedor' => 'nullable|string|in:groq,openai,gemini,anthropic,openrouter,custom',
            'modelo_id' => 'nullable|string|max:120',
            'model_id' => 'nullable|string|max:120',
            'base_url' => 'nullable|string|max:255',
            'verificar_respuesta' => 'nullable|boolean',
            'probar_institucional' => 'nullable|boolean',
        ]);

        $apiKeyInput = trim((string) ($validado['api_key'] ?? ''));
        $proveedorId = (string) ($validado['proveedor'] ?? 'groq');
        $probarInstitucional = $request->boolean('probar_institucional');

        if ($apiKeyInput !== '') {
            $proveedorInfo = ConfiguracionIAService::PROVEEDORES[$proveedorId] ?? ConfiguracionIAService::PROVEEDORES['groq'];
            $baseUrl = ConexionIA::validarBaseUrl((string) (($validado['base_url'] ?? '') ?: $proveedorInfo['base_url']));
            $apiKey = $apiKeyInput;
            $proveedorNombre = $proveedorInfo['nombre'];
            $activeModel = trim((string) ($validado['model_id'] ?? '')) ?: ConfiguracionIAService::MODELO_CHAT_DEFAULT;
        } elseif ($probarInstitucional) {
            abort_unless($user && method_exists($user, 'hasRole') && $user->hasRole('Administrador'), 403);
            $credenciales = $iaService->resolverCredencialesAgente(null, 'chat');
            $apiKey = $credenciales['api_key'];
            $baseUrl = $credenciales['base_url'];
            $proveedorNombre = $credenciales['proveedor_nombre'];
            $activeModel = trim((string) ($validado['model_id'] ?? '')) ?: $credenciales['model'];
            $proveedorId = $credenciales['proveedor'];
        } else {
            $credenciales = $iaService->resolverCredencialesAgente($user, 'chat', [
                'modelo_id' => $validado['modelo_id'] ?? null,
            ]);
            $apiKey = $credenciales['api_key'];
            $baseUrl = $credenciales['base_url'];
            $proveedorNombre = $credenciales['proveedor_nombre'];
            $activeModel = trim((string) ($validado['model_id'] ?? '')) ?: $credenciales['model'];
            $proveedorId = $credenciales['proveedor'];
        }

        if ($apiKey === '') {
            return response()->json([
                'ok' => false,
                'message' => 'No hay API Key configurada todavía. Ingresa una clave para probar la conexión.',
            ], 422);
        }

        $inicio = microtime(true);
        $headersModelos = ProveedorIAAdapter::headersModelos($proveedorId, $apiKey);
        $verificarRespuesta = $request->boolean('verificar_respuesta');

        try {
            $response = ConexionIA::cliente($baseUrl, $headersModelos, 10)->get('models');
            $latenciaMs = (int) round((microtime(true) - $inicio) * 1000);

            if (! $response->successful()) {
                return response()->json([
                    'ok' => false,
                    'latencyMs' => $latenciaMs,
                    'message' => ProveedorIAAdapter::mensajeErrorSeguro($response, $proveedorNombre, $activeModel),
                ], 502);
            }

            $data = $response->json();
            $rawModels = isset($data['data']) && is_array($data['data']) ? $data['data'] : [];
            $modelos = count($rawModels);
            $listaIds = ProveedorIAAdapter::filtrarModelosChat($rawModels, $proveedorId);

            if ($verificarRespuesta && $activeModel !== '') {
                $endpoint = ProveedorIAAdapter::endpointGeneracion($proveedorId);
                $headersChat = ProveedorIAAdapter::headers($proveedorId, $apiKey);
                $payload = ProveedorIAAdapter::prepararPeticion($proveedorId, [
                    'model' => $activeModel,
                    'messages' => [['role' => 'user', 'content' => 'Responde solo OK']],
                    'max_tokens' => 16,
                    'temperature' => 0,
                ]);

                $ping = ConexionIA::cliente($baseUrl, $headersChat, 14)->post($endpoint, $payload);
                $latenciaMs = (int) round((microtime(true) - $inicio) * 1000);

                if (! $ping->successful()) {
                    return response()->json([
                        'ok' => false,
                        'latencyMs' => $latenciaMs,
                        'modelsCount' => $modelos,
                        'models' => $listaIds,
                        'activeModel' => $activeModel,
                        'message' => ProveedorIAAdapter::mensajeErrorSeguro($ping, $proveedorNombre, $activeModel),
                    ], 502);
                }
            }

            if ($probarInstitucional && ($inst = ConfiguracionIAInstitucional::vigente())) {
                $inst->verificada_en = now();
                $inst->save();
            }

            $etiquetaModeloActivo = $iaService->etiquetaCompletaModelo($activeModel);

            return response()->json([
                'ok' => true,
                'respuestaVerificada' => $verificarRespuesta,
                'latencyMs' => $latenciaMs,
                'modelsCount' => $modelos,
                'models' => $listaIds,
                'activeModel' => $activeModel,
                'message' => $verificarRespuesta
                    ? "Conexión y respuesta verificadas con {$proveedorNombre} · {$etiquetaModeloActivo} ({$latenciaMs} ms)."
                    : "Conexión activa con {$proveedorNombre} ({$latenciaMs} ms · {$modelos} modelos disponibles).",
            ]);
        } catch (\Throwable $e) {
            Log::warning('Falló la prueba de conexión de IA.', ['tipo' => $e::class]);

            return response()->json([
                'ok' => false,
                'message' => "No fue posible conectar con {$proveedorNombre}. Verifica tu conexión a internet.",
            ], 503);
        }
    }
}
