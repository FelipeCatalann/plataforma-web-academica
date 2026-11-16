<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Models\Matricula;
use App\Models\MensajeChat;
use App\Models\SesionChat;
use App\Services\ConexionIA;
use App\Services\ConfiguracionIAService;
use App\Services\PrivacidadService;
use App\Services\RendimientoAcademico;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ChatbotController extends Controller
{
    private const INSTRUCCIONES_PLAN_APOYO = <<<'PROMPT'
        Divide el plan en tres secciones breves tituladas Situación actual, Acciones de apoyo y Revisión del avance.
        Basa la situación individual en las notas del estudiante, nunca en el promedio de una asignatura del curso.
        Distingue las notas parciales de los promedios. Si no hay promedios bajo 4,0, plantea seguimiento preventivo sin etiquetar al estudiante en riesgo. Si faltan datos, indica qué debe revisar el docente.
        Propón dos o tres acciones realistas. Para cada una indica quién la realiza, cuándo aplicarla y qué evidencia revisar. Las acciones y plazos son sugerencias, no acuerdos ya tomados.
        Usa una evidencia observable para revisar el avance, como comparar dos ejercicios similares. No fijes una meta de nota si el docente no la pidió. No supongas contenidos, causas, asistencia ni antecedentes familiares.
        Si piden una pauta con el apoderado, agrega dos preguntas breves al final. Menciona al estudiante con su token una sola vez y omite su RUT salvo solicitud explícita.
        PROMPT;

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
                    'content' => $m->autor === 'DOCENTE'
                        ? $m->contenido
                        : $this->formatearRespuestaAsistente($m->contenido),
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
            ['texto' => $mensajeSeguro, 'mapa' => $mapa] = $privacidad->anonimizar(
                $request->mensaje, $curso->estudiantes
            );

            $mensajeSeguro = $this->anonimizarRutsEnTexto($mensajeSeguro, $curso->estudiantes);
            $esPlanApoyo = preg_match(
                '/\bplan(?:es)?\s+(?:de\s+)?(?:apo(?:y|ll)o|accion|acompanamiento|refuerzo|intervencion|mejora)\b/i',
                Str::ascii($mensajeSeguro)
            ) === 1;
            $alumnosDelPlan = $esPlanApoyo ? array_keys($mapa) : [];
            $contextoAcademico = $this->construirContextoAcademicoReal($curso, $mapa, $alumnosDelPlan);

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
                ? 'IMPORTANTE: No uses tablas, ni barras "|", ni negritas, ni formato Markdown. Escribe solo en texto plano usando saltos de línea y guiones simples para las listas.'
                : 'Usa formato Markdown editorial limpio (subtítulos ### solo cuando ayuden a organizar secciones, negritas para conceptos clave y listas con viñetas o numeradas bien redactadas). No uses tablas con barras verticales ("|" o "|---|---|").';
            $reglaFormato .= ' Separa las ideas con saltos de línea reales. No uses etiquetas HTML como <br>, ni sus variantes escapadas.';

            $reglaDatosReales = 'Usa exclusivamente las cifras reales del curso entregadas en el contexto. PROHIBIDO inventar ejemplos hipotéticos, estimaciones o frases como "Resultado esperado (ejemplo)".';

            $reglaIdentidad = 'REGLA DE NOMBRES Y RUT: En el contexto cada alumno está representado con su token [ALUMNO_X] y su RUT con [RUT_X]. El sistema reemplaza automáticamente [ALUMNO_X] y [RUT_X] por el nombre real y el RUT real en la pantalla del profesor. Cuando menciones a un estudiante o te pidan su nombre o RUT, escribe SIEMPRE el token exacto entre corchetes (por ejemplo: [ALUMNO_19] y [RUT_19]). NUNCA escribas "Estudiante 19" ni "Alumno 19" sin corchetes, y NUNCA digas que no puedes entregar nombres o RUT por privacidad.';

            $instrucciones = $privacidad->anonimizar($credenciales['instrucciones_personalizadas'], $curso->estudiantes)['texto'];
            $instrucciones = $this->anonimizarRutsEnTexto($instrucciones, $curso->estudiantes);
            $extraInstrucciones = $instrucciones !== ''
                ? " Instrucción adicional del docente: {$instrucciones}."
                : '';

            $rol = $alcance['asignaturas'] !== null
                ? 'Profesor de Asignatura'
                : ($user->hasRole('Administrador') ? 'Administrador' : 'Profesor Jefe');
            $limiteAsignaturas = $alcance['asignaturas'] !== null
                ? ' Los promedios incluyen solo las asignaturas impartidas por este docente.'
                : '';
            $promptSistema = "Eres un asistente pedagógico experto y empático. Estás hablando con un {$rol} de Chile. El docente te consulta sobre este curso:{$limiteAsignaturas}\n{$contextoAcademico}\nDa diagnósticos claros basados en los datos reales del curso, sugerencias pedagógicas prácticas, pautas de evaluación y dinámicas según el Decreto 67. {$reglaDatosReales} {$reglaIdentidad} {$credenciales['instruccion_tono']} {$credenciales['instruccion_extension']} {$reglaFormato}{$extraInstrucciones}";
            if ($esPlanApoyo) {
                $promptSistema .= "\n".self::INSTRUCCIONES_PLAN_APOYO;
            }

            // 4. API Key (del modelo personalizado encriptado o GROQ_API_KEY por defecto)
            $apiKey = $credenciales['api_key'];

            if (empty($apiKey)) {
                return response()->json(['respuesta' => 'Configura una clave de IA para continuar.'], 422);
            }

            // Construir mensajes incluyendo contexto previo de la sesión si existe (siempre anonimizado)
            $mensajesPayload = [
                ['role' => 'system', 'content' => $promptSistema],
            ];

            if ($sesionActiva) {
                $previos = $sesionActiva->mensajes()->reorder('created_at', 'desc')->limit(6)->get()->reverse();
                foreach ($previos as $prev) {
                    $esMensajeDocente = $prev->autor === 'DOCENTE';
                    $contenido = $esMensajeDocente ? $prev->contenido : $this->formatearRespuestaAsistente($prev->contenido);
                    $anonPrev = $privacidad->anonimizar($contenido, $curso->estudiantes);
                    $textoPrevSeguro = $this->anonimizarRutsEnTexto($anonPrev['texto'], $curso->estudiantes);
                    $mensajesPayload[] = [
                        'role' => $esMensajeDocente ? 'user' : 'assistant',
                        'content' => $textoPrevSeguro,
                    ];
                }
            }

            $mensajesPayload[] = ['role' => 'user', 'content' => $mensajeSeguro];
            foreach ($mensajesPayload as &$mensaje) {
                $mensaje['content'] = $privacidad->ocultarContactos($mensaje['content']);
            }
            unset($mensaje);

            if (array_sum(array_map(fn ($mensaje) => mb_strlen($mensaje['content']), $mensajesPayload)) > 32000) {
                return response()->json(['respuesta' => 'El contexto es demasiado extenso. Inicia un chat nuevo.'], 422);
            }

            // 5. Petición al proveedor OpenAI-compatible (Groq por defecto)
            $response = ConexionIA::cliente($credenciales['base_url'], $credenciales['headers'], 30)
                ->post('chat/completions', [
                    'model' => $credenciales['model'],
                    'messages' => $mensajesPayload,
                    'temperature' => $credenciales['temperature'],
                    'max_tokens' => $credenciales['max_tokens'],
                ]);

            // 6. Procesar respuesta y persistir en sesion_chats / mensaje_chats
            if ($response->successful()) {
                $iaService->registrarConsumoYCuota($user, $credenciales, $response);
                $respuestaAPI = $response->json('choices.0.message.content') ?? '';
                $textoRestaurado = $this->restaurarIdentidadesCurso($respuestaAPI, $mapa, $privacidad);
                $textoIA = $this->formatearRespuestaAsistente($textoRestaurado);

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
                ])->header('Cache-Control', 'no-store');
            }

            Log::warning('El proveedor rechazó la consulta de chat.', ['estado_http' => $response->status()]);

            return response()->json([
                'respuesta' => 'El proveedor de IA no pudo responder. Intenta nuevamente.',
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
     * Construye el resumen estadístico real del curso y tokeniza alumnos en riesgo
     * para que la IA entregue cifras exactas sin conocer nombres reales (INDG-27).
     */
    private function construirContextoAcademicoReal(Curso $curso, array &$mapa, array $alumnosDelPlan): string
    {
        $totalAlumnos = $curso->estudiantes->count();
        $notasCurso = [];
        $notasPorAsignaturaCurso = [];

        $alumnosPromedioBajo4 = 0;
        $alumnosAsignaturaPromedioBajo4 = 0;
        $alumnosConNotaIndividualBajo4 = 0;
        $alumnosAmbosCriterios = 0;

        $nominaTokenizada = [];
        $detalleAlumnosRiesgo = [];
        $evidenciaIndividual = [];
        $vistos = [];
        $contador = 0;

        foreach ($curso->estudiantes as $estudiante) {
            $nombreCompleto = trim(($estudiante->nombres ?? '').' '.($estudiante->apellidos ?? ''));
            if ($nombreCompleto === '' || isset($vistos[$nombreCompleto])) {
                continue;
            }
            $vistos[$nombreCompleto] = true;
            $contador++;

            $tokenAlumno = "[ALUMNO_{$contador}]";
            $tokenEstudianteAlt = "[ESTUDIANTE_{$contador}]";
            $tokenRut = "[RUT_{$contador}]";
            $rutReal = trim((string) ($estudiante->identificadorInterno ?? $estudiante->run ?? 'Sin RUT'));
            if ($rutReal === '') {
                $rutReal = 'Sin RUT';
            }

            // Registrar siempre en el mapa en memoria para restaurar al volver de la IA
            $mapa[$tokenAlumno] = $nombreCompleto;
            $mapa[$tokenEstudianteAlt] = $nombreCompleto;
            $mapa[$tokenRut] = $rutReal;

            $rendimiento = RendimientoAcademico::resumir($estudiante->calificaciones);
            $valoresAlumno = $rendimiento['notas'];
            $promedioGeneral = $rendimiento['promedio'];
            array_push($notasCurso, ...$valoresAlumno);

            $asignaturasRojas = [];
            foreach ($rendimiento['asignaturas'] as $asignatura) {
                $asig = $asignatura['asignatura'];
                $notasPorAsignaturaCurso[$asig]['notas'] ??= [];
                array_push($notasPorAsignaturaCurso[$asig]['notas'], ...array_column($asignatura['notas'], 'valor'));
            }
            foreach ($rendimiento['alertas'] as $asignatura) {
                $asig = $asignatura['asignatura'];
                $asignaturasRojas[] = "{$asig} ({$asignatura['promedio']})";
                $notasPorAsignaturaCurso[$asig]['alumnos_bajo_4'] = ($notasPorAsignaturaCurso[$asig]['alumnos_bajo_4'] ?? 0) + 1;
            }

            $tienePromedioRojo = $promedioGeneral !== null && $promedioGeneral < 4.0;
            $tieneAsignaturaRoja = count($asignaturasRojas) > 0;
            $tieneNotaSueltaRoja = count(array_filter($valoresAlumno, fn ($v) => $v < 4.0)) > 0;

            if ($tienePromedioRojo) {
                $alumnosPromedioBajo4++;
            }
            if ($tieneAsignaturaRoja) {
                $alumnosAsignaturaPromedioBajo4++;
            }
            if ($tieneNotaSueltaRoja) {
                $alumnosConNotaIndividualBajo4++;
            }
            if ($tienePromedioRojo && $tieneAsignaturaRoja) {
                $alumnosAmbosCriterios++;
            }

            $textoProm = $promedioGeneral ?? 'S/I';
            $textoRojas = count($asignaturasRojas) > 0
                ? 'asignaturas bajo 4.0: '.implode(', ', $asignaturasRojas)
                : 'sin asignaturas bajo 4.0';

            $nominaTokenizada[] = "{$tokenAlumno} (RUT: {$tokenRut}, Promedio: {$textoProm}, {$textoRojas})";

            if (in_array($tokenAlumno, $alumnosDelPlan, true)) {
                $asignaturasAlumno = collect($rendimiento['asignaturas'])->map(
                    fn ($asignatura) => "{$asignatura['asignatura']} (promedio {$asignatura['promedio']}, ".count($asignatura['notas']).' calificaciones)'
                )->implode('; ');
                $evidenciaIndividual[] = $tokenAlumno.': '.($asignaturasAlumno ?: 'sin calificaciones numéricas en el alcance del docente');
            }

            if ($tienePromedioRojo || $tieneAsignaturaRoja) {
                $detalleAlumnosRiesgo[] = [
                    'promedio' => $promedioGeneral ?? 7.0,
                    'resumen' => "{$tokenAlumno} (RUT: {$tokenRut}): promedio general {$textoProm}".(
                        count($asignaturasRojas) > 0
                            ? ', asignaturas bajo 4.0: '.implode(', ', $asignaturasRojas)
                            : ''
                    ),
                ];
            }
        }

        usort($detalleAlumnosRiesgo, fn ($a, $b) => $a['promedio'] <=> $b['promedio']);
        $topRiesgo = array_column($detalleAlumnosRiesgo, 'resumen');

        $promedioCurso = RendimientoAcademico::promedio($notasCurso) ?? 'Sin calificaciones';

        $pctPromedioBajo4 = $totalAlumnos > 0 ? round(($alumnosPromedioBajo4 / $totalAlumnos) * 100) : 0;
        $pctAsignaturaBajo4 = $totalAlumnos > 0 ? round(($alumnosAsignaturaPromedioBajo4 / $totalAlumnos) * 100) : 0;
        $pctNotaIndividualBajo4 = $totalAlumnos > 0 ? round(($alumnosConNotaIndividualBajo4 / $totalAlumnos) * 100) : 0;

        $resumenAsignaturas = [];
        foreach ($notasPorAsignaturaCurso as $asig => $datos) {
            $notas = $datos['notas'] ?? [];
            if (count($notas) === 0) {
                continue;
            }
            $prom = RendimientoAcademico::promedio($notas);
            $bajo4 = $datos['alumnos_bajo_4'] ?? 0;
            $resumenAsignaturas[] = [
                'promedio' => $prom,
                'texto' => "{$asig}: promedio {$prom} ({$bajo4} estudiantes con promedio bajo 4.0)",
            ];
        }
        usort($resumenAsignaturas, fn ($a, $b) => $a['promedio'] <=> $b['promedio']);
        $textoAsignaturas = implode('; ', array_column($resumenAsignaturas, 'texto'));

        $lineas = [
            "- Curso: {$curso->nivel}° Medio {$curso->letra} ({$totalAlumnos} estudiantes matriculados).",
            "- Promedio general del curso: {$promedioCurso}.",
            "- Estudiantes con promedio general menor a 4.0: {$alumnosPromedioBajo4} de {$totalAlumnos} ({$pctPromedioBajo4}% del curso).",
            "- Estudiantes con al menos una asignatura con promedio menor a 4.0: {$alumnosAsignaturaPromedioBajo4} de {$totalAlumnos} ({$pctAsignaturaBajo4}% del curso).",
            "- Estudiantes con alguna calificación parcial menor a 4.0: {$alumnosConNotaIndividualBajo4} de {$totalAlumnos} ({$pctNotaIndividualBajo4}% del curso).",
            "- Estudiantes que coinciden en ambos criterios (promedio general < 4.0 y asignatura < 4.0): {$alumnosAmbosCriterios} estudiantes.",
        ];

        if ($textoAsignaturas !== '') {
            $lineas[] = "- Rendimiento real por asignatura (de menor a mayor promedio): {$textoAsignaturas}.";
        }

        if (count($topRiesgo) > 0) {
            $lineas[] = '- Casos reales prioritarios del curso: '.implode(' | ', $topRiesgo).'.';
        }

        if (count($nominaTokenizada) > 0) {
            $lineas[] = '- Nómina completa del curso (usa siempre [ALUMNO_X] y [RUT_X] para que el profesor vea el nombre y RUT real): '.implode(' | ', $nominaTokenizada).'.';
        }

        if ($evidenciaIndividual !== []) {
            $lineas[] = "- Rendimiento individual por asignatura de los estudiantes mencionados en el plan:\n".implode("\n", $evidenciaIndividual);
        }

        return implode("\n", $lineas);
    }

    private function formatearRespuestaAsistente(string $texto): string
    {
        $texto = $this->limpiarTablasMarkdown($texto);

        return preg_replace('~[ \t]*\\\\?(?:<br[ \t]*/?>|&lt;br[ \t]*/?&gt;)[ \t]*~i', "  \n", $texto) ?? $texto;
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
     * Restaura tanto los tokens exactos ([ALUMNO_19], [RUT_19]) como variantes sin corchetes
     * que el modelo pueda haber escrito ("Estudiante 19", "Alumno 19", "RUT 19").
     */
    private function restaurarIdentidadesCurso(string $texto, array $mapa, PrivacidadService $privacidad): string
    {
        $restaurado = $privacidad->restaurar($texto, $mapa);

        // Ordenar números de mayor a menor (ej: 19 antes que 1) para evitar reemplazos parciales
        $numeros = [];
        foreach (array_keys($mapa) as $token) {
            if (preg_match('/^\[(?:ALUMNO|ESTUDIANTE|RUT)_(\d+)\]$/', $token, $m)) {
                $numeros[(int) $m[1]] = (int) $m[1];
            }
        }
        rsort($numeros);

        foreach ($numeros as $num) {
            $nombreReal = $mapa["[ALUMNO_{$num}]"] ?? $mapa["[ESTUDIANTE_{$num}]"] ?? null;
            if ($nombreReal) {
                $restaurado = preg_replace(
                    '/\[?\b(?:ALUMNO|ESTUDIANTE)[\s_]+'.$num.'\b\]?(?!\d)/iu',
                    $nombreReal,
                    $restaurado
                ) ?? $restaurado;
            }

            $rutReal = $mapa["[RUT_{$num}]"] ?? null;
            if ($rutReal) {
                $restaurado = preg_replace(
                    '/\[?\bRUT[\s_]+'.$num.'\b\]?(?!\d)/iu',
                    $rutReal,
                    $restaurado
                ) ?? $restaurado;
            }
        }

        return $restaurado;
    }

    /**
     * Convierte cualquier tabla Markdown con barras "|" que el LLM haya generado
     * accidentalmente en listas limpias con viñetas, eliminando filas "|---|---|".
     */
    private function limpiarTablasMarkdown(string $texto): string
    {
        if (! str_contains($texto, '|')) {
            return $texto;
        }

        // Si el modelo colapsó varias filas de tabla en una sola línea separadas por "| |"
        $normalizado = preg_replace('/\|\s+\|/', "|\n|", $texto) ?? $texto;
        $lineas = explode("\n", $normalizado);
        $resultado = [];
        $encabezadosTabla = [];

        foreach ($lineas as $linea) {
            $trim = trim($linea);

            // Omitir filas separadoras de tablas Markdown (ej: |---|---| o |:---:|---:|)
            if (preg_match('/^\|?[\s\-:|]+\|[\s\-:|]+\|?$/', $trim) && str_contains($trim, '-')) {
                continue;
            }

            // Detectar fila de tabla con al menos 2 separadores "|"
            if (substr_count($trim, '|') >= 2) {
                $celdas = array_values(array_filter(
                    array_map('trim', explode('|', trim($trim, '|'))),
                    fn ($c) => $c !== ''
                ));

                if (count($celdas) >= 2) {
                    // Detectar si es fila de encabezado genérico de tabla
                    $primeraLower = mb_strtolower(strip_tags($celdas[0]));
                    if (
                        $encabezadosTabla === []
                        && in_array($primeraLower, ['criterio', 'indicador', 'aspecto', 'categoría', 'categoria', 'dimensión', 'dimension'], true)
                    ) {
                        $encabezadosTabla = $celdas;

                        continue;
                    }

                    $tituloCelda = array_shift($celdas);
                    $tituloLimpio = trim($tituloCelda, '* ');
                    $resto = implode(' — ', $celdas);
                    $resultado[] = "- **{$tituloLimpio}:** {$resto}";

                    continue;
                }
            }

            $encabezadosTabla = [];
            $resultado[] = $linea;
        }

        return implode("\n", $resultado);
    }
}
