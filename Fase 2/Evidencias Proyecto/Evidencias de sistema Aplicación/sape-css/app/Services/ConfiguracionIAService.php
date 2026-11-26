<?php

namespace App\Services;

use App\Models\ConfiguracionIAInstitucional;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ConfiguracionIAService
{
    public const MODELO_CHAT_DEFAULT = 'openai/gpt-oss-120b';

    private const MODELO_INFORMES_DEFAULT = 'qwen/qwen3.8-27b';

    private const MODELO_LLAMA_RETIRADO = 'llama-3.3-70b-versatile';

    public const MODELO_INSTITUCIONAL_ID = 'institucional';

    public const PROVEEDORES = [
        'groq' => [
            'id' => 'groq',
            'nombre' => 'Groq Cloud',
            'subtitulo' => 'Free Key y Developer',
            'base_url' => 'https://api.groq.com/openai/v1',
            'placeholder_key' => 'gsk_...',
            'console_url' => 'https://console.groq.com/keys',
        ],
        'openai' => [
            'id' => 'openai',
            'nombre' => 'OpenAI',
            'subtitulo' => 'ChatGPT API · Modelos GPT',
            'base_url' => 'https://api.openai.com/v1',
            'placeholder_key' => 'sk-...',
            'console_url' => 'https://platform.openai.com/api-keys',
        ],
        'gemini' => [
            'id' => 'gemini',
            'nombre' => 'Google Gemini',
            'subtitulo' => 'Modelos Gemini rápidos',
            'base_url' => 'https://generativelanguage.googleapis.com/v1beta/openai',
            'placeholder_key' => 'AIza...',
            'console_url' => 'https://aistudio.google.com/apikey',
        ],
        'openrouter' => [
            'id' => 'openrouter',
            'nombre' => 'OpenRouter',
            'subtitulo' => 'Multi-modelo prepago',
            'base_url' => 'https://openrouter.ai/api/v1',
            'placeholder_key' => 'sk-or-...',
            'console_url' => 'https://openrouter.ai/keys',
        ],
        'anthropic' => [
            'id' => 'anthropic',
            'nombre' => 'Anthropic Claude',
            'subtitulo' => 'Redacción avanzada',
            'base_url' => 'https://api.anthropic.com/v1',
            'placeholder_key' => 'sk-ant-...',
            'console_url' => 'https://console.anthropic.com/settings/keys',
        ],
        'custom' => [
            'id' => 'custom',
            'nombre' => 'Compatible OpenAI',
            'subtitulo' => 'Endpoint o proxy propio',
            'base_url' => 'https://api.openai.com/v1',
            'placeholder_key' => 'sk-...',
            'console_url' => '',
        ],
    ];

    public const MODELOS_SISTEMA = [
        [
            'id' => self::MODELO_CHAT_DEFAULT,
            'model_id' => self::MODELO_CHAT_DEFAULT,
            'nombre' => 'Análisis - Bajo gasto',
            'nombre_tecnico' => 'GPT-OSS 120B',
            'subtitulo' => 'Uso diario recomendado',
            'proveedor' => 'groq',
            'proveedor_nombre' => 'Groq Cloud',
            'origen' => 'sistema',
            'recomendado_para' => 'Copiloto Pedagógico',
        ],
        [
            'id' => self::MODELO_INFORMES_DEFAULT,
            'model_id' => self::MODELO_INFORMES_DEFAULT,
            'nombre' => 'Informes - Gasto medio',
            'nombre_tecnico' => 'Qwen 3.8 27B',
            'subtitulo' => 'Redacción formal',
            'proveedor' => 'groq',
            'proveedor_nombre' => 'Groq Cloud',
            'origen' => 'sistema',
            'recomendado_para' => 'Informes',
        ],
        [
            'id' => 'openai/gpt-oss-20b',
            'model_id' => 'openai/gpt-oss-20b',
            'nombre' => 'Rápido - Mínimo gasto',
            'nombre_tecnico' => 'GPT-OSS 20B',
            'subtitulo' => 'Consultas simples al instante',
            'proveedor' => 'groq',
            'proveedor_nombre' => 'Groq Cloud',
            'origen' => 'sistema',
            'recomendado_para' => 'Consultas rápidas',
        ],
    ];

    /**
     * Planes institucionales enfocados en Groq Free Key, Groq Developer y OpenAI (ChatGPT API),
     * más alternativas secundarias compatibles.
     */
    public const PLANES_COLEGIO = [
        'gratuito_groq' => [
            'id' => 'gratuito_groq',
            'nombre' => 'Groq Cloud · Free Key',
            'subtitulo' => 'Gratuito · Piloto escolar',
            'categoria' => 'gratuito',
            'principal' => true,
            'destacado' => false,
            'etiqueta' => 'Gratis · $0',
            'proveedor' => 'groq',
            'proveedor_nombre' => 'Groq Cloud',
            'console_url' => 'https://console.groq.com/keys',
            'modelo_chat_sugerido' => 'openai/gpt-oss-120b',
            'modelo_informes_sugerido' => 'openai/gpt-oss-120b',
            'entrada_por_millon' => 0.0,
            'salida_por_millon' => 0.0,
            'presupuesto_sugerido_usd' => 0.0,
            'solicitudes_diarias_sugeridas' => 900,
            'limites_resumen' => '~30 req/min · 1.000 req/día · 200K tokens/día',
            'privacidad' => 'Sin entrenamiento · Anonimizado por SAPE',
            'ideal_para' => 'Piloto inicial, pruebas y demostraciones',
        ],
        'pago_groq_developer' => [
            'id' => 'pago_groq_developer',
            'nombre' => 'Groq Cloud · Developer',
            'subtitulo' => 'Pago por uso · Ultrarrápido',
            'categoria' => 'pago',
            'principal' => true,
            'destacado' => true,
            'etiqueta' => 'Menor costo',
            'proveedor' => 'groq',
            'proveedor_nombre' => 'Groq Cloud',
            'console_url' => 'https://console.groq.com/keys',
            'modelo_chat_sugerido' => 'openai/gpt-oss-120b',
            'modelo_informes_sugerido' => 'openai/gpt-oss-120b',
            'entrada_por_millon' => 0.15,
            'salida_por_millon' => 0.60,
            'presupuesto_sugerido_usd' => 10.0,
            'solicitudes_diarias_sugeridas' => 5000,
            'limites_resumen' => '1.000+ req/min · 250K+ tokens/min · Spend Limits',
            'privacidad' => 'Pago por uso con tope · Anonimizado',
            'ideal_para' => 'Operación escolar completa al menor costo',
        ],
        'pago_openai' => [
            'id' => 'pago_openai',
            'nombre' => 'OpenAI · ChatGPT API',
            'subtitulo' => 'Pago por uso · GPT-4.1 / 4o Mini',
            'categoria' => 'pago',
            'principal' => true,
            'destacado' => true,
            'etiqueta' => 'Más estable',
            'proveedor' => 'openai',
            'proveedor_nombre' => 'OpenAI',
            'console_url' => 'https://platform.openai.com/api-keys',
            'modelo_chat_sugerido' => 'gpt-4.1-mini',
            'modelo_informes_sugerido' => 'gpt-4.1-mini',
            'entrada_por_millon' => 0.40,
            'salida_por_millon' => 1.60,
            'presupuesto_sugerido_usd' => 20.0,
            'solicitudes_diarias_sugeridas' => 5000,
            'limites_resumen' => 'Alta disponibilidad · Excelente español formal',
            'privacidad' => 'API comercial sin entrenamiento · Anonimizado',
            'ideal_para' => 'Consejos de evaluación e informes Decreto 67',
        ],
        'pago_gemini' => [
            'id' => 'pago_gemini',
            'nombre' => 'Google Gemini · Pago',
            'subtitulo' => 'Google Cloud · 1M contexto',
            'categoria' => 'pago',
            'principal' => false,
            'destacado' => false,
            'etiqueta' => 'Alternativa Google',
            'proveedor' => 'gemini',
            'proveedor_nombre' => 'Google Gemini',
            'console_url' => 'https://aistudio.google.com/apikey',
            'modelo_chat_sugerido' => 'gemini-2.5-flash',
            'modelo_informes_sugerido' => 'gemini-2.5-flash',
            'entrada_por_millon' => 0.30,
            'salida_por_millon' => 2.50,
            'presupuesto_sugerido_usd' => 20.0,
            'solicitudes_diarias_sugeridas' => 5000,
            'limites_resumen' => 'Ventana 1M tokens · Facturación Google Cloud',
            'privacidad' => 'Sin entrenamiento al activar pago',
            'ideal_para' => 'Colegios con ecosistema Google Workspace',
        ],
        'pago_openrouter' => [
            'id' => 'pago_openrouter',
            'nombre' => 'OpenRouter · Prepago',
            'subtitulo' => 'Créditos prepago · Multi-modelo',
            'categoria' => 'pago',
            'principal' => false,
            'destacado' => false,
            'etiqueta' => 'Sin sobregiro',
            'proveedor' => 'openrouter',
            'proveedor_nombre' => 'OpenRouter',
            'console_url' => 'https://openrouter.ai/keys',
            'modelo_chat_sugerido' => 'openai/gpt-4.1-mini',
            'modelo_informes_sugerido' => 'openai/gpt-4.1-mini',
            'entrada_por_millon' => 0.42,
            'salida_por_millon' => 1.69,
            'presupuesto_sugerido_usd' => 15.0,
            'solicitudes_diarias_sugeridas' => 5000,
            'limites_resumen' => 'Saldo prepago estricto · 1 clave, varios modelos',
            'privacidad' => 'Zero Data Retention (ZDR) configurable',
            'ideal_para' => 'Presupuesto cerrado sin tarjeta recurrente',
        ],
        'pago_anthropic' => [
            'id' => 'pago_anthropic',
            'nombre' => 'Anthropic · Claude',
            'subtitulo' => 'Redacción pedagógica avanzada',
            'categoria' => 'pago',
            'principal' => false,
            'destacado' => false,
            'etiqueta' => 'Premium',
            'proveedor' => 'anthropic',
            'proveedor_nombre' => 'Anthropic Claude',
            'console_url' => 'https://console.anthropic.com/settings/keys',
            'modelo_chat_sugerido' => 'claude-haiku-4-5',
            'modelo_informes_sugerido' => 'claude-sonnet-4-6',
            'entrada_por_millon' => 1.00,
            'salida_por_millon' => 5.00,
            'presupuesto_sugerido_usd' => 30.0,
            'solicitudes_diarias_sugeridas' => 4000,
            'limites_resumen' => 'Alta calidad en redacción formal',
            'privacidad' => 'API comercial sin entrenamiento',
            'ideal_para' => 'Informes extensos con mayor presupuesto',
        ],
    ];

    public const TARIFAS_MODELOS = [
        'openai/gpt-oss-120b' => [0.15, 0.60],
        'openai/gpt-oss-20b' => [0.075, 0.30],
        'qwen/qwen3.8-27b' => [0.80, 4.00],
        'gpt-4o-mini' => [0.15, 0.60],
        'gpt-4.1-mini' => [0.40, 1.60],
        'gpt-4.1-nano' => [0.10, 0.40],
        'gpt-5-mini' => [0.25, 2.00],
        'gpt-4o' => [2.50, 10.00],
        'gemini-2.5-flash-lite' => [0.10, 0.40],
        'gemini-2.5-flash' => [0.30, 2.50],
        'gemini-2.5-pro' => [1.25, 10.00],
        'claude-haiku-4-5' => [1.00, 5.00],
        'claude-3-5-haiku-latest' => [0.80, 4.00],
        'claude-sonnet-4-6' => [3.00, 15.00],
        'claude-sonnet-4-5' => [3.00, 15.00],
        'openai/gpt-4.1-mini' => [0.42, 1.69],
        'openai/gpt-4o-mini' => [0.16, 0.63],
        'google/gemini-2.5-flash' => [0.32, 2.64],
    ];

    public function configuracionPorDefecto(): array
    {
        return [
            'modelo_activo_id' => self::MODELO_CHAT_DEFAULT,
            'usar_mismo_modelo_agentes' => true,
            'modelo_chat_id' => self::MODELO_CHAT_DEFAULT,
            'modelo_informes_id' => self::MODELO_INFORMES_DEFAULT,
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

            $configuracion = array_merge($defecto, $guardada);
            foreach (['modelo_activo_id', 'modelo_chat_id', 'modelo_informes_id'] as $campo) {
                if ($configuracion[$campo] === self::MODELO_LLAMA_RETIRADO) {
                    $configuracion[$campo] = $defecto[$campo];
                }
            }

            return $configuracion;
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

    public function estimarCostoUsd(string $modelId, int $promptTokens, int $completionTokens, string $planActivo = ''): float
    {
        if ($planActivo === 'gratuito_groq') {
            return 0.0;
        }

        $tarifa = self::TARIFAS_MODELOS[$modelId] ?? null;
        if ($tarifa === null) {
            $lower = strtolower($modelId);
            foreach (self::TARIFAS_MODELOS as $clave => $valores) {
                if (str_contains($lower, strtolower($clave))) {
                    $tarifa = $valores;
                    break;
                }
            }
        }

        if ($tarifa === null) {
            $plan = self::PLANES_COLEGIO[$planActivo] ?? null;
            $tarifa = $plan
                ? [(float) $plan['entrada_por_millon'], (float) $plan['salida_por_millon']]
                : [0.25, 1.00];
        }

        $costo = (($promptTokens / 1_000_000) * $tarifa[0]) + (($completionTokens / 1_000_000) * $tarifa[1]);

        return round($costo, 6);
    }

    public function obtenerConfiguracionInstitucionalPublica(bool $incluirDetallesAdmin = false): array
    {
        $inst = ConfiguracionIAInstitucional::vigente();
        $envGroqKey = trim((string) config('services.ia.groq_api_key', ''));
        $claveBd = trim((string) ($inst?->api_key_cifrada ?? ''));
        $tieneClaveBd = $claveBd !== '';
        $tieneClaveEnv = $envGroqKey !== '';

        $planId = $inst && array_key_exists($inst->plan_activo, self::PLANES_COLEGIO)
            ? $inst->plan_activo
            : 'gratuito_groq';
        $planInfo = self::PLANES_COLEGIO[$planId];

        $proveedorId = $inst && array_key_exists($inst->proveedor, self::PROVEEDORES)
            ? $inst->proveedor
            : $planInfo['proveedor'];
        $proveedorInfo = self::PROVEEDORES[$proveedorId];

        $modeloChat = trim((string) ($inst?->modelo_chat ?? ''))
            ?: ($tieneClaveBd ? $planInfo['modelo_chat_sugerido'] : self::MODELO_CHAT_DEFAULT);
        $modeloInformes = trim((string) ($inst?->modelo_informes ?? ''))
            ?: ($tieneClaveBd ? $planInfo['modelo_informes_sugerido'] : self::MODELO_INFORMES_DEFAULT);

        $baseUrl = trim((string) ($inst?->base_url ?? '')) ?: $proveedorInfo['base_url'];
        $origen = $tieneClaveBd ? 'institucional_bd' : ($tieneClaveEnv ? 'servidor_env' : 'pendiente');

        $datos = [
            'configurada' => $tieneClaveBd || $tieneClaveEnv,
            'tiene_clave_bd' => $tieneClaveBd,
            'tiene_clave_env' => $tieneClaveEnv,
            'origen' => $origen,
            'plan_activo' => $planId,
            'plan_nombre' => $planInfo['nombre'],
            'plan_categoria' => $planInfo['categoria'],
            'proveedor' => $proveedorId,
            'proveedor_nombre' => $proveedorInfo['nombre'],
            'base_url' => $baseUrl,
            'modelo_chat' => $modeloChat,
            'modelo_informes' => $modeloInformes,
            'permitir_clave_personal_docentes' => $inst ? (bool) $inst->permitir_clave_personal_docentes : true,
            'solicitudes_diarias_limite' => $inst?->solicitudes_diarias_limite ?: (int) config('services.ia.solicitudes_diarias', 2000),
            'verificada_en' => $inst?->verificada_en?->toIso8601String(),
        ];

        if ($incluirDetallesAdmin) {
            $mesActual = now()->format('Y-m');
            $metricas = is_array($inst?->metricas_mensuales) ? $inst->metricas_mensuales : [];
            if (($metricas['mes'] ?? '') !== $mesActual) {
                $metricas = [
                    'mes' => $mesActual,
                    'total_consultas' => 0,
                    'prompt_tokens' => 0,
                    'completion_tokens' => 0,
                    'total_tokens' => 0,
                    'costo_estimado_usd' => 0.0,
                    'por_modelo' => [],
                ];
            }

            $presupuesto = $inst ? (float) $inst->presupuesto_mensual_usd : (float) $planInfo['presupuesto_sugerido_usd'];
            $alertaPct = $inst ? (int) $inst->alerta_porcentaje : 80;
            $costoMes = (float) ($metricas['costo_estimado_usd'] ?? 0.0);

            $datos['api_key_masked'] = $tieneClaveBd ? $this->enmascararApiKey($claveBd) : '';
            $datos['presupuesto_mensual_usd'] = $presupuesto;
            $datos['alerta_porcentaje'] = $alertaPct;
            $datos['metricas_mensuales'] = $metricas;
            $datos['estado_presupuesto'] = $this->evaluarEstadoPresupuesto($planInfo['categoria'], $costoMes, $presupuesto, $alertaPct);
        }

        return $datos;
    }

    public function evaluarEstadoPresupuesto(string $categoriaPlan, float $costoMesUsd, float $presupuestoUsd, int $alertaPct = 80): array
    {
        if ($categoriaPlan === 'gratuito' || $presupuestoUsd <= 0) {
            return [
                'porcentaje' => 0,
                'nivel' => 'gratuito',
                'mensaje' => 'Plan gratuito sin cobro por tokens.',
            ];
        }

        $porcentaje = round(($costoMesUsd / $presupuestoUsd) * 100, 1);

        if ($porcentaje >= 100) {
            return [
                'porcentaje' => $porcentaje,
                'nivel' => 'excedido',
                'mensaje' => 'El consumo estimado alcanzó el 100% del presupuesto mensual configurado.',
            ];
        }

        if ($porcentaje >= 90) {
            return [
                'porcentaje' => $porcentaje,
                'nivel' => 'critico',
                'mensaje' => 'Consumo cercano al tope mensual (90% o más). Revisa la consola del proveedor.',
            ];
        }

        if ($porcentaje >= max(50, $alertaPct)) {
            return [
                'porcentaje' => $porcentaje,
                'nivel' => 'aviso',
                'mensaje' => "Se superó el umbral de alerta ({$alertaPct}%) del presupuesto mensual.",
            ];
        }

        return [
            'porcentaje' => $porcentaje,
            'nivel' => 'normal',
            'mensaje' => 'Consumo dentro del presupuesto mensual del colegio.',
        ];
    }

    public function guardarConfiguracionInstitucional(User $admin, array $datos): array
    {
        $planId = array_key_exists($datos['plan_activo'] ?? '', self::PLANES_COLEGIO)
            ? (string) $datos['plan_activo']
            : 'gratuito_groq';
        $planInfo = self::PLANES_COLEGIO[$planId];

        $proveedorId = array_key_exists($datos['proveedor'] ?? '', self::PROVEEDORES)
            ? (string) $datos['proveedor']
            : $planInfo['proveedor'];
        $proveedorInfo = self::PROVEEDORES[$proveedorId];

        $baseUrl = ConexionIA::validarBaseUrl((string) (($datos['base_url'] ?? '') ?: $proveedorInfo['base_url']));
        $modeloChat = trim((string) ($datos['modelo_chat'] ?? '')) ?: $planInfo['modelo_chat_sugerido'];
        $modeloInformes = trim((string) ($datos['modelo_informes'] ?? '')) ?: $modeloChat;

        $inst = ConfiguracionIAInstitucional::query()->firstOrNew([
            'clave' => ConfiguracionIAInstitucional::CLAVE_PRINCIPAL,
        ]);

        $nuevaClave = trim((string) ($datos['api_key'] ?? ''));
        if (! empty($datos['limpiar_api_key'])) {
            $inst->api_key_cifrada = null;
        } elseif ($nuevaClave !== '') {
            $inst->api_key_cifrada = $nuevaClave;
        }

        $inst->plan_activo = $planId;
        $inst->proveedor = $proveedorId;
        $inst->base_url = $baseUrl;
        $inst->modelo_chat = Str::limit($modeloChat, 120, '');
        $inst->modelo_informes = Str::limit($modeloInformes, 120, '');

        if (array_key_exists('presupuesto_mensual_usd', $datos) && $datos['presupuesto_mensual_usd'] !== null) {
            $inst->presupuesto_mensual_usd = max(0, (float) $datos['presupuesto_mensual_usd']);
        } elseif (! $inst->exists) {
            $inst->presupuesto_mensual_usd = (float) $planInfo['presupuesto_sugerido_usd'];
        }

        if (array_key_exists('alerta_porcentaje', $datos) && $datos['alerta_porcentaje'] !== null) {
            $inst->alerta_porcentaje = min(100, max(10, (int) $datos['alerta_porcentaje']));
        }

        if (array_key_exists('solicitudes_diarias_limite', $datos) && $datos['solicitudes_diarias_limite'] !== null) {
            $inst->solicitudes_diarias_limite = max(100, min(50000, (int) $datos['solicitudes_diarias_limite']));
        } elseif (! $inst->exists) {
            $inst->solicitudes_diarias_limite = (int) $planInfo['solicitudes_diarias_sugeridas'];
        }

        if (array_key_exists('permitir_clave_personal_docentes', $datos) && $datos['permitir_clave_personal_docentes'] !== null) {
            $inst->permitir_clave_personal_docentes = (bool) $datos['permitir_clave_personal_docentes'];
        }

        if (! empty($datos['verificada'])) {
            $inst->verificada_en = now();
        }

        $inst->actualizado_por = $admin->id;
        $inst->save();

        return $this->obtenerConfiguracionInstitucionalPublica(true);
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
                'nombre' => (string) ($modelo['nombre'] ?? $this->nombreLegibleModelo((string) $modelo['model_id'])),
                'nombre_tecnico' => $this->nombreTecnicoModelo((string) $modelo['model_id']),
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
        $idsDisponibles = array_merge([self::MODELO_INSTITUCIONAL_ID], array_column($todosLosModelos, 'id'));

        $modeloActivoId = in_array($cruda['modelo_activo_id'], $idsDisponibles, true)
            ? $cruda['modelo_activo_id']
            : self::MODELO_CHAT_DEFAULT;

        $modeloChatId = in_array($cruda['modelo_chat_id'], $idsDisponibles, true)
            ? $cruda['modelo_chat_id']
            : self::MODELO_CHAT_DEFAULT;

        $modeloInformesId = in_array($cruda['modelo_informes_id'], $idsDisponibles, true)
            ? $cruda['modelo_informes_id']
            : self::MODELO_INFORMES_DEFAULT;

        $credencialActiva = $this->resolverCredencialesAgente($user, 'chat');
        $modeloActivoObj = collect($todosLosModelos)->firstWhere('id', $modeloActivoId);
        $nombreActivo = $modeloActivoObj['nombre'] ?? $credencialActiva['modelo_nombre'];
        $proveedorActivo = $modeloActivoObj['proveedor_nombre'] ?? $credencialActiva['proveedor_nombre'];

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

        $planActivoId = (string) ($credencialActiva['plan_activo'] ?? 'gratuito_groq');
        $planActivoInfo = self::PLANES_COLEGIO[$planActivoId] ?? self::PLANES_COLEGIO['gratuito_groq'];

        return [
            'modelo_activo_id' => $modeloActivoId,
            'modelo_activo_nombre' => $nombreActivo,
            'modelo_activo_proveedor' => $proveedorActivo,
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
            'conexion_activa' => [
                'configurada' => $credencialActiva['api_key'] !== '',
                'modelo' => $credencialActiva['model'],
                'modelo_id' => $credencialActiva['modelo_id'],
                'modelo_nombre' => $credencialActiva['modelo_nombre'],
                'modelo_tecnico' => $credencialActiva['modelo_tecnico'] ?? null,
                'modelo_etiqueta' => $credencialActiva['modelo_etiqueta'] ?? $credencialActiva['modelo_nombre'],
                'proveedor' => $credencialActiva['proveedor'],
                'proveedor_nombre' => $credencialActiva['proveedor_nombre'],
                'origen' => $credencialActiva['origen_credencial'],
                'plan_activo' => $planActivoId,
                'plan_nombre' => $credencialActiva['origen_credencial'] === 'personal'
                    ? 'Tu API Key personal'
                    : $planActivoInfo['nombre'],
            ],
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
        $nombre = trim((string) ($datos['nombre'] ?? '')) ?: $this->nombreLegibleModelo($modelId);
        $subtitulo = trim((string) ($datos['subtitulo'] ?? '')) ?: ($proveedorInfo['nombre'].' · Clave propia');
        $baseUrl = ConexionIA::validarBaseUrl(($datos['base_url'] ?? '') ?: $proveedorInfo['base_url']);
        $apiKey = trim((string) $datos['api_key']);

        $personalizados = is_array($cruda['modelos_personalizados'] ?? null)
            ? $cruda['modelos_personalizados']
            : [];

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
            $cruda['modelo_chat_id'] = $idUnico;
            $cruda['modelo_informes_id'] = $idUnico;
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

        $tieneInstitucional = trim((string) (ConfiguracionIAInstitucional::vigente()?->api_key_cifrada ?? '')) !== '';
        $fallbackChat = $tieneInstitucional ? self::MODELO_INSTITUCIONAL_ID : self::MODELO_CHAT_DEFAULT;
        $fallbackInformes = $tieneInstitucional ? self::MODELO_INSTITUCIONAL_ID : self::MODELO_INFORMES_DEFAULT;

        if (($cruda['modelo_activo_id'] ?? '') === $modeloId) {
            $cruda['modelo_activo_id'] = $fallbackChat;
        }
        if (($cruda['modelo_chat_id'] ?? '') === $modeloId) {
            $cruda['modelo_chat_id'] = $fallbackChat;
        }
        if (($cruda['modelo_informes_id'] ?? '') === $modeloId) {
            $cruda['modelo_informes_id'] = $fallbackInformes;
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
     * Prioridad:
     *   1) Modelo personal activo del usuario (si BYOK está permitido o es Administrador).
     *   2) Plan institucional cifrado en BD (configuracion_ia_institucional).
     *   3) Credencial de respaldo GROQ_API_KEY en config/services.php (.env).
     *   4) Respaldo automático a la clave personal guardada del usuario si no hay clave institucional.
     */
    public function resolverCredencialesAgente(?User $user, string $agente = 'chat', array $overrides = []): array
    {
        $cruda = $this->obtenerConfiguracionCruda($user);
        $inst = ConfiguracionIAInstitucional::vigente();
        $claveInstitucionalBd = trim((string) ($inst?->api_key_cifrada ?? ''));
        $tieneInstitucionalBd = $claveInstitucionalBd !== '';

        $usarMismo = (bool) ($cruda['usar_mismo_modelo_agentes'] ?? true);
        $modeloPredeterminado = $agente === 'informes' ? self::MODELO_INFORMES_DEFAULT : self::MODELO_CHAT_DEFAULT;
        $idSeleccionado = $overrides['modelo_id'] ?? null;

        if (! $idSeleccionado) {
            if ($usarMismo) {
                $tieneConfigUsuario = $user && is_array($user->configuracion_ia) && isset($user->configuracion_ia['modelo_activo_id']);
                $idSeleccionado = $tieneConfigUsuario ? $cruda['modelo_activo_id'] : $modeloPredeterminado;
            } else {
                $idSeleccionado = $agente === 'informes'
                    ? ($cruda['modelo_informes_id'] ?? self::MODELO_INFORMES_DEFAULT)
                    : ($cruda['modelo_chat_id'] ?? self::MODELO_CHAT_DEFAULT);
            }
        }

        if ($idSeleccionado === self::MODELO_LLAMA_RETIRADO) {
            $idSeleccionado = $modeloPredeterminado;
        }

        $esAdmin = $user && method_exists($user, 'hasRole') && $user->hasRole('Administrador');
        $puedeUsarClavePersonal = $user !== null && ($esAdmin || ($inst ? (bool) $inst->permitir_clave_personal_docentes : true));

        $modeloPersonalizado = null;
        if ($puedeUsarClavePersonal && $idSeleccionado !== self::MODELO_INSTITUCIONAL_ID) {
            foreach ($cruda['modelos_personalizados'] ?? [] as $item) {
                if (
                    ! empty($item['api_key'])
                    && (($item['id'] ?? '') === $idSeleccionado || ($item['model_id'] ?? '') === $idSeleccionado)
                ) {
                    $modeloPersonalizado = $item;
                    break;
                }
            }
        }

        $planActivo = $inst?->plan_activo ?: 'gratuito_groq';

        if ($modeloPersonalizado) {
            $proveedorId = $modeloPersonalizado['proveedor'] ?? 'groq';
            $proveedorInfo = self::PROVEEDORES[$proveedorId] ?? self::PROVEEDORES['custom'];
            $baseUrl = ConexionIA::validarBaseUrl(($modeloPersonalizado['base_url'] ?? '') ?: $proveedorInfo['base_url']);
            $apiKey = trim((string) $modeloPersonalizado['api_key']);
            $modelId = (string) $modeloPersonalizado['model_id'];
            $modeloIdInterno = (string) $modeloPersonalizado['id'];
            $modeloNombre = (string) ($modeloPersonalizado['nombre'] ?? $modelId);
            $proveedorNombre = $proveedorInfo['nombre'];
            $origenCredencial = 'personal';
        } elseif ($tieneInstitucionalBd) {
            $proveedorId = array_key_exists($inst->proveedor, self::PROVEEDORES) ? $inst->proveedor : 'groq';
            $proveedorInfo = self::PROVEEDORES[$proveedorId];
            $baseUrl = ConexionIA::validarBaseUrl((string) ($inst->base_url ?: $proveedorInfo['base_url']));
            $apiKey = $claveInstitucionalBd;
            $proveedorNombre = $proveedorInfo['nombre'];
            $origenCredencial = 'institucional_bd';

            $modeloInstitucional = $agente === 'informes'
                ? (trim((string) ($inst->modelo_informes ?? '')) ?: trim((string) ($inst->modelo_chat ?? '')))
                : trim((string) ($inst->modelo_chat ?? ''));

            if ($modeloInstitucional === '') {
                $planInfo = self::PLANES_COLEGIO[$planActivo] ?? self::PLANES_COLEGIO['gratuito_groq'];
                $modeloInstitucional = $agente === 'informes'
                    ? $planInfo['modelo_informes_sugerido']
                    : $planInfo['modelo_chat_sugerido'];
            }

            $modelosSistema = collect(self::MODELOS_SISTEMA);
            $coincideSistemaGroq = $proveedorId === 'groq'
                && $user !== null
                && $idSeleccionado !== self::MODELO_INSTITUCIONAL_ID
                && $modelosSistema->firstWhere('id', $idSeleccionado) !== null;

            if ($coincideSistemaGroq) {
                $modeloSistema = $modelosSistema->firstWhere('id', $idSeleccionado);
                $modelId = $modeloSistema['model_id'];
                $modeloIdInterno = $modeloSistema['id'];
                $modeloNombre = $modeloSistema['nombre'];
            } else {
                $modelId = $modeloInstitucional;
                $modeloIdInterno = self::MODELO_INSTITUCIONAL_ID;
                $modeloNombre = $this->nombreLegibleModelo($modeloInstitucional);
            }
        } else {
            $envApiKey = trim((string) config('services.ia.groq_api_key', ''));

            $respaldoPersonal = null;
            if ($envApiKey === '' && $puedeUsarClavePersonal) {
                $disponiblesUsuario = array_values(array_filter(
                    $cruda['modelos_personalizados'] ?? [],
                    fn ($m) => is_array($m) && ! empty($m['api_key']) && ! empty($m['model_id'])
                ));
                if ($disponiblesUsuario !== []) {
                    $respaldoPersonal = end($disponiblesUsuario);
                }
            }

            if ($respaldoPersonal) {
                $proveedorId = $respaldoPersonal['proveedor'] ?? 'groq';
                $proveedorInfo = self::PROVEEDORES[$proveedorId] ?? self::PROVEEDORES['custom'];
                $baseUrl = ConexionIA::validarBaseUrl(($respaldoPersonal['base_url'] ?? '') ?: $proveedorInfo['base_url']);
                $apiKey = trim((string) $respaldoPersonal['api_key']);
                $modelId = (string) $respaldoPersonal['model_id'];
                $modeloIdInterno = (string) $respaldoPersonal['id'];
                $modeloNombre = (string) ($respaldoPersonal['nombre'] ?? $modelId);
                $proveedorNombre = $proveedorInfo['nombre'];
                $origenCredencial = 'personal';
            } else {
                $proveedorId = 'groq';
                $modelosSistema = collect(self::MODELOS_SISTEMA);
                $modeloSistema = $modelosSistema->firstWhere('id', $idSeleccionado) ?? $modelosSistema->firstWhere('id', $modeloPredeterminado);
                $modelId = $modeloSistema['model_id'];
                $modeloIdInterno = $modeloSistema['id'];
                $modeloNombre = $modeloSistema['nombre'];
                $baseUrl = 'https://api.groq.com/openai/v1';
                $apiKey = $envApiKey;
                $proveedorNombre = 'Groq Cloud';
                $origenCredencial = $apiKey !== '' ? 'servidor_env' : 'ninguna';
            }
        }

        $headers = ProveedorIAAdapter::headers($proveedorId, $apiKey);

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

        $modeloTecnico = $this->nombreTecnicoModelo($modelId);
        $modeloEtiqueta = $this->etiquetaCompletaModelo($modelId, $modeloNombre);

        return [
            'model' => $modelId,
            'modelo_id' => $modeloIdInterno,
            'modelo_nombre' => $modeloNombre,
            'modelo_tecnico' => $modeloTecnico,
            'modelo_etiqueta' => $modeloEtiqueta,
            'proveedor' => $proveedorId,
            'base_url' => $baseUrl,
            'api_key' => $apiKey,
            'headers' => $headers,
            'proveedor_nombre' => $proveedorNombre,
            'origen_credencial' => $origenCredencial,
            'plan_activo' => $planActivo,
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

    public function nombreLegibleModelo(string $modelId): string
    {
        $catalogoNombres = [
            'openai/gpt-oss-120b' => 'Análisis - Bajo gasto',
            'openai/gpt-oss-20b' => 'Rápido - Mínimo gasto',
            'qwen/qwen3.8-27b' => 'Informes - Gasto medio',
            'llama-3.3-70b-versatile' => 'Respaldo General - Bajo gasto',
            'gpt-4.1-mini' => 'Equilibrado - Gasto medio',
            'gpt-4o-mini' => 'Rápido - Bajo gasto',
            'gpt-5-mini' => 'Análisis - Gasto medio',
            'gpt-4o' => 'Avanzado - Alto gasto',
            'gemini-2.5-flash' => 'Equilibrado - Gasto medio',
            'gemini-2.5-flash-lite' => 'Rápido - Mínimo gasto',
            'gemini-2.5-pro' => 'Análisis Profundo - Alto gasto',
            'openai/gpt-4.1-mini' => 'Equilibrado - Gasto medio',
            'google/gemini-2.5-flash' => 'Rápido - Gasto medio',
            'anthropic/claude-haiku-4-5' => 'Redacción - Gasto medio',
            'claude-haiku-4-5' => 'Redacción Ágil - Gasto medio',
            'claude-sonnet-4-6' => 'Redacción Premium - Alto gasto',
        ];

        return $catalogoNombres[$modelId] ?? $modelId;
    }

    public function nombreTecnicoModelo(string $modelId): ?string
    {
        $catalogoTecnico = [
            'openai/gpt-oss-120b' => 'GPT-OSS 120B',
            'openai/gpt-oss-20b' => 'GPT-OSS 20B',
            'qwen/qwen3.8-27b' => 'Qwen 3.8 27B',
            'llama-3.3-70b-versatile' => 'Llama 3.3 70B',
            'gpt-4.1-mini' => 'GPT-4.1 Mini',
            'gpt-4o-mini' => 'GPT-4o Mini',
            'gpt-5-mini' => 'GPT-5 Mini',
            'gpt-4o' => 'GPT-4o',
            'gemini-2.5-flash' => 'Gemini 2.5 Flash',
            'gemini-2.5-flash-lite' => 'Gemini 2.5 Flash-Lite',
            'gemini-2.5-pro' => 'Gemini 2.5 Pro',
            'openai/gpt-4.1-mini' => 'GPT-4.1 Mini',
            'google/gemini-2.5-flash' => 'Gemini 2.5 Flash',
            'anthropic/claude-haiku-4-5' => 'Claude Haiku 4.5',
            'claude-haiku-4-5' => 'Claude Haiku 4.5',
            'claude-sonnet-4-6' => 'Claude Sonnet 4.6',
        ];

        return $catalogoTecnico[$modelId] ?? ($modelId !== '' ? $modelId : null);
    }

    public function etiquetaCompletaModelo(string $modelId, ?string $nombreBase = null): string
    {
        $nombre = trim((string) ($nombreBase ?: $this->nombreLegibleModelo($modelId)));
        $tecnico = $this->nombreTecnicoModelo($modelId);

        if ($nombre === '') {
            return $tecnico ?? $modelId;
        }

        if (
            $tecnico === null
            || $tecnico === ''
            || strcasecmp($nombre, $tecnico) === 0
            || str_contains($nombre, "({$tecnico})")
        ) {
            return $nombre;
        }

        return "{$nombre} ({$tecnico})";
    }

    public function registrarConsumoYCuota(?User $user, array $credenciales, $response): array
    {
        $uso = ProveedorIAAdapter::extraerUso($response);
        $promptTokens = $uso['prompt_tokens'];
        $completionTokens = $uso['completion_tokens'];
        $totalTokens = $uso['total_tokens'];

        $encabezado = static function (string $nombre, string $alternativo) use ($response) {
            $valor = $response->header($nombre);

            return $valor === '' || $valor === null ? $response->header($alternativo) : $valor;
        };
        $remRequests = $encabezado('x-ratelimit-remaining-requests', 'anthropic-ratelimit-requests-remaining');
        $limRequests = $encabezado('x-ratelimit-limit-requests', 'anthropic-ratelimit-requests-limit');
        $remTokens = $encabezado('x-ratelimit-remaining-tokens', 'anthropic-ratelimit-tokens-remaining');
        $limTokens = $encabezado('x-ratelimit-limit-tokens', 'anthropic-ratelimit-tokens-limit');
        $resetRequests = $encabezado('x-ratelimit-reset-requests', 'anthropic-ratelimit-requests-reset');
        $resetTokens = $encabezado('x-ratelimit-reset-tokens', 'anthropic-ratelimit-tokens-reset');

        $cuotaActual = [
            'remaining_requests' => is_numeric($remRequests) ? (int) $remRequests : null,
            'limit_requests' => is_numeric($limRequests) ? (int) $limRequests : null,
            'remaining_tokens' => is_numeric($remTokens) ? (int) $remTokens : null,
            'limit_tokens' => is_numeric($limTokens) ? (int) $limTokens : null,
            'reset_requests' => $resetRequests ?: null,
            'reset_tokens' => $resetTokens ?: null,
            'actualizado_en' => now()->toIso8601String(),
        ];

        if (($credenciales['origen_credencial'] ?? '') === 'institucional_bd') {
            $this->registrarConsumoInstitucional($credenciales, $promptTokens, $completionTokens, $totalTokens);
        }

        if (! $user) {
            return [
                'tokens_consulta' => $totalTokens,
                'cuota' => $cuotaActual,
            ];
        }

        try {
            DB::transaction(function () use ($user, $cuotaActual, $totalTokens, $promptTokens, $completionTokens, $credenciales) {
                $user = User::query()->lockForUpdate()->findOrFail($user->id);
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
            });
        } catch (\Throwable) {
            // No bloquear la respuesta si falla el guardado de métricas
        }

        return [
            'tokens_consulta' => $totalTokens,
            'cuota' => $cuotaActual,
        ];
    }

    private function registrarConsumoInstitucional(array $credenciales, int $promptTokens, int $completionTokens, int $totalTokens): void
    {
        try {
            DB::transaction(function () use ($credenciales, $promptTokens, $completionTokens, $totalTokens) {
                $inst = ConfiguracionIAInstitucional::query()
                    ->where('clave', ConfiguracionIAInstitucional::CLAVE_PRINCIPAL)
                    ->lockForUpdate()
                    ->first();

                if (! $inst) {
                    return;
                }

                $mesActual = now()->format('Y-m');
                $metricas = is_array($inst->metricas_mensuales) ? $inst->metricas_mensuales : [];
                if (($metricas['mes'] ?? '') !== $mesActual) {
                    $metricas = [
                        'mes' => $mesActual,
                        'total_consultas' => 0,
                        'prompt_tokens' => 0,
                        'completion_tokens' => 0,
                        'total_tokens' => 0,
                        'costo_estimado_usd' => 0.0,
                        'por_modelo' => [],
                    ];
                }

                $modelId = (string) ($credenciales['model'] ?? 'desconocido');
                $costoConsulta = $this->estimarCostoUsd($modelId, $promptTokens, $completionTokens, (string) $inst->plan_activo);

                $metricas['total_consultas'] = (int) ($metricas['total_consultas'] ?? 0) + 1;
                $metricas['prompt_tokens'] = (int) ($metricas['prompt_tokens'] ?? 0) + $promptTokens;
                $metricas['completion_tokens'] = (int) ($metricas['completion_tokens'] ?? 0) + $completionTokens;
                $metricas['total_tokens'] = (int) ($metricas['total_tokens'] ?? 0) + $totalTokens;
                $metricas['costo_estimado_usd'] = round((float) ($metricas['costo_estimado_usd'] ?? 0.0) + $costoConsulta, 6);

                $porModelo = is_array($metricas['por_modelo'] ?? null) ? $metricas['por_modelo'] : [];
                $actual = $porModelo[$modelId] ?? [
                    'modelo' => $modelId,
                    'consultas' => 0,
                    'total_tokens' => 0,
                    'costo_estimado_usd' => 0.0,
                ];
                $actual['consultas'] = (int) ($actual['consultas'] ?? 0) + 1;
                $actual['total_tokens'] = (int) ($actual['total_tokens'] ?? 0) + $totalTokens;
                $actual['costo_estimado_usd'] = round((float) ($actual['costo_estimado_usd'] ?? 0.0) + $costoConsulta, 6);
                $porModelo[$modelId] = $actual;
                $metricas['por_modelo'] = $porModelo;

                $inst->metricas_mensuales = $metricas;
                $inst->save();
            });
        } catch (\Throwable) {
            // No bloquear la respuesta si falla el registro institucional
        }
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
