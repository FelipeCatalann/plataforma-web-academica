<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;

class ConfiguracionIAService
{
    public const PROVEEDORES = [
        'groq' => [
            'id' => 'groq',
            'nombre' => 'Groq Cloud',
            'subtitulo' => 'Inferencia ultrarrápida',
            'base_url' => 'https://api.groq.com/openai/v1',
            'placeholder_key' => 'gsk_...',
        ],
        'openai' => [
            'id' => 'openai',
            'nombre' => 'OpenAI',
            'subtitulo' => 'Modelos GPT oficiales',
            'base_url' => 'https://api.openai.com/v1',
            'placeholder_key' => 'sk-...',
        ],
        'gemini' => [
            'id' => 'gemini',
            'nombre' => 'Google Gemini',
            'subtitulo' => 'Modelos Gemini rápidos',
            'base_url' => 'https://generativelanguage.googleapis.com/v1beta/openai',
            'placeholder_key' => 'AIza...',
        ],
        'anthropic' => [
            'id' => 'anthropic',
            'nombre' => 'Anthropic Claude',
            'subtitulo' => 'Modelos Claude oficiales',
            'base_url' => 'https://api.anthropic.com/v1',
            'placeholder_key' => 'sk-ant-...',
        ],
        'openrouter' => [
            'id' => 'openrouter',
            'nombre' => 'OpenRouter',
            'subtitulo' => 'Claude, DeepSeek y más',
            'base_url' => 'https://openrouter.ai/api/v1',
            'placeholder_key' => 'sk-or-...',
        ],
        'custom' => [
            'id' => 'custom',
            'nombre' => 'Compatible OpenAI',
            'subtitulo' => 'Endpoint o proxy propio',
            'base_url' => 'https://api.openai.com/v1',
            'placeholder_key' => 'sk-...',
        ],
    ];

    public const MODELOS_SISTEMA = [
        [
            'id' => 'llama-3.3-70b-versatile',
            'model_id' => 'llama-3.3-70b-versatile',
            'nombre' => 'Llama 3.3 70B',
            'subtitulo' => 'Groq · Equilibrado y veloz',
            'proveedor' => 'groq',
            'proveedor_nombre' => 'Groq Cloud',
            'origen' => 'sistema',
            'recomendado_para' => 'Chat e Informes',
        ],
        [
            'id' => 'openai/gpt-oss-120b',
            'model_id' => 'openai/gpt-oss-120b',
            'nombre' => 'GPT-OSS 120B',
            'subtitulo' => 'Groq · Razonamiento profundo',
            'proveedor' => 'groq',
            'proveedor_nombre' => 'Groq Cloud',
            'origen' => 'sistema',
            'recomendado_para' => 'Copiloto Pedagógico',
        ],
        [
            'id' => 'qwen/qwen3.8-27b',
            'model_id' => 'qwen/qwen3.8-27b',
            'nombre' => 'Qwen 3.8 27B',
            'subtitulo' => 'Groq · Redacción formal',
            'proveedor' => 'groq',
            'proveedor_nombre' => 'Groq Cloud',
            'origen' => 'sistema',
            'recomendado_para' => 'Informes Decreto 67',
        ],
    ];

    public function configuracionPorDefecto(): array
    {
        return [
            'modelo_activo_id' => 'llama-3.3-70b-versatile',
            'usar_mismo_modelo_agentes' => true,
            'modelo_chat_id' => 'openai/gpt-oss-120b',
            'modelo_informes_id' => 'qwen/qwen3.8-27b',
            'tono_ia' => 'formal_decreto67',
            'extension_ia' => 'equilibrada',
            'precision_ia' => 'balanceado',
            'instrucciones_ia' => '',
            'formato_visual_ia' => 'markdown',
            'efecto_escritura_ia' => true,
            'tamano_texto_chat' => 'normal',
            'mostrar_sugerencias_chat' => true,
            'modelos_personalizados' => [],
            'metricas_consumo' => [
                'total_tokens' => 0,
                'prompt_tokens' => 0,
                'completion_tokens' => 0,
                'total_consultas' => 0,
                'ultima_consulta' => null,
                'por_modelo' => [],
            ],
        ];
    }

