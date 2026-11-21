<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Models\Matricula;
use App\Models\MensajeChat;
use App\Models\SesionChat;
use App\Services\ConexionIA;
use App\Services\ConfiguracionIAService;
use App\Services\HerramientasPedagogicasService;
use App\Services\PrivacidadService;
use App\Services\ProveedorIAAdapter;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ChatbotController extends Controller
{
    private const MAX_RONDAS_TOOLS = 2;

    private const MAX_LLAMADAS_TOOLS = 4;

    public function listarSesiones(Request $request, ConfiguracionIAService $iaService): JsonResponse
    {
        $user = $request->user();
        $validado = $request->validate(['curso_id' => 'required|uuid']);
        $curso = Curso::find($validado['curso_id']);
        abort_if(! $curso, 404, 'El curso ya no está disponible.');
        Gate::authorize('consultarChat', $curso);
        $alcance = $this->alcanceAcademico($curso, $user->id);
        $configIA = $iaService->obtenerConfiguracionPublica($user);

        $sesionesFormateadas = [];

        try {
            $sesiones = SesionChat::with('mensajes')
                ->vigente()
                ->where('user_id', $user->id)
                ->where('curso_id', $curso->id)
                ->where('alcance_academico', $alcance['firma'])
                ->orderByDesc('updated_at')
                ->limit(25)
                ->get();

            foreach ($sesiones as $sesion) {
                $mensajes = $sesion->mensajes->map(fn ($m) => [
                    'id' => $m->id,
                    'role' => $m->autor === 'DOCENTE' ? 'user' : 'ai',
                    'content' => $m->contenido,
                    'modeloNombre' => $m->modelo_nombre,
                    'fecha' => $m->creadoEn ?? $m->created_at,
                ])->values()->all();

                if (count($mensajes) === 0) {
                    continue;
                }

                $primerMensajeUsuario = collect($mensajes)->firstWhere('role', 'user');
                $tituloFallback = $primerMensajeUsuario
                    ? Str::limit($primerMensajeUsuario['content'], 46)
                    : 'Consulta pedagógica';

                $sesionesFormateadas[] = [
                    'id' => $sesion->id,
                    'titulo' => $sesion->titulo ?: $tituloFallback,
                    'curso_id' => $sesion->curso_id,
                    'modelo_id' => $sesion->modelo_id ?? null,
                    'actualizadaEn' => $sesion->updated_at?->toIso8601String(),
                    'mensajes' => $mensajes,
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('No se pudieron cargar sesiones de chat.', ['tipo' => $e::class]);

            return response()->json(['message' => 'No se pudo cargar el historial del chat.'], 500);
        }

        return response()->json([
            'sesiones' => $sesionesFormateadas,
            'configuracionIA' => $configIA,
        ])->header('Cache-Control', 'no-store');
    }

    public function eliminarSesion(Request $request, string $sesionId): JsonResponse
    {
        $user = $request->user();
        abort_unless(Str::isUuid($sesionId), 404);

        try {
            SesionChat::where('id', $sesionId)
                ->where('user_id', $user->id)
                ->delete();
        } catch (\Throwable $e) {
            return response()->json(['ok' => false], 500);
        }

        return response()->json(['ok' => true]);
    }

    public function sendMessage(Request $request, ConfiguracionIAService $iaService)
    {
        // 1. Ampliar límite de tiempo
        set_time_limit(120);

        $validado = $request->validate([
            'mensaje' => 'required|string|max:2000',
            'curso_id' => 'required|uuid',
            'sesion_id' => 'nullable|uuid',
            'modelo_id' => 'nullable|string|max:120',
            'tono_ia' => 'nullable|string|in:formal_decreto67,cercano_familia,ejecutivo_breve',
            'extension_ia' => 'nullable|string|in:breve,equilibrada,detallada',
            'precision_ia' => 'nullable|string|in:estricto,balanceado,dinamico',
            'formato_visual_ia' => 'nullable|string|in:markdown,texto_plano',
            'instrucciones_ia' => 'nullable|string|max:350',
        ]);

        $user = $request->user();
        $curso = Curso::find($validado['curso_id']);
        abort_if(! $curso, 404, 'El curso ya no está disponible.');
        Gate::authorize('consultarChat', $curso);
        $alcance = $this->alcanceAcademico($curso, $user->id);
        $sesionActiva = null;
        if (! empty($validado['sesion_id'])) {
            $sesionActiva = SesionChat::where('id', $validado['sesion_id'])
                ->vigente()
                ->where('user_id', $user->id)
                ->where('curso_id', $curso->id)
                ->where('alcance_academico', $alcance['firma'])
                ->first();
            if (! $sesionActiva) {
                return response()->json(['respuesta' => 'Esta conversación ya no está disponible en el curso. Abre un chat nuevo.'], 404);
            }
        }

        try {
            // 2. Obtener contexto real y desglosado del curso (sin exponer nombres reales a la IA)
            $curso->load([
                'estudiantes' => fn ($query) => $query->where('matriculas.vigente', true),
                'estudiantes.calificaciones' => function ($query) use ($curso, $alcance) {
                    $query->select(
                        'calificaciones.*',
                        'asignaturas.nombre as asignatura_nombre',
                        'asignatura_curso.asignatura_id',
                        'asignatura_curso.curso_id as curso_id'
                    )
                        ->join('asignatura_curso', 'calificaciones.asignatura_curso_id', '=', 'asignatura_curso.id')
                        ->join('asignaturas', 'asignatura_curso.asignatura_id', '=', 'asignaturas.id')
                        ->where('asignatura_curso.curso_id', $curso->id)
                        ->where('matriculas.curso_id', $curso->id)
                        ->where('matriculas.vigente', true);

                    if ($alcance['asignaturas'] !== null) {
                        $query->whereIn('asignatura_curso.id', $alcance['asignaturas']);
                    }
                },
            ]);

            // INDG-27: anonimizar el mensaje antes de enviarlo a la IA.
            $privacidad = app(PrivacidadService::class);
            $herramientasService = app(HerramientasPedagogicasService::class);
            ['texto' => $mensajeSeguro, 'mapa' => $mapa] = $privacidad->anonimizar(
                $request->mensaje, $curso->estudiantes
            );

            $indiceCurso = $herramientasService->prepararIndiceCurso($curso, $mapa);
            $contextoAcademico = $herramientasService->construirResumenCursoBase($curso, $indiceCurso, $alcance, false);
            $mensajeSeguro = $this->anonimizarRutsEnTexto($mensajeSeguro, $curso->estudiantes);

            // 3. Resolver modelo, API Key y preferencias del usuario (o fallback a Groq del sistema)
            $credenciales = $iaService->resolverCredencialesAgente(
                $user,
                'chat',
                array_filter([
                    'modelo_id' => $request->input('modelo_id'),
                    'tono_ia' => $request->input('tono_ia'),
                    'extension_ia' => $request->input('extension_ia'),
                    'precision_ia' => $request->input('precision_ia'),
                    'formato_visual_ia' => $request->input('formato_visual_ia'),
                    'instrucciones_ia' => $request->input('instrucciones_ia'),
                ], fn ($v) => $v !== null && $v !== '')
            );

            $reglaFormato = $credenciales['formato_visual'] === 'texto_plano'
                ? 'Responde en texto plano, con saltos de línea y listas con guiones. Evita negritas, tablas, barras verticales y etiquetas HTML como <br>.'
                : 'Responde en Markdown con subtítulos breves (###), negritas y listas con viñetas. Prohibido usar tablas Markdown con barras verticales (|) o etiquetas HTML como <br>; para planes o comparativas con varios campos (ej. Fase, Objetivo, Acciones, Responsable, Plazo), usa un subtítulo por fase o caso y viñetas etiquetadas (- **Campo:** detalle).';

            $reglaIdentidad = 'Al mencionar a un estudiante o su RUT, copia únicamente tokens exactos entregados por el contexto, el historial o las herramientas con sus corchetes ([ALUMNO_X] o [RUT_X]). Nunca inventes ni adivines un token [ALUMNO_X], nunca incluyas en listas de riesgo a estudiantes sin asignaturas ni promedio general bajo 4.0, ni inventes datos inexistentes (como asistencia por asignatura). Si aparece [ALUMNO_SIN_ESPECIFICAR], indica brevemente que hay más de un estudiante con ese nombre y pide precisar el apellido.';

            $instrucciones = $privacidad->anonimizar($credenciales['instrucciones_personalizadas'], $curso->estudiantes)['texto'];
            $instrucciones = $this->anonimizarRutsEnTexto($instrucciones, $curso->estudiantes);
            $extraInstrucciones = $instrucciones !== ''
                ? " Instrucción adicional del docente: {$instrucciones}."
                : '';

            $rol = $alcance['asignaturas'] !== null
                ? 'Profesor de Asignatura'
                : ($user->hasRole('Administrador') ? 'Administrador' : 'Profesor Jefe');
            $limiteAsignaturas = $alcance['asignaturas'] !== null
                ? ' Las notas y los promedios corresponden a las asignaturas impartidas por este docente.'
                : '';

            $construirPromptSistema = static function (string $bloqueContexto, bool $conTools) use ($rol, $limiteAsignaturas, $reglaIdentidad, $credenciales, $reglaFormato, $extraInstrucciones): string {
                $guiaTools = $conTools
                    ? ' Cuando pregunten por casos en riesgo, alumnos bajo 4.0, una asignatura específica, el detalle o plan de un estudiante ([ALUMNO_X]), asistencia, evolución semestral o comparativa de cursos, llama SIEMPRE primero a la herramienta correspondiente antes de nombrar estudiantes o dar cifras; nunca inventes datos.'
                    : '';

                return <<<PROMPT
                Eres un asistente pedagógico experto y empático. Ayudas a un {$rol} de Chile.{$limiteAsignaturas}

                {$bloqueContexto}

                Sé directo y profesional. Usa únicamente las cifras entregadas por el contexto o las herramientas.{$guiaTools} Al proponer estrategias, considera el porcentaje de calificaciones bajo 4.0 y distínguelo de los porcentajes de estudiantes. Sugiere acciones pedagógicas concretas, pautas de evaluación o dinámicas de clase según la consulta y el Decreto 67.
                Presenta primero lo esencial y cierra la respuesta con una idea completa dentro de la extensión elegida.
                {$reglaIdentidad}
                {$credenciales['instruccion_tono']} {$credenciales['instruccion_extension']}
                {$reglaFormato}{$extraInstrucciones}
                PROMPT;
            };

            $promptSistema = $construirPromptSistema($contextoAcademico, true);

            // 4. API Key (clave personal, plan institucional en BD o GROQ_API_KEY de respaldo)
            $apiKey = $credenciales['api_key'];

            if (empty($apiKey)) {
                return response()->json([
                    'respuesta' => 'Falta configurar una API Key de IA. Activa el plan del colegio o conecta tu clave en Configuración → IA.',
                    'requiere_configuracion' => true,
                ], 422);
            }

            // Construir mensajes incluyendo contexto previo de la sesión si existe (siempre anonimizado)
            $mensajesPayload = [
                ['role' => 'system', 'content' => $promptSistema],
            ];
            $numerosExpuestos = [];
            $this->registrarNumerosTokensExpuestos($mensajeSeguro, $numerosExpuestos);
            $this->registrarNumerosTokensExpuestos($instrucciones, $numerosExpuestos);

            if ($sesionActiva) {
                $previos = $sesionActiva->mensajes()->reorder('created_at', 'desc')->limit(4)->get()->reverse();
                foreach ($previos as $prev) {
                    $anonPrev = $privacidad->anonimizar($prev->contenido, $curso->estudiantes);
                    $textoPrevSeguro = $this->anonimizarRutsEnTexto($anonPrev['texto'], $curso->estudiantes);
                    $limiteChars = $prev->autor === 'DOCENTE' ? 400 : 650;
                    $textoPrevRecortado = Str::limit($textoPrevSeguro, $limiteChars, '…');
                    $this->registrarNumerosTokensExpuestos($textoPrevRecortado, $numerosExpuestos);
                    $mensajesPayload[] = [
                        'role' => $prev->autor === 'DOCENTE' ? 'user' : 'assistant',
                        'content' => $textoPrevRecortado,
                    ];
                }
            }

            $mensajesPayload[] = ['role' => 'user', 'content' => $mensajeSeguro];
            foreach ($mensajesPayload as &$mensaje) {
                $mensaje['content'] = $privacidad->ocultarContactos($mensaje['content']);
            }
            unset($mensaje);

            $totalCharsPayload = array_sum(array_map(fn ($mensaje) => mb_strlen($mensaje['content']), $mensajesPayload));
            if ($totalCharsPayload > 32000) {
                return response()->json(['respuesta' => 'El contexto es demasiado extenso. Inicia un chat nuevo.'], 422);
            }

            // 5. Petición multi-proveedor con Tool Calling seguro vía ProveedorIAAdapter
            $proveedor = (string) ($credenciales['proveedor'] ?? 'groq');
            $presupuesto = ProveedorIAAdapter::presupuestoTokens($proveedor, (string) $credenciales['model'], (int) $credenciales['max_tokens']);
            $endpoint = ProveedorIAAdapter::endpointGeneracion($proveedor);
            $definicionesTools = $herramientasService->definiciones($user, $curso, $alcance);

            $peticion = ProveedorIAAdapter::prepararPeticion($proveedor, [
                'model' => $credenciales['model'],
                'messages' => $mensajesPayload,
                'temperature' => $credenciales['temperature'],
                'max_tokens' => $presupuesto,
                'tools' => $definicionesTools,
                'tool_choice' => 'auto',
            ]);
            $cliente = ConexionIA::cliente($credenciales['base_url'], $credenciales['headers'], 30);
            $usoRespaldoGroq = false;
            $herramientasUsadas = [];
            $rondaTools = 0;
            $totalLlamadasTools = 0;

            $response = $this->enviarConRespaldoGroq($cliente, $endpoint, $peticion, $proveedor, $credenciales, $usoRespaldoGroq);

            // Degradación automática: si el modelo o proveedor no soporta tools (HTTP 400 / tool_use_failed), reintentar sin tools con nómina compacta
            if (ProveedorIAAdapter::esErrorSoporteHerramientas($response)) {
                $contextoFallback = $herramientasService->construirResumenCursoBase($curso, $indiceCurso, $alcance, true);
                $this->registrarNumerosTokensExpuestos($contextoFallback, $numerosExpuestos);
                $mensajesFallback = $mensajesPayload;
                $mensajesFallback[0]['content'] = $privacidad->ocultarContactos($construirPromptSistema($contextoFallback, false));

                $peticion = ProveedorIAAdapter::prepararPeticion($proveedor, [
                    'model' => $credenciales['model'],
                    'messages' => $mensajesFallback,
                    'temperature' => $credenciales['temperature'],
                    'max_tokens' => ProveedorIAAdapter::presupuestoTokens($proveedor, (string) $credenciales['model'], (int) $credenciales['max_tokens']),
                ]);
                $response = $this->enviarConRespaldoGroq($cliente, $endpoint, $peticion, $proveedor, $credenciales, $usoRespaldoGroq);
            }

            $extraida = $response->successful() ? ProveedorIAAdapter::extraerRespuesta($response, $proveedor) : null;

            // Bucle acotado de Tool Calling (máximo MAX_RONDAS_TOOLS rondas / MAX_LLAMADAS_TOOLS ejecuciones)
            while ($response->successful() && ! empty($extraida['tool_calls']) && $rondaTools < self::MAX_RONDAS_TOOLS) {
                $iaService->registrarConsumoYCuota($user, $credenciales, $response);

                $cupoRestante = max(1, self::MAX_LLAMADAS_TOOLS - $totalLlamadasTools);
                $llamadasRonda = array_slice($extraida['tool_calls'], 0, $cupoRestante);
                $resultadosPorId = [];

                foreach ($llamadasRonda as $call) {
                    $nombreTool = (string) ($call['name'] ?? '');
                    $argsTool = is_array($call['arguments'] ?? null) ? $call['arguments'] : [];
                    $resultadoTool = $herramientasService->ejecutar(
                        $nombreTool,
                        $argsTool,
                        $user,
                        $curso,
                        $alcance,
                        $indiceCurso,
                        $privacidad
                    );
                    $this->registrarNumerosTokensExpuestos($resultadoTool, $numerosExpuestos);
                    $resultadosPorId[(string) $call['id']] = $resultadoTool;
                    $herramientasUsadas[] = HerramientasPedagogicasService::etiquetaPublica($nombreTool);
                    $totalLlamadasTools++;
                }

                $rondaTools++;
                ProveedorIAAdapter::agregarRondaHerramientas(
                    $proveedor,
                    $peticion,
                    $extraida['content'],
                    $llamadasRonda,
                    $resultadosPorId
                );

                // Al alcanzar el máximo de rondas o llamadas, quitar tools para forzar respuesta textual final
                if ($rondaTools >= self::MAX_RONDAS_TOOLS || $totalLlamadasTools >= self::MAX_LLAMADAS_TOOLS) {
                    ProveedorIAAdapter::desactivarHerramientasEnPeticion($peticion);
                }

                $response = $this->enviarConRespaldoGroq($cliente, $endpoint, $peticion, $proveedor, $credenciales, $usoRespaldoGroq);

                if (ProveedorIAAdapter::esErrorSoporteHerramientas($response)) {
                    ProveedorIAAdapter::desactivarHerramientasEnPeticion($peticion);
                    $response = $this->enviarConRespaldoGroq($cliente, $endpoint, $peticion, $proveedor, $credenciales, $usoRespaldoGroq);
                }

                $extraida = $response->successful() ? ProveedorIAAdapter::extraerRespuesta($response, $proveedor) : null;
            }

            // Si aún devolvió tool_calls tras agotar rondas, forzar un cierre textual sin herramientas
            if ($response->successful() && ! empty($extraida['tool_calls'])) {
                $iaService->registrarConsumoYCuota($user, $credenciales, $response);
                ProveedorIAAdapter::desactivarHerramientasEnPeticion($peticion);
                $response = $this->enviarConRespaldoGroq($cliente, $endpoint, $peticion, $proveedor, $credenciales, $usoRespaldoGroq);
                $extraida = $response->successful() ? ProveedorIAAdapter::extraerRespuesta($response, $proveedor) : null;
            }

            if ($response->successful() && ($extraida['finish_reason'] ?? null) === 'length') {
                $iaService->registrarConsumoYCuota($user, $credenciales, $response);
                $tokensRestantesHeader = $response->header('x-ratelimit-remaining-tokens');
                $tokensRestantes = ($tokensRestantesHeader !== '' && is_numeric($tokensRestantesHeader))
                    ? (int) $tokensRestantesHeader
                    : null;

                // Si Groq reporta pocos tokens restantes en este minuto, reintentar en el modelo de respaldo
                if ($proveedor === 'groq' && ! $usoRespaldoGroq && $tokensRestantes !== null && $tokensRestantes < 2500) {
                    $respaldo = ProveedorIAAdapter::modeloRespaldoGroq((string) $credenciales['model']);
                    if ($respaldo !== null) {
                        $usoRespaldoGroq = true;
                        $credenciales['model'] = $respaldo['model'];
                        $credenciales['modelo_nombre'] = $respaldo['nombre'];
                        $peticion['model'] = $respaldo['model'];
                    }
                }

                ProveedorIAAdapter::desactivarHerramientasEnPeticion($peticion);
                ProveedorIAAdapter::ampliarParaReintento(
                    $proveedor,
                    $peticion,
                    "\nResponde de nuevo de forma íntegra y concisa. Prioriza los puntos solicitados y omite detalles secundarios para terminar la respuesta."
                );
                $response = $this->enviarConRespaldoGroq($cliente, $endpoint, $peticion, $proveedor, $credenciales, $usoRespaldoGroq);
                $extraida = $response->successful() ? ProveedorIAAdapter::extraerRespuesta($response, $proveedor) : null;
            }

            // 6. Procesar respuesta y persistir en sesion_chats / mensaje_chats
            if ($response->successful()) {
                $iaService->registrarConsumoYCuota($user, $credenciales, $response);
                $respuestaAPI = $extraida['content'] ?? null;
                if (($extraida['finish_reason'] ?? null) === 'length' || ! is_string($respuestaAPI) || trim($respuestaAPI) === '') {
                    return response()->json(['respuesta' => 'El modelo no logró terminar la respuesta. Reintenta la consulta o pide una parte más específica.'], 502);
                }

                $textoRestaurado = $this->restaurarIdentidadesCurso($respuestaAPI, $mapa, $privacidad, $numerosExpuestos);
                $textoIA = $this->limpiarTablasMarkdown($textoRestaurado);

                $tituloSesion = $sesionActiva?->titulo ?: Str::limit(trim($request->mensaje), 46);
                $sesionActiva = DB::transaction(function () use ($sesionActiva, $user, $curso, $alcance, $tituloSesion, $credenciales, $validado, $textoIA) {
                    $sesion = $sesionActiva ?? SesionChat::create([
                        'user_id' => $user->id,
                        'curso_id' => $curso->id,
                        'alcance_academico' => $alcance['firma'],
                        'titulo' => $tituloSesion,
                        'estado' => 'ACTIVA',
                    ]);
                    $sesion->modelo_id = $credenciales['modelo_id'];
                    $sesion->expiraEn = now()->addDays(SesionChat::diasRetencion());
                    $sesion->touch();

                    MensajeChat::create([
                        'sesion_id' => $sesion->id,
                        'autor' => 'DOCENTE',
                        'contenido' => $validado['mensaje'],
                    ]);
                    MensajeChat::create([
                        'sesion_id' => $sesion->id,
                        'autor' => 'ASISTENTE_IA',
                        'contenido' => $textoIA,
                        'modelo_nombre' => $credenciales['modelo_nombre'],
                    ]);

                    return $sesion;
                });

                return response()->json([
                    'respuesta' => $textoIA,
                    'sesion_id' => $sesionActiva->id,
                    'titulo_sesion' => $tituloSesion,
                    'modelo' => $credenciales['model'],
                    'modelo_id' => $credenciales['modelo_id'],
                    'modelo_nombre' => $credenciales['modelo_nombre'],
                    'proveedor' => $credenciales['proveedor_nombre'],
                    'herramientas_usadas' => array_values(array_unique($herramientasUsadas)),
                ])->header('Cache-Control', 'no-store');
            }

            Log::warning(
                'El proveedor rechazó la consulta de chat.',
                ProveedorIAAdapter::metadatosErrorSeguro($response, $proveedor, (string) $credenciales['model']) + ['prompt_chars' => $totalCharsPayload]
            );

            return response()->json([
                'respuesta' => ProveedorIAAdapter::mensajeErrorSeguro($response, (string) ($credenciales['proveedor_nombre'] ?? 'IA'), (string) $credenciales['model']),
            ], $response->status() === 429 ? 429 : 502);

        } catch (ValidationException $e) {
            throw $e;
        } catch (ConnectionException) {
            Log::warning('No fue posible conectar con el proveedor de chat.');

            return response()->json(['respuesta' => 'No fue posible conectar con el proveedor de IA.'], 503);
        } catch (\Throwable $e) {
            Log::error('No se pudo procesar la consulta del chat.', ['tipo' => $e::class]);

            return response()->json(['respuesta' => 'No se pudo procesar la consulta. Intenta nuevamente.'], 500);
        }
    }

    private function alcanceAcademico(Curso $curso, int $userId): array
    {
        $asignaturas = Gate::allows('verCursoCompleto', $curso)
            ? null
            : $curso->asignaturas()->wherePivot('profesor_id', $userId)
                ->orderBy('asignatura_curso.id')->pluck('asignatura_curso.id')->all();
        $matriculas = Matricula::where('curso_id', $curso->id)->where('vigente', true)
            ->orderBy('id')->pluck('id')->all();

        return [
            'asignaturas' => $asignaturas,
            'firma' => hash('sha256', json_encode([$asignaturas, $matriculas], JSON_THROW_ON_ERROR)),
        ];
    }

    /**
     * Envía una petición al proveedor y, si Groq devuelve 429 temporal (TPM),
     * intenta una sola vez en el modelo de respaldo (bucket TPM separado).
     */
    private function enviarConRespaldoGroq(
        PendingRequest $cliente,
        string $endpoint,
        array &$peticion,
        string $proveedor,
        array &$credenciales,
        bool &$usoRespaldoGroq
    ): Response {
        $response = $cliente->post($endpoint, $peticion);

        if ($proveedor === 'groq' && ! $usoRespaldoGroq && ProveedorIAAdapter::esErrorLimiteTemporal($response)) {
            $respaldo = ProveedorIAAdapter::modeloRespaldoGroq((string) $credenciales['model']);
            if ($respaldo !== null) {
                $usoRespaldoGroq = true;
                $credenciales['model'] = $respaldo['model'];
                $credenciales['modelo_nombre'] = $respaldo['nombre'];
                $peticion['model'] = $respaldo['model'];

                if (in_array($respaldo['model'], ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'], true)) {
                    $peticion['reasoning_effort'] = $peticion['reasoning_effort'] ?? 'low';
                } else {
                    unset($peticion['reasoning_effort']);
                }

                $response = $cliente->post($endpoint, $peticion);
            }
        }

        return $response;
    }

    /**
     * Anonimiza también cualquier RUT escrito directamente por el docente antes de salir a la IA.
     */
    private function anonimizarRutsEnTexto(string $texto, iterable $estudiantes): string
    {
        $vistos = [];
        $contador = 0;

        foreach ($estudiantes as $estudiante) {
            $nombreCompleto = trim(($estudiante->nombres ?? '').' '.($estudiante->apellidos ?? ''));
            if ($nombreCompleto === '' || isset($vistos[$nombreCompleto])) {
                continue;
            }
            $vistos[$nombreCompleto] = true;
            $contador++;

            $rutReal = trim((string) ($estudiante->identificadorInterno ?? $estudiante->run ?? ''));
            if ($rutReal !== '' && mb_strlen($rutReal) >= 6) {
                $texto = str_ireplace($rutReal, "[RUT_{$contador}]", $texto);
            }
        }

        return $texto;
    }

    /**
     * Registra los índices de estudiantes ([ALUMNO_N], [ESTUDIANTE_N], [RUT_N]) que realmente
     * fueron expuestos al modelo en este turno (prompt, historial, fallback o resultados de tools).
     */
    private function registrarNumerosTokensExpuestos(string $texto, array &$numerosExpuestos): void
    {
        if ($texto === '') {
            return;
        }

        if (preg_match_all('/\[(?:ALUMNO|ESTUDIANTE|RUT)_(\d+)\]/', $texto, $matches)) {
            foreach ($matches[1] as $numStr) {
                $num = (int) $numStr;
                if ($num > 0) {
                    $numerosExpuestos[$num] = $num;
                }
            }
        }
    }

    /**
     * Restaura únicamente las identidades cuyos tokens fueron expuestos al modelo en esta consulta,
     * evitando que tokens inventados o frases genéricas ("Estudiante 1") se conviertan en alumnos reales.
     */
    private function restaurarIdentidadesCurso(
        string $texto,
        array $mapa,
        PrivacidadService $privacidad,
        array $numerosExpuestos
    ): string {
        $mapaPermitido = [];
        $numeros = [];

        foreach ($numerosExpuestos as $num) {
            $numInt = (int) $num;
            if ($numInt <= 0) {
                continue;
            }
            $numeros[$numInt] = $numInt;
            foreach (["[ALUMNO_{$numInt}]", "[ESTUDIANTE_{$numInt}]", "[RUT_{$numInt}]"] as $token) {
                if (isset($mapa[$token])) {
                    $mapaPermitido[$token] = $mapa[$token];
                }
            }
        }

        $restaurado = $privacidad->restaurar($texto, $mapaPermitido);

        // Ordenar números de mayor a menor (ej: 19 antes que 1) para evitar reemplazos parciales
        rsort($numeros);

        foreach ($numeros as $num) {
            $nombreReal = $mapaPermitido["[ALUMNO_{$num}]"] ?? $mapaPermitido["[ESTUDIANTE_{$num}]"] ?? null;
            if ($nombreReal) {
                $restaurado = preg_replace(
                    '/\[?\b(?:ALUMNO|ESTUDIANTE)[\s_]+'.$num.'\b\]?(?!\d)/iu',
                    $nombreReal,
                    $restaurado
                ) ?? $restaurado;
            }

            $rutReal = $mapaPermitido["[RUT_{$num}]"] ?? null;
            if ($rutReal) {
                $restaurado = preg_replace(
                    '/\[?\bRUT[\s_]+'.$num.'\b\]?(?!\d)/iu',
                    $rutReal,
                    $restaurado
                ) ?? $restaurado;
            }
        }

        // Neutralizar cualquier token con corchetes que el modelo haya inventado sin respaldo
        $restaurado = preg_replace('/\[(?:ALUMNO|ESTUDIANTE)_\d+\]/u', 'un estudiante del curso', $restaurado) ?? $restaurado;
        $restaurado = preg_replace('/\[RUT_\d+\]/u', 'RUT no consultado', $restaurado) ?? $restaurado;
        $restaurado = str_replace('[ALUMNO_SIN_ESPECIFICAR]', 'el estudiante (nombre compartido en el curso)', $restaurado);

        return $restaurado;
    }

    /**
     * Convierte cualquier tabla Markdown con barras "|" y etiquetas HTML "<br>" que el LLM
     * haya generado accidentalmente en bloques estructurados con subtítulos y viñetas limpias.
     */
    private function limpiarTablasMarkdown(string $texto): string
    {
        if (! str_contains($texto, '|') && ! stripos($texto, '<br')) {
            return $texto;
        }

        // Si el modelo colapsó varias filas de tabla en una sola línea separadas por "| |"
        $normalizado = preg_replace('/\|\s+\|/', "|\n|", $texto) ?? $texto;
        $lineas = explode("\n", $normalizado);
        $totalLineas = count($lineas);
        $resultado = [];
        $encabezadosTabla = [];
        $enTabla = false;

        $esFilaSeparadora = static function (string $trim): bool {
            return (bool) preg_match('/^\|?[\s\-:|]+\|[\s\-:|]+\|?$/', $trim) && str_contains($trim, '-');
        };

        $extraerCeldas = static function (string $trim): array {
            return array_values(array_filter(
                array_map('trim', explode('|', trim($trim, '|'))),
                fn ($c) => $c !== ''
            ));
        };

        $palabrasEncabezado = [
            'fase', 'etapa', 'criterio', 'indicador', 'aspecto', 'categoría', 'categoria',
            'dimensión', 'dimension', 'paso', 'semana', 'objetivo', 'asignatura', 'estudiante',
            'alumno', 'acción', 'accion', 'acciones', 'área', 'area', 'elemento', 'bloque',
        ];

        for ($i = 0; $i < $totalLineas; $i++) {
            $linea = $lineas[$i];
            $trim = trim($linea);

            if ($esFilaSeparadora($trim)) {
                $enTabla = true;

                continue;
            }

            if (substr_count($trim, '|') >= 2) {
                $celdas = $extraerCeldas($trim);

                if (count($celdas) >= 2) {
                    $siguienteTrim = ($i + 1 < $totalLineas) ? trim($lineas[$i + 1]) : '';
                    $seguidaPorSeparador = $esFilaSeparadora($siguienteTrim);
                    $limpiarEtiquetaHtml = static fn (string $c): string => preg_replace('/<\/?[a-z][^>]*>/iu', '', $c) ?? $c;
                    $primeraLower = mb_strtolower(trim($limpiarEtiquetaHtml($celdas[0]), '*_ '));

                    if (
                        $seguidaPorSeparador
                        || (! $enTabla && $encabezadosTabla === [] && in_array($primeraLower, $palabrasEncabezado, true))
                    ) {
                        $encabezadosTabla = array_map(
                            fn ($c) => trim($limpiarEtiquetaHtml($c), '*_ '),
                            $celdas
                        );
                        $enTabla = true;

                        continue;
                    }

                    $enTabla = true;
                    $tituloCelda = array_shift($celdas);
                    $tituloLimpio = trim($this->limpiarCeldaChat($tituloCelda), '* ');

                    if (count($celdas) === 1) {
                        $detalle = $this->formatearValorCelda($celdas[0], '  ');
                        if (str_contains($detalle, "\n")) {
                            $resultado[] = "- **{$tituloLimpio}:**\n{$detalle}";
                        } else {
                            $resultado[] = "- **{$tituloLimpio}:** {$detalle}";
                        }

                        continue;
                    }

                    // Tabla de 3 o más columnas: bloque estructurado con etiquetas de columna
                    $resultado[] = "### {$tituloLimpio}";
                    foreach ($celdas as $idxCol => $valorCelda) {
                        $etiquetaCol = $encabezadosTabla[$idxCol + 1] ?? null;
                        $detalle = $this->formatearValorCelda($valorCelda, '  ');

                        if ($etiquetaCol !== null && $etiquetaCol !== '') {
                            if (str_contains($detalle, "\n")) {
                                $resultado[] = "- **{$etiquetaCol}:**\n{$detalle}";
                            } else {
                                $resultado[] = "- **{$etiquetaCol}:** {$detalle}";
                            }
                        } else {
                            if (str_contains($detalle, "\n")) {
                                $resultado[] = $detalle;
                            } else {
                                $resultado[] = "- {$detalle}";
                            }
                        }
                    }
                    $resultado[] = '';

                    continue;
                }
            }

            $enTabla = false;
            $encabezadosTabla = [];
            $resultado[] = $this->limpiarBrFueraDeTabla($linea);
        }

        $salida = implode("\n", $resultado);

        return preg_replace("/\n{3,}/", "\n\n", trim($salida)) ?? trim($salida);
    }

    /**
     * Limpia etiquetas <br> y viñetas inline "•" dentro de una celda de tabla,
     * devolviendo texto limpio o una sub-lista Markdown indentada si hay varios puntos.
     */
    private function formatearValorCelda(string $valor, string $indent = '  '): string
    {
        $normalizado = preg_replace('/<br\s*\/?>/iu', "\n", $valor) ?? $valor;
        if (substr_count($normalizado, '•') >= 2 && ! str_contains($normalizado, "\n")) {
            $normalizado = str_replace('•', "\n•", $normalizado);
        }

        $partes = array_values(array_filter(
            array_map(
                fn ($p) => trim(preg_replace('/^(?:[•\-]\s+|\*\s+|•)/u', '', trim($p)) ?? trim($p)),
                explode("\n", $normalizado)
            ),
            fn ($p) => $p !== ''
        ));

        if (count($partes) <= 1) {
            return $partes[0] ?? $this->limpiarCeldaChat($valor);
        }

        return implode("\n", array_map(fn ($p) => "{$indent}- {$p}", $partes));
    }

    private function limpiarCeldaChat(string $texto): string
    {
        $sinBr = preg_replace('/<br\s*\/?>/iu', ' ', $texto) ?? $texto;

        return trim(preg_replace('/^[•]\s*/u', '', trim($sinBr)) ?? trim($sinBr));
    }

    private function limpiarBrFueraDeTabla(string $linea): string
    {
        if (! stripos($linea, '<br')) {
            return $linea;
        }

        $partes = preg_split('/<br\s*\/?>/iu', $linea) ?: [$linea];
        $limpias = [];
        foreach ($partes as $idx => $parte) {
            $p = trim($parte);
            if ($p === '') {
                continue;
            }
            $p = preg_replace('/^[•]\s*/u', '', $p) ?? $p;
            $limpias[] = $idx === 0 ? $p : "  - {$p}";
        }

        return implode("\n", $limpias);
    }
}
