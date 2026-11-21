<?php

namespace App\Services;

use Illuminate\Http\Client\Response;

class ProveedorIAAdapter
{
    private const PATRONES_NO_CHAT = [
        'whisper',
        'tts',
        'embedding',
        'dall-e',
        'moderation',
        'imagen',
        'veo-',
        'aqa',
        'babbage',
        'davinci',
        'playai',
        'prompt-guard',
        'llama-guard',
        'transcribe',
        'realtime',
        'sora',
        '-audio-',
    ];

    public static function headers(string $proveedor, string $apiKey): array
    {
        if ($proveedor === 'anthropic') {
            return [
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
                'Content-Type' => 'application/json',
            ];
        }

        $headers = [
            'Authorization' => 'Bearer '.$apiKey,
            'Content-Type' => 'application/json',
        ];

        if ($proveedor === 'openrouter') {
            $headers['HTTP-Referer'] = (string) config('app.url', 'http://localhost');
            $headers['X-Title'] = (string) config('app.name', 'SAPE CSS');
        }

        return $headers;
    }

    public static function headersModelos(string $proveedor, string $apiKey): array
    {
        if ($proveedor === 'anthropic') {
            return [
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
            ];
        }

        return [
            'Authorization' => 'Bearer '.$apiKey,
        ];
    }

    public static function endpointGeneracion(string $proveedor): string
    {
        return $proveedor === 'anthropic' ? 'messages' : 'chat/completions';
    }