    public function obtenerConfiguracionCruda(?User $user): array
    {
        $defecto = $this->configuracionPorDefecto();
        if (! $user) {
            return $defecto;
        }

        try {
            $guardada = $user->configuracion_ia;
            if (! is_array($guardada)) {
                return $defecto;
            }

            return array_merge($defecto, $guardada);
        } catch (\Throwable) {
            return $defecto;
        }
    }

    public function enmascararApiKey(string $apiKey): string
    {
        $limpia = trim($apiKey);
        $len = strlen($limpia);
        if ($len === 0) {
            return '';
        }
        if ($len <= 8) {
            return substr($limpia, 0, 2).'••••'.substr($limpia, -2);
        }

        return substr($limpia, 0, 4).'••••••'.substr($limpia, -4);
    }

    public function obtenerConfiguracionPublica(?User $user): array
    {
        $cruda = $this->obtenerConfiguracionCruda($user);
        $personalizados = [];

        foreach ($cruda['modelos_personalizados'] ?? [] as $modelo) {
            if (! is_array($modelo) || empty($modelo['id']) || empty($modelo['model_id'])) {
                continue;
            }
            $proveedorId = $modelo['proveedor'] ?? 'groq';
            $proveedorInfo = self::PROVEEDORES[$proveedorId] ?? self::PROVEEDORES['custom'];
            $rawKey = (string) ($modelo['api_key'] ?? '');

            $personalizados[] = [
                'id' => (string) $modelo['id'],
                'model_id' => (string) $modelo['model_id'],
                'nombre' => (string) ($modelo['nombre'] ?? $modelo['model_id']),
                'subtitulo' => (string) ($modelo['subtitulo'] ?? ($proveedorInfo['nombre'].' · Clave propia')),
                'proveedor' => $proveedorId,
                'proveedor_nombre' => $proveedorInfo['nombre'],
                'base_url' => (string) ($modelo['base_url'] ?? $proveedorInfo['base_url']),
                'origen' => 'usuario',
                'tiene_api_key' => $rawKey !== '',
                'api_key_masked' => $this->enmascararApiKey($rawKey),
            ];
        }

        $todosLosModelos = array_merge(self::MODELOS_SISTEMA, $personalizados);
        $idsDisponibles = array_column($todosLosModelos, 'id');

        $modeloActivoId = in_array($cruda['modelo_activo_id'], $idsDisponibles, true)
            ? $cruda['modelo_activo_id']
            : 'llama-3.3-70b-versatile';

        $modeloChatId = in_array($cruda['modelo_chat_id'], $idsDisponibles, true)
            ? $cruda['modelo_chat_id']
            : 'openai/gpt-oss-120b';

        $modeloInformesId = in_array($cruda['modelo_informes_id'], $idsDisponibles, true)
            ? $cruda['modelo_informes_id']
            : 'qwen/qwen3.8-27b';

        $modeloActivoObj = collect($todosLosModelos)->firstWhere('id', $modeloActivoId) ?? self::MODELOS_SISTEMA[0];

        $metricasCrudas = is_array($cruda['metricas_consumo'] ?? null)
            ? $cruda['metricas_consumo']
            : [];

        $metricasPublicas = [
            'total_tokens' => (int) ($metricasCrudas['total_tokens'] ?? 0),
            'prompt_tokens' => (int) ($metricasCrudas['prompt_tokens'] ?? 0),
            'completion_tokens' => (int) ($metricasCrudas['completion_tokens'] ?? 0),
            'total_consultas' => (int) ($metricasCrudas['total_consultas'] ?? 0),
            'ultima_consulta' => $metricasCrudas['ultima_consulta'] ?? null,
            'por_modelo' => is_array($metricasCrudas['por_modelo'] ?? null) ? $metricasCrudas['por_modelo'] : [],
        ];

        return [
            'modelo_activo_id' => $modeloActivoId,
            'modelo_activo_nombre' => $modeloActivoObj['nombre'],
            'modelo_activo_proveedor' => $modeloActivoObj['proveedor_nombre'],
            'usar_mismo_modelo_agentes' => (bool) ($cruda['usar_mismo_modelo_agentes'] ?? true),
            'modelo_chat_id' => $modeloChatId,
            'modelo_informes_id' => $modeloInformesId,
            'tono_ia' => (string) ($cruda['tono_ia'] ?? 'formal_decreto67'),
            'extension_ia' => (string) ($cruda['extension_ia'] ?? 'equilibrada'),
            'precision_ia' => (string) ($cruda['precision_ia'] ?? 'balanceado'),
            'instrucciones_ia' => (string) ($cruda['instrucciones_ia'] ?? ''),
            'formato_visual_ia' => (string) ($cruda['formato_visual_ia'] ?? 'markdown'),
            'efecto_escritura_ia' => (bool) ($cruda['efecto_escritura_ia'] ?? true),
            'tamano_texto_chat' => (string) ($cruda['tamano_texto_chat'] ?? 'normal'),
            'mostrar_sugerencias_chat' => (bool) ($cruda['mostrar_sugerencias_chat'] ?? true),
            'modelos_sistema' => self::MODELOS_SISTEMA,
            'modelos_personalizados' => $personalizados,
            'proveedores' => array_values(self::PROVEEDORES),
            'metricas_consumo' => $metricasPublicas,
        ];
    }

