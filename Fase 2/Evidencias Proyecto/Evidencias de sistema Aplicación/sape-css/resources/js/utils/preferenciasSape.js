const STORAGE_KEY = 'sape_css_preferencias_v1';

export const VARIANTES_MODO_OSCURO = [
    {
        id: 'carbon',
        nombre: 'Carbón',
        corto: 'Carbón',
        subtitulo: 'Gris neutro oscuro',
        preview: {
            navBg: '#58120C',
            navAccent: '#E5E632',
            canvasBg: '#0D0E11',
            cardBg: '#15171C',
            elevatedBg: '#1E2028',
            cardBorder: '#2B2F3A',
            textPrimary: '#FFFFFF',
            textMuted: '#A1A8B8',
        },
    },
    {
        id: 'ebano',
        nombre: 'Ébano',
        corto: 'Ébano',
        subtitulo: 'Tono cálido burdeo',
        preview: {
            navBg: '#6E1710',
            navAccent: '#E5E632',
            canvasBg: '#120D0E',
            cardBg: '#1B1416',
            elevatedBg: '#261C1F',
            cardBorder: '#3B2A2F',
            textPrimary: '#FFFFFF',
            textMuted: '#CBB8BD',
        },
    },
    {
        id: 'grafito',
        nombre: 'Grafito',
        corto: 'Grafito',
        subtitulo: 'Gris mate suave',
        preview: {
            navBg: '#6E1710',
            navAccent: '#E5E632',
            canvasBg: '#181A1F',
            cardBg: '#21242B',
            elevatedBg: '#2B2F38',
            cardBorder: '#383D49',
            textPrimary: '#F8FAFC',
            textMuted: '#CBD5E1',
        },
    },
    {
        id: 'oled',
        nombre: 'Negro OLED',
        corto: 'OLED',
        subtitulo: 'Negro puro profundo',
        preview: {
            navBg: '#4A0F0A',
            navAccent: '#E5E632',
            canvasBg: '#050507',
            cardBg: '#0F1014',
            elevatedBg: '#181A20',
            cardBorder: '#262934',
            textPrimary: '#FFFFFF',
            textMuted: '#9CA3AF',
        },
    },
    {
        id: 'pizarra',
        nombre: 'Pizarra Azul',
        corto: 'Pizarra',
        subtitulo: 'Azul marino clásico',
        preview: {
            navBg: '#58120C',
            navAccent: '#E5E632',
            canvasBg: '#0B1120',
            cardBg: '#151F32',
            elevatedBg: '#1E293B',
            cardBorder: '#29384E',
            textPrimary: '#FFFFFF',
            textMuted: '#CBD5E1',
        },
    },
];