    public static function presupuestoTokens(string $proveedor, string $model, int $base): int
    {
        if ($proveedor === 'groq' && in_array($model, ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'], true)) {
            return $base + 500;
        }

        return $base;
    }

    public static function esModeloRazonamientoOpenAI(string $proveedor, string $model): bool
    {
        return $proveedor === 'openai' && (bool) preg_match('/^(?:o[1-9]|gpt-5)/i', trim($model));
    }

    public static function prepararPeticion(string $proveedor, array $peticion): array
    {
        $modelo = (string) ($peticion['model'] ?? '');
        $limite = (int) ($peticion['max_completion_tokens'] ?? $peticion['max_tokens'] ?? 850);
        $tools = is_array($peticion['tools'] ?? null) ? array_values($peticion['tools']) : [];

        if ($proveedor === 'anthropic') {
            $sistemaPartes = [];
            $mensajes = [];

            foreach ($peticion['messages'] ?? [] as $mensaje) {
                $rol = (string) ($mensaje['role'] ?? 'user');
                $contenido = $mensaje['content'] ?? '';
                if ($rol === 'system') {
                    if (is_string($contenido) && trim($contenido) !== '') {
                        $sistemaPartes[] = $contenido;
                    }

                    continue;
                }

                if ($rol === 'tool') {
                    $bloqueResultado = [
                        'type' => 'tool_result',
                        'tool_use_id' => (string) ($mensaje['tool_call_id'] ?? ''),
                        'content' => is_string($contenido) ? $contenido : (json_encode($contenido, JSON_UNESCAPED_UNICODE) ?: '{}'),
                    ];
                    $ultimoIdx = count($mensajes) - 1;
                    if ($ultimoIdx >= 0 && $mensajes[$ultimoIdx]['role'] === 'user' && is_array($mensajes[$ultimoIdx]['content'])) {
                        $mensajes[$ultimoIdx]['content'][] = $bloqueResultado;
                    } else {
                        $mensajes[] = [
                            'role' => 'user',
                            'content' => [$bloqueResultado],
                        ];
                    }

                    continue;
                }

                if ($rol === 'assistant' && ! empty($mensaje['tool_calls']) && is_array($mensaje['tool_calls'])) {
                    $bloques = [];
                    if (is_string($contenido) && trim($contenido) !== '') {
                        $bloques[] = ['type' => 'text', 'text' => $contenido];
                    }
                    foreach ($mensaje['tool_calls'] as $call) {
                        $args = $call['function']['arguments'] ?? ($call['arguments'] ?? []);
                        if (is_string($args)) {
                            $args = json_decode($args, true);
                        }
                        $bloques[] = [
                            'type' => 'tool_use',
                            'id' => (string) ($call['id'] ?? 'tool_0'),
                            'name' => (string) ($call['function']['name'] ?? ($call['name'] ?? '')),
                            'input' => is_array($args) && $args !== [] ? $args : (object) [],
                        ];
                    }
                    $mensajes[] = [
                        'role' => 'assistant',
                        'content' => $bloques,
                    ];

                    continue;
                }

                $textoPlano = is_string($contenido) ? $contenido : '';
                $rolAnthropic = $rol === 'assistant' ? 'assistant' : 'user';
                $ultimoIdx = count($mensajes) - 1;
                if ($ultimoIdx >= 0 && $mensajes[$ultimoIdx]['role'] === $rolAnthropic && is_string($mensajes[$ultimoIdx]['content'])) {
                    $mensajes[$ultimoIdx]['content'] .= "\n\n".$textoPlano;
                } else {
                    $mensajes[] = [
                        'role' => $rolAnthropic,
                        'content' => $textoPlano,
                    ];
                }
            }

            if ($mensajes === []) {
                $mensajes[] = ['role' => 'user', 'content' => 'OK'];
            }

            $payload = [
                'model' => $modelo,
                'max_tokens' => max(1, $limite),
                'messages' => $mensajes,
            ];

            if ($sistemaPartes !== []) {
                $payload['system'] = implode("\n\n", $sistemaPartes);
            }

            if (isset($peticion['temperature'])) {
                $payload['temperature'] = $peticion['temperature'];
            }

            if ($tools !== []) {
                $payload['tools'] = self::convertirToolsAnthropic($tools);
            }

            return $payload;
        }

        $payload = $peticion;
        unset($payload['max_tokens'], $payload['max_completion_tokens']);

        if ($tools !== []) {
            $payload['tools'] = $tools;
            $payload['tool_choice'] = $peticion['tool_choice'] ?? 'auto';
        } else {
            unset($payload['tools'], $payload['tool_choice']);
        }

        if ($proveedor === 'groq' || self::esModeloRazonamientoOpenAI($proveedor, $modelo)) {
            $payload['max_completion_tokens'] = max(1, $limite);
        } else {
            $payload['max_tokens'] = max(1, $limite);
        }

        if ($proveedor === 'groq' && in_array($modelo, ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'], true)) {
            $payload['reasoning_effort'] = $payload['reasoning_effort'] ?? 'low';
        }

        if (self::esModeloRazonamientoOpenAI($proveedor, $modelo)) {
            unset($payload['temperature']);
        }

        return $payload;
    }

    private static function convertirToolsAnthropic(array $tools): array
    {
        $convertidas = [];
        foreach ($tools as $tool) {
            $fn = $tool['function'] ?? $tool;
            $nombre = trim((string) ($fn['name'] ?? ''));
            if ($nombre === '') {
                continue;
            }
            $schema = $fn['parameters'] ?? ['type' => 'object', 'properties' => (object) []];
            if (is_array($schema) && array_key_exists('properties', $schema) && $schema['properties'] === []) {
                $schema['properties'] = (object) [];
            }

            $convertidas[] = [
                'name' => $nombre,
                'description' => (string) ($fn['description'] ?? ''),
                'input_schema' => $schema,
            ];
        }

        return $convertidas;
    }

    public static function agregarRondaHerramientas(
        string $proveedor,
        array &$peticion,
        ?string $contenidoAsistente,
        array $toolCalls,
        array $resultadosPorId
    ): void {
        if ($proveedor === 'anthropic') {
            $bloquesAsistente = [];
            if (is_string($contenidoAsistente) && trim($contenidoAsistente) !== '') {
                $bloquesAsistente[] = ['type' => 'text', 'text' => $contenidoAsistente];
            }
            $bloquesResultados = [];

            foreach ($toolCalls as $call) {
                $id = (string) $call['id'];
                $args = is_array($call['arguments'] ?? null) ? $call['arguments'] : [];
                $bloquesAsistente[] = [
                    'type' => 'tool_use',
                    'id' => $id,
                    'name' => (string) $call['name'],
                    'input' => $args !== [] ? $args : (object) [],
                ];
                $bloquesResultados[] = [
                    'type' => 'tool_result',
                    'tool_use_id' => $id,
                    'content' => (string) ($resultadosPorId[$id] ?? '{}'),
                ];
            }

            $peticion['messages'][] = [
                'role' => 'assistant',
                'content' => $bloquesAsistente,
            ];
            $peticion['messages'][] = [
                'role' => 'user',
                'content' => $bloquesResultados,
            ];

            return;
        }

        $callsFormateadas = [];
        foreach ($toolCalls as $call) {
            $args = is_array($call['arguments'] ?? null) ? $call['arguments'] : [];
            $argsJson = json_encode($args !== [] ? $args : (object) [], JSON_UNESCAPED_UNICODE);
            $callsFormateadas[] = [
                'id' => (string) $call['id'],
                'type' => 'function',
                'function' => [
                    'name' => (string) $call['name'],
                    'arguments' => $argsJson === false ? '{}' : $argsJson,
                ],
            ];
        }

        $peticion['messages'][] = [
            'role' => 'assistant',
            'content' => $contenidoAsistente ?? '',
            'tool_calls' => $callsFormateadas,
        ];

        foreach ($toolCalls as $call) {
            $id = (string) $call['id'];
            $peticion['messages'][] = [
                'role' => 'tool',
                'tool_call_id' => $id,
                'name' => (string) $call['name'],
                'content' => (string) ($resultadosPorId[$id] ?? '{}'),
            ];
        }
    }

    public static function desactivarHerramientasEnPeticion(array &$peticion): void
    {
        unset($peticion['tools'], $peticion['tool_choice']);
    }

    public static function esErrorSoporteHerramientas(Response $response): bool
    {
        if ($response->status() !== 400) {
            return false;
        }

        $codigo = strtolower((string) ($response->json('error.code') ?? $response->json('error.type') ?? ''));
        $mensaje = strtolower((string) ($response->json('error.message') ?? ''));

        if ($codigo === 'tool_use_failed') {
            return true;
        }

        foreach (['tool', 'function calling', 'tool_choice', 'tools is not supported', 'does not support tools'] as $patron) {
            if (str_contains($mensaje, $patron)) {
                return true;
            }
        }

        return false;
    }

    public static function ampliarParaReintento(string $proveedor, array &$peticion, string $notaExtra): void
    {
        if (isset($peticion['max_completion_tokens'])) {
            $peticion['max_completion_tokens'] *= 2;
        } elseif (isset($peticion['max_tokens'])) {
            $peticion['max_tokens'] *= 2;
        }

        if ($proveedor === 'anthropic') {
            $peticion['system'] = ((string) ($peticion['system'] ?? '')).$notaExtra;

            return;
        }

        if (isset($peticion['messages'][0]['content']) && is_string($peticion['messages'][0]['content'])) {
            $peticion['messages'][0]['content'] .= $notaExtra;
        }
    }

    public static function extraerRespuesta(Response $response, string $proveedor = 'groq'): array
    {
        $usage = self::extraerUso($response);

        if ($proveedor === 'anthropic') {
            $bloques = $response->json('content');
            $bloques = is_array($bloques) ? $bloques : [];
            $textos = [];
            $toolCalls = [];

            foreach ($bloques as $idx => $bloque) {
                if (! is_array($bloque)) {
                    continue;
                }
                $tipo = (string) ($bloque['type'] ?? '');
                if ($tipo === 'text' && is_string($bloque['text'] ?? null)) {
                    $textos[] = $bloque['text'];
                } elseif ($tipo === 'tool_use' && is_string($bloque['name'] ?? null)) {
                    $toolCalls[] = [
                        'id' => (string) ($bloque['id'] ?? ('tool_'.$idx)),
                        'name' => trim($bloque['name']),
                        'arguments' => is_array($bloque['input'] ?? null) ? $bloque['input'] : [],
                    ];
                }
            }

            $stopReason = (string) ($response->json('stop_reason') ?? 'end_turn');
            $finishReason = match ($stopReason) {
                'max_tokens' => 'length',
                'tool_use' => 'tool_calls',
                default => 'stop',
            };

            return [
                'content' => $textos !== [] ? implode("\n", $textos) : null,
                'finish_reason' => $finishReason,
                'tool_calls' => $toolCalls,
                'usage' => $usage,
            ];
        }

        $contenido = $response->json('choices.0.message.content');
        if (is_array($contenido)) {
            $partes = [];
            foreach ($contenido as $parte) {
                if (is_array($parte) && is_string($parte['text'] ?? null)) {
                    $partes[] = $parte['text'];
                }
            }
            $contenido = $partes !== [] ? implode("\n", $partes) : null;
        }

        $rawToolCalls = $response->json('choices.0.message.tool_calls');
        $toolCalls = [];
        if (is_array($rawToolCalls)) {
            foreach ($rawToolCalls as $idx => $call) {
                if (! is_array($call)) {
                    continue;
                }
                $nombre = trim((string) ($call['function']['name'] ?? ''));
                if ($nombre === '') {
                    continue;
                }
                $rawArgs = $call['function']['arguments'] ?? [];
                if (is_string($rawArgs)) {
                    $decodificado = json_decode($rawArgs, true);
                    $args = is_array($decodificado) ? $decodificado : [];
                } else {
                    $args = is_array($rawArgs) ? $rawArgs : [];
                }

                $toolCalls[] = [
                    'id' => (string) ($call['id'] ?? ('call_'.$idx)),
                    'name' => $nombre,
                    'arguments' => $args,
                ];
            }
        }

        return [
            'content' => is_string($contenido) ? $contenido : null,
            'finish_reason' => $response->json('choices.0.finish_reason'),
            'tool_calls' => $toolCalls,
            'usage' => $usage,
        ];
    }

    public static function extraerUso(Response $response): array
    {
        $usage = $response->json('usage') ?? [];
        if (! is_array($usage)) {
            $usage = [];
        }

        $promptTokens = (int) ($usage['prompt_tokens'] ?? $usage['input_tokens'] ?? 0);
        $completionTokens = (int) ($usage['completion_tokens'] ?? $usage['output_tokens'] ?? 0);
        $totalTokens = (int) ($usage['total_tokens'] ?? ($promptTokens + $completionTokens));

        return [
            'prompt_tokens' => $promptTokens,
            'completion_tokens' => $completionTokens,
            'total_tokens' => $totalTokens,
        ];
    }

    public static function filtrarModelosChat(array $rawModels, string $proveedor): array
    {
        $normalizados = collect($rawModels)
            ->map(function ($m) use ($proveedor) {
                if (! is_array($m) || empty($m['id'])) {
                    return null;
                }
                $id = trim((string) $m['id']);
                if ($proveedor === 'gemini' && str_starts_with($id, 'models/')) {
                    $id = substr($id, strlen('models/'));
                }

                return $id;
            })
            ->filter()
            ->unique()
            ->values();

        $filtrados = $normalizados->filter(function (string $id) {
            $lower = strtolower($id);
            foreach (self::PATRONES_NO_CHAT as $patron) {
                if (str_contains($lower, $patron)) {
                    return false;
                }
            }

            return true;
        })->values();

        $resultado = $filtrados->isNotEmpty() ? $filtrados : $normalizados;

        return $resultado->take(40)->all();
    }

    public static function esErrorLimiteTemporal(Response $response): bool
    {
        if ($response->status() !== 429) {
            return false;
        }

        $codigo = strtolower((string) ($response->json('error.code') ?? $response->json('error.type') ?? ''));

        return ! in_array($codigo, ['insufficient_quota', 'blocked_api_access', 'billing_hard_limit_reached'], true);
    }

    public static function modeloRespaldoGroq(string $modeloActual): ?array
    {
        $actual = trim($modeloActual);

        return match ($actual) {
            'openai/gpt-oss-120b' => [
                'model' => 'openai/gpt-oss-20b',
                'nombre' => 'GPT-OSS 20B (respaldo)',
            ],
            'openai/gpt-oss-20b' => [
                'model' => 'llama-3.3-70b-versatile',
                'nombre' => 'Llama 3.3 70B (respaldo)',
            ],
            'llama-3.3-70b-versatile' => [
                'model' => 'openai/gpt-oss-20b',
                'nombre' => 'GPT-OSS 20B (respaldo)',
            ],
            default => [
                'model' => 'openai/gpt-oss-20b',
                'nombre' => 'GPT-OSS 20B (respaldo)',
            ],
        };
    }

    public static function segundosEsperaRateLimit(Response $response): ?int
    {
        $retryAfter = trim((string) $response->header('Retry-After'));
        if ($retryAfter !== '' && is_numeric($retryAfter)) {
            return max(1, min(120, (int) ceil((float) $retryAfter)));
        }

        $resetTokens = trim((string) $response->header('x-ratelimit-reset-tokens'));
        if ($resetTokens !== '') {
            $segundos = 0.0;
            if (preg_match('/(\d+(?:\.\d+)?)m/', $resetTokens, $m)) {
                $segundos += ((float) $m[1]) * 60;
            }
            if (preg_match('/(\d+(?:\.\d+)?)s/', $resetTokens, $s)) {
                $segundos += (float) $s[1];
            }
            if ($segundos > 0) {
                return max(1, min(120, (int) ceil($segundos)));
            }
        }

        return null;
    }

    public static function metadatosErrorSeguro(Response $response, string $proveedor, string $modelo): array
    {
        return array_filter([
            'estado_http' => $response->status(),
            'proveedor' => $proveedor,
            'modelo' => $modelo,
            'codigo_error' => (string) ($response->json('error.code') ?? $response->json('error.type') ?? ''),
            'retry_after' => self::segundosEsperaRateLimit($response),
            'remaining_tokens' => $response->header('x-ratelimit-remaining-tokens') ?: null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    public static function mensajeErrorSeguro(Response $response, string $proveedorNombre, string $modelo = ''): string
    {
        $status = $response->status();
        $codigo = strtolower((string) ($response->json('error.code') ?? $response->json('error.type') ?? ''));

        if ($status === 401 || in_array($codigo, ['invalid_api_key', 'authentication_error'], true)) {
            return "La API Key fue rechazada por {$proveedorNombre}. Verifica que esté bien copiada y activa.";
        }

        if ($status === 402 || in_array($codigo, ['insufficient_quota', 'blocked_api_access', 'billing_hard_limit_reached'], true)) {
            return "La cuenta de {$proveedorNombre} no tiene saldo o alcanzó su límite de gasto. Revisa facturación o cambia de plan.";
        }

        if ($status === 403) {
            return "La API Key de {$proveedorNombre} no tiene permisos para usar este modelo.";
        }

        if ($status === 404 || in_array($codigo, ['model_not_found', 'not_found_error'], true)) {
            $etiquetaModelo = $modelo !== '' ? " «{$modelo}»" : '';

            return "El modelo{$etiquetaModelo} no está disponible en tu cuenta de {$proveedorNombre}. Selecciona otro modelo en Configuración.";
        }

        if ($status === 429) {
            $mensajeInterno = strtolower((string) ($response->json('error.message') ?? ''));
            $esLimiteDiario = str_contains($mensajeInterno, 'per day')
                || str_contains($mensajeInterno, 'tpd')
                || str_contains($mensajeInterno, 'rpd');

            if ($esLimiteDiario) {
                return "Se alcanzó la cuota diaria del plan gratuito en {$proveedorNombre}. Cambia de modelo o activa Groq Developer / OpenAI en Configuración → IA.";
            }

            $segundos = self::segundosEsperaRateLimit($response);
            if ($segundos !== null) {
                return "El modelo alcanzó su cuota temporal de tokens por minuto en {$proveedorNombre}. Intenta de nuevo en ~{$segundos} segundos, cambia de modelo o activa Groq Developer / OpenAI.";
            }

            return "Se alcanzó el límite temporal de consultas en {$proveedorNombre}. Espera unos segundos, cambia de modelo o activa Groq Developer / OpenAI.";
        }

        if ($status === 400) {
            return "{$proveedorNombre} rechazó la solicitud del modelo seleccionado. Verifica el ID del modelo en Configuración.";
        }

        return "{$proveedorNombre} respondió con código HTTP {$status}. Revisa la conexión en Configuración.";
    }
}