    public function agregarModeloPersonalizado(User $user, array $datos): array
    {
        $cruda = $this->obtenerConfiguracionCruda($user);
        $proveedorId = array_key_exists($datos['proveedor'] ?? '', self::PROVEEDORES)
            ? $datos['proveedor']
            : 'groq';
        $proveedorInfo = self::PROVEEDORES[$proveedorId];

        $modelId = trim((string) $datos['model_id']);
        $nombre = trim((string) ($datos['nombre'] ?? '')) ?: $modelId;
        $subtitulo = trim((string) ($datos['subtitulo'] ?? '')) ?: ($proveedorInfo['nombre'].' · API Key propia');
        $baseUrl = rtrim(trim((string) ($datos['base_url'] ?? '')), '/') ?: $proveedorInfo['base_url'];
        $apiKey = trim((string) $datos['api_key']);

        $personalizados = is_array($cruda['modelos_personalizados'] ?? null)
            ? $cruda['modelos_personalizados']
            : [];

        // Si ya existe un modelo con el mismo model_id y proveedor, lo actualizamos
        $existenteIdx = null;
        foreach ($personalizados as $idx => $item) {
            if (($item['model_id'] ?? '') === $modelId && ($item['proveedor'] ?? '') === $proveedorId) {
                $existenteIdx = $idx;
                break;
            }
        }

        $idUnico = $existenteIdx !== null
            ? $personalizados[$existenteIdx]['id']
            : 'custom_'.Str::lower(Str::random(8));

        $nuevoModelo = [
            'id' => $idUnico,
            'model_id' => $modelId,
            'nombre' => Str::limit($nombre, 48, ''),
            'subtitulo' => Str::limit($subtitulo, 48, ''),
            'proveedor' => $proveedorId,
            'base_url' => $baseUrl,
            'api_key' => $apiKey,
        ];

        if ($existenteIdx !== null) {
            $personalizados[$existenteIdx] = $nuevoModelo;
        } else {
            $personalizados[] = $nuevoModelo;
        }

        $cruda['modelos_personalizados'] = array_values($personalizados);

        if (! empty($datos['activar_inmediatamente'])) {
            $cruda['modelo_activo_id'] = $idUnico;
            if (! ($cruda['usar_mismo_modelo_agentes'] ?? true)) {
                $cruda['modelo_chat_id'] = $idUnico;
                $cruda['modelo_informes_id'] = $idUnico;
            }
        }

        $user->configuracion_ia = $cruda;
        $user->save();

        return $this->obtenerConfiguracionPublica($user);
    }

    public function eliminarModeloPersonalizado(User $user, string $modeloId): array
    {
        $cruda = $this->obtenerConfiguracionCruda($user);
        $personalizados = array_filter(
            $cruda['modelos_personalizados'] ?? [],
            fn ($m) => ($m['id'] ?? '') !== $modeloId
        );
        $cruda['modelos_personalizados'] = array_values($personalizados);

        if (($cruda['modelo_activo_id'] ?? '') === $modeloId) {
            $cruda['modelo_activo_id'] = 'llama-3.3-70b-versatile';
        }
        if (($cruda['modelo_chat_id'] ?? '') === $modeloId) {
            $cruda['modelo_chat_id'] = 'openai/gpt-oss-120b';
        }
        if (($cruda['modelo_informes_id'] ?? '') === $modeloId) {
            $cruda['modelo_informes_id'] = 'qwen/qwen3.8-27b';
        }

        $user->configuracion_ia = $cruda;
        $user->save();

        return $this->obtenerConfiguracionPublica($user);
    }

