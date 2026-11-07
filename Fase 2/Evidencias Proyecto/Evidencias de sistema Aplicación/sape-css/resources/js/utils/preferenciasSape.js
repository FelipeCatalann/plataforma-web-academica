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

export const PREFERENCIAS_DEFAULT = {
    paleta: 'css', // 'css' | 'dark'
    varianteOscura: 'carbon', // 'carbon' | 'ebano' | 'grafito' | 'oled' | 'pizarra'
    incluirFirmaWhatsapp: true,
    firmaWhatsapp: 'Colegio San Sebastián de Melipilla',
    criterioDefaultWhatsapp: 'auto', // 'auto' | 'alerta_academica' | 'citacion_entrevista' | 'reporte_avance' | 'reconocimiento'
    tonoInformeIA: 'formal_decreto67', // 'formal_decreto67' | 'cercano_familia' | 'ejecutivo_breve'
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

export function inicializarPreferenciasSape() {
    const prefs = leerPreferenciasSape();
    aplicarTemaDocumento(prefs.paleta, prefs.varianteOscura);
    return prefs;
}
