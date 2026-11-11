<?php

namespace App\Http\Controllers;

use App\Models\Estudiante;
use App\Services\ConfiguracionIAService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class InformeIAController extends Controller
{
    public function generarInforme(Request $request, ConfiguracionIAService $iaService)
    {
        // 1. Ampliar tiempo de ejecución
        set_time_limit(120);

        // Validamos que vengan todos los campos del Modal
        $request->validate([
            'estudiante_id' => 'required',
            'destinatario' => 'required|string',
            'palabras_clave' => 'nullable|string',
            'modelo_id' => 'nullable|string|max:120',
            'tono_ia' => 'nullable|string|in:formal_decreto67,cercano_familia,ejecutivo_breve',
            'extension_ia' => 'nullable|string|in:breve,equilibrada,detallada',
            'precision_ia' => 'nullable|string|in:estricto,balanceado,dinamico',
        ]);

        try {
            $estudiante = Estudiante::with('calificaciones')->findOrFail($request->estudiante_id);
            $cursoTexto = $request->curso_nombre ?? 'su curso';

            // 2. ENMASCARAMIENTO (Ley 19.628)
            $nombreReal = trim($estudiante->nombres.' '.$estudiante->apellidos);
            $runReal = $estudiante->identificadorInterno ?? $estudiante->run ?? 'Sin Registro';

            $notas = $estudiante->calificaciones->pluck('valor')->toArray();
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
            $textoPalabrasClave = $request->palabras_clave
                ? "Considera además estos puntos clave observados por el profesor: {$request->palabras_clave}."
                : '';

            $extraInstrucciones = $credenciales['instrucciones_personalizadas'] !== ''
                ? "Instrucción adicional del docente: {$credenciales['instrucciones_personalizadas']}."
                : '';

            // 4. Prompt de usuario ocultando la identidad
            $prompt = "Redacta un informe pedagógico formal y respetuoso dirigido a: {$destinatario}.
            El estudiante [ESTUDIANTE] (RUT: [RUN]), perteneciente a [CURSO], tiene un promedio general de {$promedioFmt}.
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

            // 5. Petición a la IA (Groq predeterminado o modelo personalizado del usuario)
            $apiKey = $credenciales['api_key'];

            $response = Http::withoutVerifying()
                ->timeout(30)
                ->withHeaders($credenciales['headers'])
                ->post($credenciales['chat_url'], [
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
                ]);
            }

            Log::error('Error IA Informe: '.$response->body());

            return response()->json([
                'error' => 'Error al conectar con la IA. Detalle: '.$response->status(),
            ], 503);

        } catch (\Exception $e) {
            Log::error('Error Excepción Informe: '.$e->getMessage());

            return response()->json([
                'error' => 'Error interno: '.$e->getMessage(),
            ], 500);
        }
    }
}
