<?php

namespace App\Http\Controllers;

use App\Models\Estudiante;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class InformeIAController extends Controller
{
    public function generarInforme(Request $request)
    {
        // 1. Ampliar tiempo de ejecución
        set_time_limit(120);

        // Validamos que vengan todos los campos del Modal
        $request->validate([
            'estudiante_id' => 'required', // Le quitamos el 'integer' para que acepte cualquier formato de ID
            'destinatario' => 'required|string',
            'palabras_clave' => 'nullable|string',
        ]);

        try {
            $estudiante = Estudiante::with('calificaciones')->findOrFail($request->estudiante_id);
            $cursoTexto = $request->curso_nombre ?? 'su curso';

            // 2. ENMASCARAMIENTO (Ley 19.628)
            $nombreReal = trim($estudiante->nombres.' '.$estudiante->apellidos);
            $runReal = $estudiante->run ?? 'Sin Registro';

            $notas = $estudiante->calificaciones->pluck('valor')->toArray();
            $promedio = count($notas) > 0 ? array_sum($notas) / count($notas) : 0;
            $promedioFmt = number_format($promedio, 1);
            $listaNotas = count($notas) > 0 ? implode(', ', $notas) : 'Sin notas registradas';

            // 3. Configuración del contexto adicional
            $destinatario = $request->destinatario;
            $textoPalabrasClave = $request->palabras_clave
                ? "Considera además estos puntos clave observados por el profesor: {$request->palabras_clave}."
                : '';

            // 4. Prompt de usuario ocultando la identidad
            $prompt = "Redacta un informe pedagógico formal y respetuoso dirigido a: {$destinatario}.
            El estudiante [ESTUDIANTE] (RUT: [RUN]), perteneciente a [CURSO], tiene un promedio general de {$promedioFmt}.
            Sus calificaciones recientes son: {$listaNotas}.
            
            {$textoPalabrasClave}
            
            Escribe exactamente 3 párrafos formales:
            1. Situación académica actual basada en sus notas.
            2. Fortalezas actitudinales o análisis de los puntos clave mencionados.
            3. Sugerencias de mejora pedagógica o derivación.
            
            IMPORTANTE: No uses formato Markdown (ni asteriscos, ni negritas, ni tablas). Escribe solo en texto plano con saltos de línea.";

            // 5. Petición a la IA (Groq - Llama)
            $apiKey = env('GROQ_API_KEY');

            $response = Http::withoutVerifying()
                ->timeout(30)
                ->withHeaders([
                    'Authorization' => 'Bearer '.$apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post('https://api.groq.com/openai/v1/chat/completions', [
                    'model' => 'qwen/qwen3.8-27b', // Si te da error de límite, cámbialo a 'openai/gpt-oss-120b'
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
                    'temperature' => 0.4,
                    'max_tokens' => 800,
                ]);

            if ($response->successful()) {
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
