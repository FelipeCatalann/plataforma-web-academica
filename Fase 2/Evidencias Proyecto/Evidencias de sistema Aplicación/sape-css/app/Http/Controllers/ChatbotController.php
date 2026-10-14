<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Services\PrivacidadService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ChatbotController extends Controller
{
    public function sendMessage(Request $request)
    {
        // 1. Ampliar límite de tiempo
        set_time_limit(120);

        $request->validate([
            'mensaje' => 'required|string',
            'curso_id' => 'required',
            'tipo_profesor' => 'required|string',
        ]);

        try {
            // 2. Obtener contexto del curso
            $curso = Curso::with('estudiantes.calificaciones')->find($request->curso_id);
            $totalAlumnos = $curso->estudiantes->count();

            $totalNotas = 0;
            $notasDeficientes = 0;

            foreach ($curso->estudiantes as $estudiante) {
                foreach ($estudiante->calificaciones as $nota) {
                    $totalNotas++;
                    if (is_numeric($nota->valor) && (float) $nota->valor < 4.0) {
                        $notasDeficientes++;
                    }
                }
            }

            $porcentajeRiesgo = $totalNotas > 0 ? round(($notasDeficientes / $totalNotas) * 100) : 0;
            $contextoAcademico = "Curso: {$curso->nivel}° Medio {$curso->letra}. Alumnos: {$totalAlumnos}. Situación del curso: De un total de {$totalNotas} calificaciones registradas, un {$porcentajeRiesgo}% son deficientes (bajo 4.0).";

            // INDG-27: anonimizar el mensaje antes de enviarlo a la IA.
            $privacidad = app(PrivacidadService::class);
            ['texto' => $mensajeSeguro, 'mapa' => $mapa] = $privacidad->anonimizar(
                $request->mensaje, $curso->estudiantes
            );

            // 3. Prompt de Sistema (Reglas)
            $promptSistema = "Eres un asistente pedagógico experto y empático. Estás hablando con un {$request->tipo_profesor} de Chile. El profesor te consulta sobre este curso: {$contextoAcademico}. Considera el porcentaje de riesgo del curso para dar estrategias acordes. Da sugerencias pedagógicas prácticas, pautas de evaluación y dinámicas. Usa formato Markdown (negritas, viñetas). Sé directo y profesional. IMPORTANTE: No uses tablas, ni negritas, ni formato Markdown. Escribe solo en texto plano usando saltos de línea y guiones simples para las listas.";

            // 4. API Key de Groq
            $apiKey = trim(env('GROQ_API_KEY'));

            if (empty($apiKey)) {
                throw new \Exception('La API Key de Groq está vacía en el archivo .env.');
            }

            // 5. Petición a Groq (Llama 3 de Meta)
            $url = 'https://api.groq.com/openai/v1/chat/completions';

            $response = Http::withoutVerifying()
                ->timeout(30)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post($url, [
                    'model' => 'openai/gpt-oss-120b', // Modelo avanzado súper rápido
                    'messages' => [
                        ['role' => 'system', 'content' => $promptSistema],
                        ['role' => 'user', 'content' => $mensajeSeguro]
                    ],
                    'temperature' => 0.5,
                ]);

            // 6. Procesar respuesta
            if ($response->successful()) {
                $respuestaAPI = $response->json('choices.0.message.content') ?? '';
                
                $textoIA = $privacidad->restaurar($respuestaAPI, $mapa);

                return response()->json(['respuesta' => $textoIA]);
            }

            $detalleGroq = $response->json('error.message') ?? $response->body();
            Log::error('Error Groq: ' . $detalleGroq);

            return response()->json([
                'respuesta' => "🚨 Error de Formato Groq (400):\n\n" . $detalleGroq
            ], 400);

        } catch (\Exception $e) {
            return response()->json(['respuesta' => 'Error de Laravel: '.$e->getMessage()], 500);
        }
    }
}