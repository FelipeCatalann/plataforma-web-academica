<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Models\Estudiante;
use App\Services\ConexionIA;
use App\Services\ConfiguracionIAService;
use App\Services\PrivacidadService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InformeIAController extends Controller
{
    private const DESTINATARIOS = [
        'Apoderado',
        'Unidad Técnico Pedagógica (UTP)',
        'Departamento de Psicología / Convivencia Escolar',
        'Dirección del Establecimiento',
    ];

    public function generarInforme(Request $request, ConfiguracionIAService $iaService)
    {
        // 1. Ampliar tiempo de ejecución
        set_time_limit(120);

        // Validamos que vengan todos los campos del Modal
        $request->validate([
            'estudiante_id' => 'required|uuid',
            'curso_id' => 'required|uuid',
            'destinatario' => ['required', 'string', Rule::in(self::DESTINATARIOS)],
            'palabras_clave' => 'nullable|string|max:500',
            'modelo_id' => 'nullable|string|max:120',
            'tono_ia' => 'nullable|string|in:formal_decreto67,cercano_familia,ejecutivo_breve',
            'extension_ia' => 'nullable|string|in:breve,equilibrada,detallada',
            'precision_ia' => 'nullable|string|in:estricto,balanceado,dinamico',
        ]);

        $estudiante = Estudiante::find($request->estudiante_id);
        $curso = Curso::find($request->curso_id);
        abort_if(! $estudiante || ! $curso, 404, 'No se encontró el estudiante o el curso.');
        Gate::authorize('generarInforme', [$estudiante, $curso]);

        try {
            $cursoTexto = "{$curso->nivel}° Medio {$curso->letra}";
            $puedeVerTodoElCurso = Gate::allows('verCursoCompleto', $curso);

            $asignaturasPermitidas = DB::table('asignatura_curso')->where('curso_id', $curso->id);
            if (! $puedeVerTodoElCurso) {
                $asignaturasPermitidas->where('profesor_id', $request->user()->id);
            }

            $notas = $estudiante->calificaciones()
                ->where('matriculas.curso_id', $curso->id)
                ->where('matriculas.vigente', true)
                ->whereIn('calificaciones.asignatura_curso_id', $asignaturasPermitidas->select('id'))
                ->pluck('calificaciones.valor')
                ->toArray();

            // 2. ENMASCARAMIENTO (Ley 19.628)
            $nombreReal = trim($estudiante->nombres.' '.$estudiante->apellidos);
            $runReal = $estudiante->identificadorInterno ?? $estudiante->run ?? 'Sin Registro';

            $promedio = count($notas) > 0 ? array_sum($notas) / count($notas) : 0;
            $promedioFmt = number_format($promedio, 1);
            $listaNotas = count($notas) > 0 ? implode(', ', $notas) : 'Sin notas registradas';

            // 3. Resolver credenciales y preferencias de IA del usuario (o fallback a Groq del sistema)
            $credenciales = $iaService->resolverCredencialesAgente(
                $request->user(),
                'informes',
                array_filter([
                    'modelo_id' => $request->input('modelo_id'),
                    'tono_ia' => $request->input('tono_ia'),
                    'extension_ia' => $request->input('extension_ia'),
                    'precision_ia' => $request->input('precision_ia'),
                ], fn ($v) => $v !== null && $v !== '')
            );

            $destinatario = $request->destinatario;
            $privacidad = app(PrivacidadService::class);
            $sanear = function (string $texto) use ($privacidad, $estudiante, $runReal): string {
                $texto = $privacidad->anonimizar($texto, [$estudiante])['texto'];

                return $privacidad->ocultarContactos(str_ireplace((string) $runReal, '[RUN]', $texto));
            };
            $observaciones = $sanear((string) $request->palabras_clave);
            $textoPalabrasClave = $observaciones !== ''
                ? "Considera además estos puntos clave observados por el profesor: {$observaciones}."
                : '';

            $instrucciones = $sanear($credenciales['instrucciones_personalizadas']);
            $extraInstrucciones = $instrucciones !== ''
                ? "Instrucción adicional del docente: {$instrucciones}."
                : '';

            // 4. Prompt de usuario ocultando la identidad
            $prompt = "Redacta un informe pedagógico formal y respetuoso dirigido a: {$destinatario}.
            El estudiante [ESTUDIANTE] (RUT: [RUN]), perteneciente a [CURSO], tiene un promedio de {$promedioFmt} en las calificaciones autorizadas para este docente.
            Sus calificaciones recientes son: {$listaNotas}.
            
            {$textoPalabrasClave}
            {$credenciales['instruccion_tono']}
            {$credenciales['instruccion_extension']}
            {$extraInstrucciones}
            
            Escribe exactamente 3 párrafos formales:
            1. Situación académica actual basada en sus notas.
            2. Fortalezas actitudinales o análisis de los puntos clave mencionados.
            3. Sugerencias de mejora pedagógica o derivación.
            
            IMPORTANTE: No uses formato Markdown (ni asteriscos, ni negritas, ni tablas). Escribe solo en texto plano con saltos de línea.";

            if (mb_strlen($prompt) > 32000) {
                return response()->json(['error' => 'El contexto es demasiado extenso para generar el informe.'], 422);
            }

            // 5. Petición a la IA (Groq predeterminado o modelo personalizado del usuario)
            if (empty($credenciales['api_key'])) {
                return response()->json(['error' => 'Configura una clave de IA para generar el informe.'], 422);
            }

            $response = ConexionIA::cliente($credenciales['base_url'], $credenciales['headers'], 30)
                ->post('chat/completions', [
                    'model' => $credenciales['model'],
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'Eres un profesor jefe y orientador experto en redacción de informes pedagógicos formales.',
                        ],
                        [
                            'role' => 'user',
                            'content' => $prompt,
                        ],
                    ],
                    'temperature' => $credenciales['temperature'],
                    'max_tokens' => $credenciales['max_tokens'],
                ]);

            if ($response->successful()) {
                $iaService->registrarConsumoYCuota($request->user(), $credenciales, $response);
                $informeTokenizado = $response->json('choices.0.message.content') ?? 'No se pudo generar el contenido.';

                // 6. RESTAURACIÓN DE DATOS (Des-enmascaramiento)
                $informeFinal = str_replace(
                    ['[ESTUDIANTE]', '[RUN]', '[CURSO]'],
                    [$nombreReal, $runReal, $cursoTexto],
                    $informeTokenizado
                );

                return response()->json([
                    'success' => true,
                    'informe' => $informeFinal,
                    'modelo' => $credenciales['model'],
                    'proveedor' => $credenciales['proveedor_nombre'],
                ])->header('Cache-Control', 'no-store');
            }

            Log::warning('El proveedor rechazó el informe.', ['estado_http' => $response->status()]);

            return response()->json([
                'error' => 'El proveedor de IA no pudo generar el informe.',
            ], $response->status() === 429 ? 429 : 502);

        } catch (ValidationException $e) {
            throw $e;
        } catch (ConnectionException) {
            Log::warning('No fue posible conectar con el proveedor de informes.');

            return response()->json(['error' => 'No fue posible conectar con el proveedor de IA.'], 503);
        } catch (\Throwable $e) {
            Log::error('No se pudo generar el informe.', ['tipo' => $e::class]);

            return response()->json([
                'error' => 'No se pudo generar el informe. Intenta nuevamente.',
            ], 500);
        }
    }
}