export const PROVEEDORES_IA = [
    {
        id: 'groq',
        nombre: 'Groq Cloud',
        subtitulo: 'Inferencia ultrarrápida',
        placeholderKey: 'gsk_...',
        modelosSugeridos: [
            { id: 'llama-3.3-70b-versatile', nombre: 'Llama 3.3 70B' },
            { id: 'openai/gpt-oss-120b', nombre: 'GPT-OSS 120B' },
            { id: 'qwen/qwen3.8-27b', nombre: 'Qwen 3.8 27B' },
            { id: 'deepseek-r1-distill-llama-70b', nombre: 'DeepSeek R1 70B' },
        ],
    },
    {
        id: 'openai',
        nombre: 'OpenAI',
        subtitulo: 'Modelos GPT oficiales',
        placeholderKey: 'sk-...',
        modelosSugeridos: [
            { id: 'gpt-4o-mini', nombre: 'GPT-4o Mini' },
            { id: 'gpt-4o', nombre: 'GPT-4o' },
            { id: 'gpt-4.1-mini', nombre: 'GPT-4.1 Mini' },
        ],
    },
    {
        id: 'gemini',
        nombre: 'Google Gemini',
        subtitulo: 'Modelos Gemini rápidos',
        placeholderKey: 'AIza...',
        modelosSugeridos: [
            { id: 'gemini-2.5-flash', nombre: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-pro', nombre: 'Gemini 2.5 Pro' },
        ],
    },
    {
        id: 'anthropic',
        nombre: 'Anthropic Claude',
        subtitulo: 'Modelos Claude oficiales',
        placeholderKey: 'sk-ant-...',
        modelosSugeridos: [
            { id: 'claude-3-7-sonnet-latest', nombre: 'Claude 3.7 Sonnet' },
            { id: 'claude-3-5-sonnet-latest', nombre: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-latest', nombre: 'Claude 3.5 Haiku' },
        ],
    },
    {
        id: 'openrouter',
        nombre: 'OpenRouter',
        subtitulo: 'Claude, DeepSeek y más',
        placeholderKey: 'sk-or-...',
        modelosSugeridos: [
            { id: 'anthropic/claude-3.5-sonnet', nombre: 'Claude 3.5 Sonnet' },
            { id: 'deepseek/deepseek-chat', nombre: 'DeepSeek V3' },
        ],
    },
];

export const MODELOS_GROQ_SISTEMA = [
    {
        id: 'llama-3.3-70b-versatile',
        model_id: 'llama-3.3-70b-versatile',
        nombre: 'Llama 3.3 70B',
        subtitulo: 'Groq · Equilibrado y veloz',
        proveedor: 'groq',
        proveedor_nombre: 'Groq Cloud',
        origen: 'sistema',
    },
    {
        id: 'openai/gpt-oss-120b',
        model_id: 'openai/gpt-oss-120b',
        nombre: 'GPT-OSS 120B',
        subtitulo: 'Groq · Razonamiento profundo',
        proveedor: 'groq',
        proveedor_nombre: 'Groq Cloud',
        origen: 'sistema',
    },
    {
        id: 'qwen/qwen3.8-27b',
        model_id: 'qwen/qwen3.8-27b',
        nombre: 'Qwen 3.8 27B',
        subtitulo: 'Groq · Redacción formal',
        proveedor: 'groq',
        proveedor_nombre: 'Groq Cloud',
        origen: 'sistema',
    },
];

export const OPCIONES_TONO_IA = [
    {
        id: 'formal_decreto67',
        titulo: 'Institucional Decreto 67',
        subtitulo: 'Formal para UTP y actas',
    },
    {
        id: 'cercano_familia',
        titulo: 'Cercano a la Familia',
        subtitulo: 'Empático para apoderados',
    },
    {
        id: 'ejecutivo_breve',
        titulo: 'Síntesis Ejecutiva',
        subtitulo: 'Directo en puntos clave',
    },
];

export const OPCIONES_EXTENSION_IA = [
    {
        id: 'breve',
        titulo: 'Breve',
        subtitulo: 'Respuestas cortas y rápidas',
    },
    {
        id: 'equilibrada',
        titulo: 'Equilibrada',
        subtitulo: 'Balance ideal de lectura',
    },
    {
        id: 'detallada',
        titulo: 'Detallada',
        subtitulo: 'Análisis paso a paso',
    },
];

export const OPCIONES_PRECISION_IA = [
    {
        id: 'estricto',
        titulo: 'Preciso',
        subtitulo: 'Datos y actas exactas',
    },
    {
        id: 'balanceado',
        titulo: 'Balanceado',
        subtitulo: 'Recomendado uso diario',
    },
    {
        id: 'dinamico',
        titulo: 'Dinámico',
        subtitulo: 'Más ideas y estrategias',
    },
];

export const OPCIONES_FORMATO_VISUAL_IA = [
    {
        id: 'markdown',
        titulo: 'Texto Enriquecido',
        subtitulo: 'Títulos, listas y negritas',
    },
    {
        id: 'texto_plano',
        titulo: 'Texto Plano',
        subtitulo: 'Limpio para copiar',
    },
];

export const OPCIONES_TAMANO_CHAT = [
    {
        id: 'normal',
        titulo: 'Estándar',
        subtitulo: 'Lectura compacta normal',
    },
    {
        id: 'amplio',
        titulo: 'Amplio',
        subtitulo: 'Letra grande en sala',
    },
];

export const PREFERENCIAS_DEFAULT = {
    paleta: 'css', // 'css' | 'dark'
    varianteOscura: 'carbon', // 'carbon' | 'ebano' | 'grafito' | 'oled' | 'pizarra'
    incluirFirmaWhatsapp: true,
    firmaWhatsapp: 'Colegio San Sebastián de Melipilla',
    criterioDefaultWhatsapp: 'auto', // 'auto' | 'alerta_academica' | 'citacion_entrevista' | 'reporte_avance' | 'reconocimiento'
    modeloActivoId: 'llama-3.3-70b-versatile',
    modeloActivoNombre: 'Llama 3.3 70B',
    modeloActivoProveedor: 'Groq Cloud',
    usarMismoModeloAgentes: true,
    modeloChatId: 'openai/gpt-oss-120b',
    modeloInformesId: 'qwen/qwen3.8-27b',
    tonoInformeIA: 'formal_decreto67', // 'formal_decreto67' | 'cercano_familia' | 'ejecutivo_breve'
    extensionIA: 'equilibrada', // 'breve' | 'equilibrada' | 'detallada'
    precisionIA: 'balanceado', // 'estricto' | 'balanceado' | 'dinamico'
    instruccionesIA: '',
    formatoVisualIA: 'markdown', // 'markdown' | 'texto_plano'
    efectoEscrituraIA: true,
    tamanoTextoChat: 'normal', // 'normal' | 'amplio'
    mostrarSugerenciasChat: true,
};

export function leerPreferenciasSape() {
    if (typeof window === 'undefined') {
        return { ...PREFERENCIAS_DEFAULT };
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...PREFERENCIAS_DEFAULT };
        const parsed = JSON.parse(raw);
        return {
            ...PREFERENCIAS_DEFAULT,
            ...(parsed && typeof parsed === 'object' ? parsed : {}),
        };
    } catch {
        return { ...PREFERENCIAS_DEFAULT };
    }
}

export function aplicarTemaDocumento(paleta = 'css', varianteOscura = 'carbon') {
    if (typeof document === 'undefined') return;
    const tema = paleta === 'dark' ? 'dark' : 'css';
    const varianteValida = VARIANTES_MODO_OSCURO.some((v) => v.id === varianteOscura)
        ? varianteOscura
        : 'carbon';
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.setAttribute('data-dark-variant', varianteValida);
    if (tema === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

export function guardarPreferenciasSape(nuevasPreferencias) {
    const actuales = leerPreferenciasSape();
    const actualizadas = {
        ...actuales,
        ...nuevasPreferencias,
    };

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizadas));
        } catch {
            // Ignorar errores de cuota en almacenamiento privado
        }
        aplicarTemaDocumento(actualizadas.paleta, actualizadas.varianteOscura);
        window.dispatchEvent(
            new CustomEvent('sape-preferences-changed', { detail: actualizadas })
        );
    }

    return actualizadas;
}

