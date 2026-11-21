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

export const MODELOS_GROQ_SISTEMA = [
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
    {
        id: 'openai/gpt-oss-20b',
        model_id: 'openai/gpt-oss-20b',
        nombre: 'GPT-OSS 20B',
        subtitulo: 'Groq · Consultas rápidas',
        proveedor: 'groq',
        proveedor_nombre: 'Groq Cloud',
        origen: 'sistema',
    },
];

export const PROVEEDORES_IA = [
    {
        id: 'groq',
        nombre: 'Groq Cloud',
        subtitulo: 'Free Key y Developer',
        placeholderKey: 'gsk_...',
        consoleUrl: 'https://console.groq.com/keys',
        consoleLabel: 'Groq Console',
        modelosSugeridos: [
            { id: 'openai/gpt-oss-120b', nombre: 'GPT-OSS 120B', etiqueta: 'Recomendado · $' },
            { id: 'openai/gpt-oss-20b', nombre: 'GPT-OSS 20B', etiqueta: 'Ultrarrápido · $' },
            { id: 'qwen/qwen3.8-27b', nombre: 'Qwen 3.8 27B', etiqueta: 'Informes · $$' },
        ],
    },
    {
        id: 'openai',
        nombre: 'OpenAI (ChatGPT)',
        subtitulo: 'Modelos GPT oficiales',
        placeholderKey: 'sk-...',
        consoleUrl: 'https://platform.openai.com/api-keys',
        consoleLabel: 'OpenAI Platform',
        modelosSugeridos: [
            { id: 'gpt-4.1-mini', nombre: 'GPT-4.1 Mini', etiqueta: 'Recomendado · $$' },
            { id: 'gpt-4o-mini', nombre: 'GPT-4o Mini', etiqueta: 'Económico · $' },
            { id: 'gpt-5-mini', nombre: 'GPT-5 Mini', etiqueta: 'Razonamiento · $$' },
            { id: 'gpt-4o', nombre: 'GPT-4o', etiqueta: 'Avanzado · $$$' },
        ],
    },
    {
        id: 'gemini',
        nombre: 'Google Gemini',
        subtitulo: 'Rápido · 1M contexto',
        placeholderKey: 'AIza...',
        consoleUrl: 'https://aistudio.google.com/apikey',
        consoleLabel: 'Google AI Studio',
        modelosSugeridos: [
            { id: 'gemini-2.5-flash', nombre: 'Gemini 2.5 Flash', etiqueta: 'Equilibrado · $$' },
            { id: 'gemini-2.5-flash-lite', nombre: 'Gemini 2.5 Flash-Lite', etiqueta: 'Económico · $' },
            { id: 'gemini-2.5-pro', nombre: 'Gemini 2.5 Pro', etiqueta: 'Avanzado · $$$' },
        ],
    },
    {
        id: 'openrouter',
        nombre: 'OpenRouter',
        subtitulo: 'Prepago · Multi-modelo',
        placeholderKey: 'sk-or-...',
        consoleUrl: 'https://openrouter.ai/keys',
        consoleLabel: 'OpenRouter',
        modelosSugeridos: [
            { id: 'openai/gpt-4.1-mini', nombre: 'GPT-4.1 Mini', etiqueta: 'Estable · $$' },
            { id: 'google/gemini-2.5-flash', nombre: 'Gemini 2.5 Flash', etiqueta: 'Rápido · $$' },
            { id: 'anthropic/claude-haiku-4-5', nombre: 'Claude Haiku 4.5', etiqueta: 'Redacción · $$' },
        ],
    },
    {
        id: 'anthropic',
        nombre: 'Anthropic Claude',
        subtitulo: 'Redacción avanzada',
        placeholderKey: 'sk-ant-...',
        consoleUrl: 'https://console.anthropic.com/settings/keys',
        consoleLabel: 'Anthropic Console',
        modelosSugeridos: [
            { id: 'claude-haiku-4-5', nombre: 'Claude Haiku 4.5', etiqueta: 'Rápido · $$' },
            { id: 'claude-sonnet-4-6', nombre: 'Claude Sonnet 4.6', etiqueta: 'Premium · $$$' },
        ],
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

export function estimarCostoMensualPlan(plan, docentes = 40, consultasPorDia = 5, diasHabiles = 20) {
    const consultasMes = Math.max(0, Number(docentes) || 0) * Math.max(0, Number(consultasPorDia) || 0) * diasHabiles;
    if (!plan || plan.categoria === 'gratuito') {
        return { consultasMes, usd: 0, clp: 0 };
    }
    const tokensEntradaMillones = (consultasMes * 2000) / 1_000_000;
    const tokensSalidaMillones = (consultasMes * 500) / 1_000_000;
    const usd =
        tokensEntradaMillones * (Number(plan.entrada_por_millon) || 0) +
        tokensSalidaMillones * (Number(plan.salida_por_millon) || 0);
    const usdRedondeado = Math.round(usd * 100) / 100;
    const clp = Math.round((usdRedondeado * 950) / 100) * 100;

    return { consultasMes, usd: usdRedondeado, clp };
}

export function formatearUsd(valor) {
    const num = Number(valor || 0);
    if (num === 0) return '$0';
    if (num < 0.01) return '< $0.01';
    return `$${num.toFixed(2)}`;
}

export function formatearClpAprox(clp) {
    const num = Number(clp || 0);
    if (num === 0) return '$0 CLP';
    return `~$${num.toLocaleString('es-CL')} CLP`;
}

export const PREFERENCIAS_DEFAULT = {
    paleta: 'css', // 'css' | 'dark'
    varianteOscura: 'carbon', // 'carbon' | 'ebano' | 'grafito' | 'oled' | 'pizarra'
    incluirFirmaWhatsapp: true,
    firmaWhatsapp: 'Colegio San Sebastián de Melipilla',
    criterioDefaultWhatsapp: 'auto', // 'auto' | 'alerta_academica' | 'citacion_entrevista' | 'reporte_avance' | 'reconocimiento'
    modeloActivoId: MODELOS_GROQ_SISTEMA[0].id,
    modeloActivoNombre: MODELOS_GROQ_SISTEMA[0].nombre,
    modeloActivoProveedor: MODELOS_GROQ_SISTEMA[0].proveedor_nombre,
    usarMismoModeloAgentes: true,
    modeloChatId: MODELOS_GROQ_SISTEMA[0].id,
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
        const preferencias = {
            ...PREFERENCIAS_DEFAULT,
            ...(parsed && typeof parsed === 'object' ? parsed : {}),
        };
        const modeloRetirado = 'llama-3.3-70b-versatile';
        if (preferencias.modeloActivoId === modeloRetirado) {
            preferencias.modeloActivoId = PREFERENCIAS_DEFAULT.modeloActivoId;
            preferencias.modeloActivoNombre = PREFERENCIAS_DEFAULT.modeloActivoNombre;
            preferencias.modeloActivoProveedor = PREFERENCIAS_DEFAULT.modeloActivoProveedor;
        }
        for (const campo of ['modeloChatId', 'modeloInformesId']) {
            if (preferencias[campo] === modeloRetirado) {
                preferencias[campo] = PREFERENCIAS_DEFAULT[campo];
            }
        }
        return preferencias;
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