    public function actualizarPreferenciasIA(User $user, array $ajustes): array
    {
        $cruda = $this->obtenerConfiguracionCruda($user);

        $camposPermitidos = [
            'modelo_activo_id',
            'usar_mismo_modelo_agentes',
            'modelo_chat_id',
            'modelo_informes_id',
            'tono_ia',
            'extension_ia',
            'precision_ia',
            'instrucciones_ia',
            'formato_visual_ia',
            'efecto_escritura_ia',
            'tamano_texto_chat',
            'mostrar_sugerencias_chat',
        ];

        foreach ($camposPermitidos as $campo) {
            if (array_key_exists($campo, $ajustes)) {
                $cruda[$campo] = $ajustes[$campo];
            }
        }

        $user->configuracion_ia = $cruda;
        $user->save();

        return $this->obtenerConfiguracionPublica($user);
    }

    /**
     * Resuelve el modelo, URL, API Key y parámetros de generación para un agente ('chat' o 'informes').
     */
    public function resolverCredencialesAgente(?User $user, string $agente = 'chat', array $overrides = []): array
    {
        $cruda = $this->obtenerConfiguracionCruda($user);

        $usarMismo = (bool) ($cruda['usar_mismo_modelo_agentes'] ?? true);
        $idSeleccionado = $overrides['modelo_id'] ?? null;

        if (! $idSeleccionado) {
            if ($usarMismo) {
                // Si el usuario no ha tocado su configuración, mantenemos los defaults históricos de cada controlador
                // o el modelo activo que haya seleccionado explícitamente.
                $tieneConfigUsuario = $user && is_array($user->configuracion_ia) && isset($user->configuracion_ia['modelo_activo_id']);
                if ($tieneConfigUsuario) {
                    $idSeleccionado = $cruda['modelo_activo_id'];
                } else {
                    $idSeleccionado = $agente === 'informes' ? 'qwen/qwen3.8-27b' : 'openai/gpt-oss-120b';
                }
            } else {
                $idSeleccionado = $agente === 'informes'
                    ? ($cruda['modelo_informes_id'] ?? 'qwen/qwen3.8-27b')
                    : ($cruda['modelo_chat_id'] ?? 'openai/gpt-oss-120b');
            }
        }

        // Buscar primero en los modelos personalizados del usuario
        $modeloPersonalizado = null;
        foreach ($cruda['modelos_personalizados'] ?? [] as $item) {
            if (($item['id'] ?? '') === $idSeleccionado || ($item['model_id'] ?? '') === $idSeleccionado) {
                $modeloPersonalizado = $item;
                break;
            }
        }

        if ($modeloPersonalizado && ! empty($modeloPersonalizado['api_key'])) {
            $proveedorId = $modeloPersonalizado['proveedor'] ?? 'groq';
            $proveedorInfo = self::PROVEEDORES[$proveedorId] ?? self::PROVEEDORES['custom'];
            $baseUrl = rtrim($modeloPersonalizado['base_url'] ?: $proveedorInfo['base_url'], '/');
            $apiKey = trim((string) $modeloPersonalizado['api_key']);
            $modelId = (string) $modeloPersonalizado['model_id'];
            $modeloIdInterno = (string) $modeloPersonalizado['id'];
            $modeloNombre = (string) ($modeloPersonalizado['nombre'] ?? $modelId);
            $proveedorNombre = $proveedorInfo['nombre'];
        } else {
            // Fallback seguro al motor institucional predeterminado (Groq .env)
            $proveedorId = 'groq';
            $modeloSistema = collect(self::MODELOS_SISTEMA)->firstWhere('id', $idSeleccionado);
            $modelId = $modeloSistema ? $modeloSistema['model_id'] : ($agente === 'informes' ? 'qwen/qwen3.8-27b' : 'openai/gpt-oss-120b');
            $modeloIdInterno = $modeloSistema ? $modeloSistema['id'] : $modelId;
            $modeloNombre = $modeloSistema ? $modeloSistema['nombre'] : ($modelId === 'qwen/qwen3.8-27b' ? 'Qwen 3.8 27B' : 'GPT-OSS 120B');
            $baseUrl = 'https://api.groq.com/openai/v1';
            $apiKey = trim((string) env('GROQ_API_KEY', ''));
            $proveedorNombre = 'Groq Cloud';
        }

        $headers = [
            'Authorization' => 'Bearer '.$apiKey,
            'Content-Type' => 'application/json',
        ];
        if ($proveedorId === 'anthropic') {
            $headers['x-api-key'] = $apiKey;
            $headers['anthropic-version'] = '2023-06-01';
        }

        $tono = $overrides['tono_ia'] ?? ($cruda['tono_ia'] ?? 'formal_decreto67');
        $extension = $overrides['extension_ia'] ?? ($cruda['extension_ia'] ?? 'equilibrada');
        $precision = $overrides['precision_ia'] ?? ($cruda['precision_ia'] ?? 'balanceado');
        $formatoVisual = $overrides['formato_visual_ia'] ?? ($cruda['formato_visual_ia'] ?? 'markdown');
        $instrucciones = trim((string) ($overrides['instrucciones_ia'] ?? ($cruda['instrucciones_ia'] ?? '')));

        $temperature = match ($precision) {
            'estricto' => 0.2,
            'dinamico' => 0.8,
            default => ($agente === 'informes' ? 0.4 : 0.5),
        };

        $maxTokens = match ($extension) {
            'breve' => 450,
            'detallada' => 1400,
            default => 850,
        };

        $instruccionTono = match ($tono) {
            'cercano_familia' => 'Utiliza un tono cálido, empático, constructivo y fácil de comprender para las familias y apoderados.',
            'ejecutivo_breve' => 'Utiliza un tono ejecutivo, sintético y enfocado en puntos accionables concretos.',
            default => 'Utiliza un tono institucional, riguroso y alineado al Decreto 67 de evaluación y acompañamiento pedagógico.',
        };

        $instruccionExtension = match ($extension) {
            'breve' => 'Sé conciso y directo (máximo 2 párrafos cortos o 4 puntos clave).',
            'detallada' => 'Desarrolla un análisis detallado y estructurado con pasos prácticos.',
            default => 'Mantén una extensión equilibrada y clara.',
        };

        return [
            'model' => $modelId,
            'modelo_id' => $modeloIdInterno,
            'modelo_nombre' => $modeloNombre,
            'proveedor' => $proveedorId,
            'base_url' => $baseUrl,
            'chat_url' => $baseUrl.'/chat/completions',
            'api_key' => $apiKey,
            'headers' => $headers,
            'proveedor_nombre' => $proveedorNombre,
            'temperature' => $temperature,
            'max_tokens' => $maxTokens,
            'tono' => $tono,
            'extension' => $extension,
            'precision' => $precision,
            'formato_visual' => $formatoVisual,
            'instrucciones_personalizadas' => $instrucciones,
            'instruccion_tono' => $instruccionTono,
            'instruccion_extension' => $instruccionExtension,
        ];
    }

