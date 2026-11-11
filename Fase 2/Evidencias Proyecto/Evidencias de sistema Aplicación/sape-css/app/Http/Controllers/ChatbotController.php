<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Models\MensajeChat;
use App\Models\SesionChat;
use App\Services\ConfiguracionIAService;
use App\Services\PrivacidadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ChatbotController extends Controller
{
    public function listarSesiones(Request $request, ConfiguracionIAService $iaService): JsonResponse
    {
        $user = $request->user();
        $cursoId = (string) $request->query('curso_id', '');
        $configIA = $iaService->obtenerConfiguracionPublica($user);

        $sesionesFormateadas = [];

        try {
            $tieneColumnaCurso = Schema::hasColumn('sesion_chats', 'curso_id');
            $tieneColumnaTitulo = Schema::hasColumn('sesion_chats', 'titulo');
            $tieneColumnaModeloMsg = Schema::hasColumn('mensaje_chats', 'modelo_nombre');

            $query = SesionChat::with('mensajes')
                ->where('user_id', $user->id)
                ->orderByDesc('updated_at');

            if ($tieneColumnaCurso && $cursoId !== '') {
                $query->where(function ($q) use ($cursoId) {
                    $q->where('curso_id', $cursoId)->orWhereNull('curso_id');
                });
            }

            $sesiones = $query->limit(25)->get();

            foreach ($sesiones as $sesion) {
                $mensajes = $sesion->mensajes->map(fn ($m) => [
                    'id' => $m->id,
                    'role' => $m->autor === 'DOCENTE' ? 'user' : 'ai',
                    'content' => $m->contenido,
                    'modeloNombre' => $tieneColumnaModeloMsg ? ($m->modelo_nombre ?? null) : null,
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
                    'titulo' => ($tieneColumnaTitulo && ! empty($sesion->titulo))
                        ? $sesion->titulo
                        : $tituloFallback,
                    'curso_id' => $tieneColumnaCurso ? $sesion->curso_id : $cursoId,
                    'modelo_id' => $sesion->modelo_id ?? null,
                    'actualizadaEn' => $sesion->updated_at?->toIso8601String(),
                    'mensajes' => $mensajes,
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('No se pudieron cargar sesiones de chat: '.$e->getMessage());
        }

        return response()->json([
            'sesiones' => $sesionesFormateadas,
            'configuracionIA' => $configIA,
        ]);
    }

    public function eliminarSesion(Request $request, string $sesionId): JsonResponse
    {
        $user = $request->user();

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

        $request->validate([
            'mensaje' => 'required|string',
            'curso_id' => 'required',
            'tipo_profesor' => 'required|string',
            'sesion_id' => 'nullable|string|max:64',
            'modelo_id' => 'nullable|string|max:120',
            'tono_ia' => 'nullable|string|in:formal_decreto67,cercano_familia,ejecutivo_breve',
            'extension_ia' => 'nullable|string|in:breve,equilibrada,detallada',
            'precision_ia' => 'nullable|string|in:estricto,balanceado,dinamico',
            'formato_visual_ia' => 'nullable|string|in:markdown,texto_plano',
            'instrucciones_ia' => 'nullable|string|max:350',
        ]);

        try {
            $user = $request->user();

            // 2. Obtener contexto real y desglosado del curso (sin exponer nombres reales a la IA)
            $cursoId = (string) $request->curso_id;
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

            // INDG-27: anonimizar el mensaje antes de enviarlo a la IA.
            $privacidad = app(PrivacidadService::class);
            ['texto' => $mensajeSeguro, 'mapa' => $mapa] = $privacidad->anonimizar(
                $request->mensaje, $curso->estudiantes
            );

            $contextoAcademico = $this->construirContextoAcademicoReal($curso, $mapa);
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
                ? 'IMPORTANTE: No uses tablas, ni barras "|", ni negritas, ni formato Markdown. Escribe solo en texto plano usando saltos de línea y guiones simples para las listas.'
                : 'Usa formato Markdown editorial limpio (subtítulos ### solo cuando ayuden a organizar secciones, negritas para conceptos clave y listas con viñetas o numeradas bien redactadas). No uses tablas con barras verticales ("|" o "|---|---|").';

            $reglaDatosReales = 'Usa exclusivamente las cifras reales del curso entregadas en el contexto. PROHIBIDO inventar ejemplos hipotéticos, estimaciones o frases como "Resultado esperado (ejemplo)".';

            $reglaIdentidad = 'REGLA DE NOMBRES Y RUT: En el contexto cada alumno está representado con su token [ALUMNO_X] y su RUT con [RUT_X]. El sistema reemplaza automáticamente [ALUMNO_X] y [RUT_X] por el nombre real y el RUT real en la pantalla del profesor. Cuando menciones a un estudiante o te pidan su nombre o RUT, escribe SIEMPRE el token exacto entre corchetes (por ejemplo: [ALUMNO_19] y [RUT_19]). NUNCA escribas "Estudiante 19" ni "Alumno 19" sin corchetes, y NUNCA digas que no puedes entregar nombres o RUT por privacidad.';

            $extraInstrucciones = $credenciales['instrucciones_personalizadas'] !== ''
                ? " Instrucción adicional del docente: {$credenciales['instrucciones_personalizadas']}."
                : '';

            $promptSistema = "Eres un asistente pedagógico experto y empático. Estás hablando con un {$request->tipo_profesor} de Chile. El profesor te consulta sobre este curso:\n{$contextoAcademico}\nDa diagnósticos claros basados en los datos reales del curso, sugerencias pedagógicas prácticas, pautas de evaluación y dinámicas según el Decreto 67. {$reglaDatosReales} {$reglaIdentidad} {$credenciales['instruccion_tono']} {$credenciales['instruccion_extension']} {$reglaFormato}{$extraInstrucciones}";

            // 4. API Key (del modelo personalizado encriptado o GROQ_API_KEY por defecto)
            $apiKey = $credenciales['api_key'];

            if (empty($apiKey)) {
                throw new \Exception('La API Key del proveedor de IA no está configurada.');
            }

            // Construir mensajes incluyendo contexto previo de la sesión si existe (siempre anonimizado)
            $mensajesPayload = [
                ['role' => 'system', 'content' => $promptSistema],
            ];

            $sesionActiva = null;
            $sesionIdInput = $request->input('sesion_id');
            if ($user && $sesionIdInput) {
                try {
                    $sesionActiva = SesionChat::with('mensajes')
                        ->where('id', $sesionIdInput)
                        ->where('user_id', $user->id)
                        ->first();

                    if ($sesionActiva) {
                        $previos = $sesionActiva->mensajes->slice(-6);
                        foreach ($previos as $prev) {
                            $anonPrev = $privacidad->anonimizar($prev->contenido, $curso->estudiantes);
                            $textoPrevSeguro = $this->anonimizarRutsEnTexto($anonPrev['texto'], $curso->estudiantes);
                            $mensajesPayload[] = [
                                'role' => $prev->autor === 'DOCENTE' ? 'user' : 'assistant',
                                'content' => $textoPrevSeguro,
                            ];
                        }
                    }
                } catch (\Throwable) {
                    $sesionActiva = null;
                }
            }

            $mensajesPayload[] = ['role' => 'user', 'content' => $mensajeSeguro];

            // 5. Petición al proveedor OpenAI-compatible (Groq por defecto)
            $response = Http::withoutVerifying()
                ->timeout(30)
                ->withHeaders($credenciales['headers'])
                ->post($credenciales['chat_url'], [
                    'model' => $credenciales['model'],
                    'messages' => $mensajesPayload,
                    'temperature' => $credenciales['temperature'],
                ]);

            // 6. Procesar respuesta y persistir en sesion_chats / mensaje_chats
            if ($response->successful()) {
                $iaService->registrarConsumoYCuota($user, $credenciales, $response);
                $respuestaAPI = $response->json('choices.0.message.content') ?? '';
                $textoRestaurado = $this->restaurarIdentidadesCurso($respuestaAPI, $mapa, $privacidad);
                $textoIA = $this->limpiarTablasMarkdown($textoRestaurado);

                $sesionIdDevuelto = $sesionIdInput;
                $tituloSesion = Str::limit(trim($request->mensaje), 46);

                if ($user) {
                    try {
                        $tieneColumnaTitulo = Schema::hasColumn('sesion_chats', 'titulo');
                        $tieneColumnaCurso = Schema::hasColumn('sesion_chats', 'curso_id');
                        $tieneColumnaModelo = Schema::hasColumn('sesion_chats', 'modelo_id');
                        $tieneColumnaModeloMsg = Schema::hasColumn('mensaje_chats', 'modelo_nombre');

                        if (! $sesionActiva) {
                            $datosSesion = [
                                'user_id' => $user->id,
                                'estado' => 'ACTIVA',
                            ];
                            if ($tieneColumnaTitulo) {
                                $datosSesion['titulo'] = $tituloSesion;
                            }
                            if ($tieneColumnaCurso) {
                                $datosSesion['curso_id'] = (string) $curso->id;
                            }
                            if ($tieneColumnaModelo) {
                                $datosSesion['modelo_id'] = $credenciales['modelo_id'];
                            }
                            $sesionActiva = SesionChat::create($datosSesion);
                        } else {
                            if ($tieneColumnaModelo) {
                                $sesionActiva->modelo_id = $credenciales['modelo_id'];
                            }
                            $sesionActiva->touch();
                            $sesionActiva->save();
                            if ($tieneColumnaTitulo && ! empty($sesionActiva->titulo)) {
                                $tituloSesion = $sesionActiva->titulo;
                            }
                        }

                        $sesionIdDevuelto = $sesionActiva->id;

                        MensajeChat::create([
                            'sesion_id' => $sesionActiva->id,
                            'autor' => 'DOCENTE',
                            'contenido' => $request->mensaje,
                        ]);

                        $datosMensajeIA = [
                            'sesion_id' => $sesionActiva->id,
                            'autor' => 'ASISTENTE_IA',
                            'contenido' => $textoIA,
                        ];
                        if ($tieneColumnaModeloMsg) {
                            $datosMensajeIA['modelo_nombre'] = $credenciales['modelo_nombre'];
                        }
                        MensajeChat::create($datosMensajeIA);
                    } catch (\Throwable $e) {
                        Log::warning('No se pudo guardar el historial de chat: '.$e->getMessage());
                    }
                }

                return response()->json([
                    'respuesta' => $textoIA,
                    'sesion_id' => $sesionIdDevuelto,
                    'titulo_sesion' => $tituloSesion,
                    'modelo' => $credenciales['model'],
                    'modelo_id' => $credenciales['modelo_id'],
                    'modelo_nombre' => $credenciales['modelo_nombre'],
                    'proveedor' => $credenciales['proveedor_nombre'],
                ]);
            }

            $detalleError = $response->json('error.message') ?? $response->body();
            Log::error('Error IA Chat: '.$detalleError);

            return response()->json([
                'respuesta' => "🚨 Error del proveedor de IA ({$response->status()}):\n\n".$detalleError,
            ], 400);

        } catch (\Exception $e) {
            return response()->json(['respuesta' => 'Error de Laravel: '.$e->getMessage()], 500);
        }
    }

    /**
     * Construye el resumen estadístico real del curso y tokeniza alumnos en riesgo
     * para que la IA entregue cifras exactas sin conocer nombres reales (INDG-27).
     */
    private function construirContextoAcademicoReal(Curso $curso, array &$mapa): string
    {
        $totalAlumnos = $curso->estudiantes->count();
        $promediosGeneralesCurso = [];
        $notasPorAsignaturaCurso = [];

        $alumnosPromedioBajo4 = 0;
        $alumnosAsignaturaPromedioBajo4 = 0;
        $alumnosConNotaIndividualBajo4 = 0;
        $alumnosAmbosCriterios = 0;

        $nominaTokenizada = [];
        $detalleAlumnosRiesgo = [];
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

            $valoresAlumno = [];
            $porAsignatura = [];

            foreach ($estudiante->calificaciones as $nota) {
                if (! is_numeric($nota->valor)) {
                    continue;
                }
                $val = (float) $nota->valor;
                $valoresAlumno[] = $val;

                $asigNombre = trim((string) ($nota->asignatura_nombre ?? 'General'));
                if ($asigNombre === '') {
                    $asigNombre = 'General';
                }
                $porAsignatura[$asigNombre][] = $val;
                $notasPorAsignaturaCurso[$asigNombre]['notas'][] = $val;
            }

            $promedioGeneral = count($valoresAlumno) > 0
                ? round(array_sum($valoresAlumno) / count($valoresAlumno), 1)
                : null;

            if ($promedioGeneral !== null) {
                $promediosGeneralesCurso[] = $promedioGeneral;
            }

            $asignaturasRojas = [];
            foreach ($porAsignatura as $asig => $listaNotas) {
                $promAsig = round(array_sum($listaNotas) / count($listaNotas), 1);
                if ($promAsig < 4.0) {
                    $asignaturasRojas[] = "{$asig} ({$promAsig})";
                    $notasPorAsignaturaCurso[$asig]['alumnos_bajo_4'] = ($notasPorAsignaturaCurso[$asig]['alumnos_bajo_4'] ?? 0) + 1;
                }
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

        $promedioCurso = count($promediosGeneralesCurso) > 0
            ? round(array_sum($promediosGeneralesCurso) / count($promediosGeneralesCurso), 1)
            : 0.0;

        $pctPromedioBajo4 = $totalAlumnos > 0 ? round(($alumnosPromedioBajo4 / $totalAlumnos) * 100) : 0;
        $pctAsignaturaBajo4 = $totalAlumnos > 0 ? round(($alumnosAsignaturaPromedioBajo4 / $totalAlumnos) * 100) : 0;
        $pctNotaIndividualBajo4 = $totalAlumnos > 0 ? round(($alumnosConNotaIndividualBajo4 / $totalAlumnos) * 100) : 0;

        $resumenAsignaturas = [];
        foreach ($notasPorAsignaturaCurso as $asig => $datos) {
            $notas = $datos['notas'] ?? [];
            if (count($notas) === 0) {
                continue;
            }
            $prom = round(array_sum($notas) / count($notas), 1);
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

        return implode("\n", $lineas);
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
