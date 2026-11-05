const STORAGE_KEY = 'sape_css_preferencias_v1';

export const PREFERENCIAS_DEFAULT = {
    paleta: 'css', // 'css' | 'dark'
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

export function aplicarTemaDocumento(paleta = 'css') {
    if (typeof document === 'undefined') return;
    const tema = paleta === 'dark' ? 'dark' : 'css';
    document.documentElement.setAttribute('data-theme', tema);
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
        aplicarTemaDocumento(actualizadas.paleta);
        window.dispatchEvent(
            new CustomEvent('sape-preferences-changed', { detail: actualizadas })
        );
    }

    return actualizadas;
}

export function inicializarPreferenciasSape() {
    const prefs = leerPreferenciasSape();
    aplicarTemaDocumento(prefs.paleta);
    return prefs;
}
