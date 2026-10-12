<?php

namespace App\Http\Controllers;

use App\Models\Curso;
use App\Services\PrivacidadService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ChatbotController extends Controller
{
    public function sendMessage(Request $request)
    {
        $request->validate([
            'mensaje' => 'required|string',
            'curso_id' => 'required',
            'tipo_profesor' => 'required|string',
        ]);

        try {
            // 1. Obtener contexto del curso
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

            // 2. Prompt de Sistema (Reglas)
            $promptSistema = "Eres un asistente pedagógico experto y empático. Estás hablando con un {$request->tipo_profesor} de Chile. El profesor te consulta sobre este curso: {$contextoAcademico}. Considera el porcentaje de riesgo del curso para dar estrategias acordes. Da sugerencias pedagógicas prácticas, pautas de evaluación y dinámicas. Usa formato Markdown (negritas, viñetas). Sé directo y profesional.";

            // 3. Limpiar la API Key
            $apiKey = trim(env('GEMINI_API_KEY'));

            if (empty($apiKey)) {
                throw new \Exception('La API Key de Gemini está vacía en el archivo .env.');
            }

            // 4. URL oficial usando el modelo 'gemini-flash-latest' de la lista que obtuvimos
            $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key='.$apiKey;

            // 5. Enviamos la petición forzando el formato JSON
            $response = Http::timeout(30)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, [
                    'systemInstruction' => [
                        'parts' => [['text' => $promptSistema]],
                    ],
                    'contents' => [
                        [
                            'role' => 'user',
                            'parts' => [['text' => $mensajeSeguro]],
                        ],
                    ],
                ]);

            // 6. Procesar respuesta (restaurando nombres: Google nunca los vio)
            if ($response->successful()) {
                $textoIA = $privacidad->restaurar(
                    $response->json('candidates.0.content.parts.0.text') ?? '', $mapa
                );

                return response()->json(['respuesta' => $textoIA]);
            }

            return response()->json(['respuesta' => 'Error de Gemini: '.$response->body()], 500);

        } catch (\Exception $e) {
            return response()->json(['respuesta' => 'Error de Laravel: '.$e->getMessage()], 500);
        }
    }
}