    /**
     * Registra los tokens consumidos (usage) y la cuota restante (x-ratelimit-*) devueltos por el proveedor.
     */
    public function registrarConsumoYCuota(?User $user, array $credenciales, $response): array
    {
        $usage = $response->json('usage') ?? [];
        $promptTokens = (int) ($usage['prompt_tokens'] ?? $usage['input_tokens'] ?? 0);
        $completionTokens = (int) ($usage['completion_tokens'] ?? $usage['output_tokens'] ?? 0);
        $totalTokens = (int) ($usage['total_tokens'] ?? ($promptTokens + $completionTokens));

        $remRequests = $response->header('x-ratelimit-remaining-requests')
            ?: $response->header('anthropic-ratelimit-requests-remaining');
        $limRequests = $response->header('x-ratelimit-limit-requests')
            ?: $response->header('anthropic-ratelimit-requests-limit');
        $remTokens = $response->header('x-ratelimit-remaining-tokens')
            ?: $response->header('anthropic-ratelimit-tokens-remaining');
        $limTokens = $response->header('x-ratelimit-limit-tokens')
            ?: $response->header('anthropic-ratelimit-tokens-limit');
        $resetRequests = $response->header('x-ratelimit-reset-requests')
            ?: $response->header('anthropic-ratelimit-requests-reset');
        $resetTokens = $response->header('x-ratelimit-reset-tokens')
            ?: $response->header('anthropic-ratelimit-tokens-reset');

        $cuotaActual = [
            'remaining_requests' => is_numeric($remRequests) ? (int) $remRequests : null,
            'limit_requests' => is_numeric($limRequests) ? (int) $limRequests : null,
            'remaining_tokens' => is_numeric($remTokens) ? (int) $remTokens : null,
            'limit_tokens' => is_numeric($limTokens) ? (int) $limTokens : null,
            'reset_requests' => $resetRequests ?: null,
            'reset_tokens' => $resetTokens ?: null,
            'actualizado_en' => now()->toIso8601String(),
        ];

        if (! $user) {
            return [
                'tokens_consulta' => $totalTokens,
                'cuota' => $cuotaActual,
            ];
        }

        try {
            $cruda = $this->obtenerConfiguracionCruda($user);
            $metricas = is_array($cruda['metricas_consumo'] ?? null)
                ? $cruda['metricas_consumo']
                : [
                    'total_tokens' => 0,
                    'prompt_tokens' => 0,
                    'completion_tokens' => 0,
                    'total_consultas' => 0,
                    'ultima_consulta' => null,
                    'por_modelo' => [],
                ];

            $metricas['total_tokens'] = (int) ($metricas['total_tokens'] ?? 0) + $totalTokens;
            $metricas['prompt_tokens'] = (int) ($metricas['prompt_tokens'] ?? 0) + $promptTokens;
            $metricas['completion_tokens'] = (int) ($metricas['completion_tokens'] ?? 0) + $completionTokens;
            $metricas['total_consultas'] = (int) ($metricas['total_consultas'] ?? 0) + 1;

            $modeloId = (string) ($credenciales['modelo_id'] ?? $credenciales['model'] ?? 'desconocido');
            $modeloNombre = (string) ($credenciales['modelo_nombre'] ?? $modeloId);
            $proveedorNombre = (string) ($credenciales['proveedor_nombre'] ?? 'Groq Cloud');

            $metricas['ultima_consulta'] = [
                'tokens' => $totalTokens,
                'prompt_tokens' => $promptTokens,
                'completion_tokens' => $completionTokens,
                'modelo_id' => $modeloId,
                'modelo_nombre' => $modeloNombre,
                'proveedor' => $proveedorNombre,
                'fecha' => now()->toIso8601String(),
            ];

            $porModelo = is_array($metricas['por_modelo'] ?? null) ? $metricas['por_modelo'] : [];
            $actualModelo = $porModelo[$modeloId] ?? [
                'modelo_id' => $modeloId,
                'nombre' => $modeloNombre,
                'proveedor' => $proveedorNombre,
                'total_tokens' => 0,
                'prompt_tokens' => 0,
                'completion_tokens' => 0,
                'consultas' => 0,
                'cuota' => null,
            ];

            $actualModelo['nombre'] = $modeloNombre;
            $actualModelo['proveedor'] = $proveedorNombre;
            $actualModelo['total_tokens'] = (int) ($actualModelo['total_tokens'] ?? 0) + $totalTokens;
            $actualModelo['prompt_tokens'] = (int) ($actualModelo['prompt_tokens'] ?? 0) + $promptTokens;
            $actualModelo['completion_tokens'] = (int) ($actualModelo['completion_tokens'] ?? 0) + $completionTokens;
            $actualModelo['consultas'] = (int) ($actualModelo['consultas'] ?? 0) + 1;

            if (
                $cuotaActual['remaining_requests'] !== null
                || $cuotaActual['remaining_tokens'] !== null
                || ($actualModelo['cuota'] ?? null) === null
            ) {
                $actualModelo['cuota'] = $cuotaActual;
            }

            $porModelo[$modeloId] = $actualModelo;
            $metricas['por_modelo'] = $porModelo;

            $cruda['metricas_consumo'] = $metricas;
            $user->configuracion_ia = $cruda;
            $user->save();
        } catch (\Throwable) {
            // No bloquear la respuesta si falla el guardado de métricas
        }

        return [
            'tokens_consulta' => $totalTokens,
            'cuota' => $cuotaActual,
        ];
    }

    public function reiniciarMetricasConsumo(User $user): array
    {
        $cruda = $this->obtenerConfiguracionCruda($user);
        $cruda['metricas_consumo'] = [
            'total_tokens' => 0,
            'prompt_tokens' => 0,
            'completion_tokens' => 0,
            'total_consultas' => 0,
            'ultima_consulta' => null,
            'por_modelo' => [],
        ];
        $user->configuracion_ia = $cruda;
        $user->save();

        return $this->obtenerConfiguracionPublica($user);
    }
}