export function sincronizarPreferenciasDesdeServidor(configuracionIA) {
    if (!configuracionIA || typeof configuracionIA !== 'object') {
        return leerPreferenciasSape();
    }
    return guardarPreferenciasSape({
        modeloActivoId: configuracionIA.modelo_activo_id || PREFERENCIAS_DEFAULT.modeloActivoId,
        modeloActivoNombre:
            configuracionIA.modelo_activo_nombre || PREFERENCIAS_DEFAULT.modeloActivoNombre,
        modeloActivoProveedor:
            configuracionIA.modelo_activo_proveedor || PREFERENCIAS_DEFAULT.modeloActivoProveedor,
        usarMismoModeloAgentes:
            typeof configuracionIA.usar_mismo_modelo_agentes === 'boolean'
                ? configuracionIA.usar_mismo_modelo_agentes
                : PREFERENCIAS_DEFAULT.usarMismoModeloAgentes,
        modeloChatId: configuracionIA.modelo_chat_id || PREFERENCIAS_DEFAULT.modeloChatId,
        modeloInformesId:
            configuracionIA.modelo_informes_id || PREFERENCIAS_DEFAULT.modeloInformesId,
        tonoInformeIA: configuracionIA.tono_ia || PREFERENCIAS_DEFAULT.tonoInformeIA,
        extensionIA: configuracionIA.extension_ia || PREFERENCIAS_DEFAULT.extensionIA,
        precisionIA: configuracionIA.precision_ia || PREFERENCIAS_DEFAULT.precisionIA,
        instruccionesIA:
            typeof configuracionIA.instrucciones_ia === 'string'
                ? configuracionIA.instrucciones_ia
                : PREFERENCIAS_DEFAULT.instruccionesIA,
        formatoVisualIA:
            configuracionIA.formato_visual_ia || PREFERENCIAS_DEFAULT.formatoVisualIA,
        efectoEscrituraIA:
            typeof configuracionIA.efecto_escritura_ia === 'boolean'
                ? configuracionIA.efecto_escritura_ia
                : PREFERENCIAS_DEFAULT.efectoEscrituraIA,
        tamanoTextoChat:
            configuracionIA.tamano_texto_chat || PREFERENCIAS_DEFAULT.tamanoTextoChat,
        mostrarSugerenciasChat:
            typeof configuracionIA.mostrar_sugerencias_chat === 'boolean'
                ? configuracionIA.mostrar_sugerencias_chat
                : PREFERENCIAS_DEFAULT.mostrarSugerenciasChat,
    });
}

export function inicializarPreferenciasSape() {
    const prefs = leerPreferenciasSape();
    aplicarTemaDocumento(prefs.paleta, prefs.varianteOscura);
    return prefs;
}
