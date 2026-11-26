import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

const escaparRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const estadoNotaSemantica = (valor) => {
    if (valor < 4.0) return 'critico';
    if (valor < 4.8) return 'atencion';
    return 'optimo';
};

const clasePuntoEstado = (estado) => {
    if (estado === 'critico') return 'bg-red-600';
    if (estado === 'atencion') return 'bg-amber-500';
    return 'bg-emerald-600';
};

const claseChipAlumno = (estado) => {
    if (estado === 'critico') return 'bg-red-50 text-red-900 border-red-200 hover:border-red-400';
    if (estado === 'atencion') return 'bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-400';
    return 'bg-slate-100 text-slate-900 border-slate-200 hover:border-sape-burdeo';
};

/**
 * Decora cadenas de texto dentro del árbol Markdown destacando:
 * 1) Nombres de estudiantes del curso (píldoras interactivas con estado Decreto 67)
 * 2) Porcentajes (ej. 78.5%, 33%)
 * 3) Calificaciones en escala chilena 1.0 - 7.0 (con color semántico)
 */
const decorarTextoCadena = (texto, indiceEstudiantes, regexNombres, onClickEstudiante) => {
    if (!texto || typeof texto !== 'string') return texto;

    // 1. Dividir primero por nombres reales de estudiantes si hay coincidencias
    const segmentosPorNombre = regexNombres ? texto.split(regexNombres) : [texto];

    const nodos = [];
    segmentosPorNombre.forEach((seg, idxSeg) => {
        if (!seg) return;

        const keyLower = seg.toLowerCase();
        const matchEst = indiceEstudiantes.get(keyLower);
        if (matchEst) {
            const { estudiante, metricas } = matchEst;
            nodos.push(
                <button
                    key={`est-${idxSeg}-${estudiante.id}`}
                    type="button"
                    onClick={() => onClickEstudiante?.(estudiante)}
                    title={`Promedio ${metricas.promedioGeneral} · Ver ficha`}
                    className={`inline font-sans font-bold text-slate-900 underline underline-offset-4 decoration-2 transition-colors cursor-pointer ${
                        metricas.estado === 'critico'
                            ? 'decoration-red-500 hover:text-red-600'
                            : metricas.estado === 'atencion'
                              ? 'decoration-amber-500 hover:text-amber-600'
                              : 'decoration-emerald-500 hover:text-emerald-600'
                    }`}
                >
                    {seg}
                </button>
            );
            return;
        }

        // 2. Dentro del texto normal, resaltar porcentajes y notas decimales (1.0 a 7.0)
        const regexMetricas = /(\b\d{1,3}(?:[.,]\d)?%|\b(?:[1-6][.,]\d|7[.,]0)\b)/g;
        const partesMetricas = seg.split(regexMetricas);

        partesMetricas.forEach((parte, idxM) => {
            if (!parte) return;

            if (/^\d{1,3}(?:[.,]\d)?%$/.test(parte)) {
                const pctNum = parseFloat(parte.replace(',', '.'));
                const esBajoAsist = pctNum > 50 && pctNum < 85 && /asist|ausent|presen/i.test(seg);
                const clasePct = esBajoAsist
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-slate-100 text-slate-800 border-slate-200';
                nodos.push(
                    <span
                        key={`pct-${idxSeg}-${idxM}`}
                        data-sape-badge="pct"
                        className={`inline-flex items-center px-1.5 py-0 rounded-md border text-[0.9em] font-extrabold tabular-nums mx-0.5 ${clasePct}`}
                    >
                        {parte}
                    </span>
                );
                return;
            }

            if (/^(?:[1-6][.,]\d|7[.,]0)$/.test(parte)) {
                // Evitar resaltar números que son claramente versiones o puntos/horas (ej. "+0.3", "1.5 h")
                const anterior = partesMetricas[idxM - 1] || '';
                const siguiente = partesMetricas[idxM + 1] || '';
                const pareceDeltaODuracion =
                    /[+\-]$/.test(anterior.trim()) ||
                    /^\s*(puntos?|pts?|h\b|hora|horas|min|día|dias|semana|mes)/i.test(siguiente);

                if (pareceDeltaODuracion) {
                    nodos.push(parte);
                    return;
                }

                const notaNum = parseFloat(parte.replace(',', '.'));
                const estadoNota = estadoNotaSemantica(notaNum);
                nodos.push(
                    <span
                        key={`nota-${idxSeg}-${idxM}`}
                        data-sape-badge="nota"
                        data-estado={estadoNota}
                        className="sape-nota-inline"
                    >
                        {parte}
                    </span>
                );
                return;
            }

            nodos.push(parte);
        });
    });

    return nodos;
};

const decorarHijosReact = (children, indiceEstudiantes, regexNombres, onClickEstudiante) => {
    return React.Children.map(children, (child) => {
        if (typeof child === 'string') {
            return decorarTextoCadena(child, indiceEstudiantes, regexNombres, onClickEstudiante);
        }
        if (React.isValidElement(child) && child.props?.children) {
            if (
                child.type === 'button' ||
                child.type === 'style' ||
                child.props?.['data-sape-badge']
            ) {
                return child;
            }
            return React.cloneElement(child, {
                children: decorarHijosReact(
                    child.props.children,
                    indiceEstudiantes,
                    regexNombres,
                    onClickEstudiante
                ),
            });
        }
        return child;
    });
};

export default function TextoEnriquecidoChat({
    contenido,
    estudiantesDetectados = [],
    onClickEstudiante = null,
}) {
    const { indiceEstudiantes, regexNombres } = useMemo(() => {
        const mapa = new Map();
        const nombresParaRegex = [];

        estudiantesDetectados.forEach((item) => {
            const completo = item?.metricas?.nombreCompleto?.trim();
            if (completo && completo.length >= 5) {
                mapa.set(completo.toLowerCase(), item);
                nombresParaRegex.push(completo);
            }
            const nombres = String(item?.estudiante?.nombres || '').trim();
            const apellidos = String(item?.estudiante?.apellidos || '').trim();
            const corto =
                nombres.split(/\s+/)[0] && apellidos.split(/\s+/)[0]
                    ? `${nombres.split(/\s+/)[0]} ${apellidos.split(/\s+/)[0]}`
                    : '';
            if (corto && corto.length >= 6 && corto.toLowerCase() !== completo?.toLowerCase()) {
                mapa.set(corto.toLowerCase(), item);
                nombresParaRegex.push(corto);
            }
        });

        nombresParaRegex.sort((a, b) => b.length - a.length);
        const regex =
            nombresParaRegex.length > 0
                ? new RegExp(`(${nombresParaRegex.map(escaparRegex).join('|')})`, 'gi')
                : null;

        return { indiceEstudiantes: mapa, regexNombres: regex };
    }, [estudiantesDetectados]);

    return (
        <div className="space-y-3 leading-7">
            <ReactMarkdown
                disallowedElements={['img', 'a']}
                unwrapDisallowed
                components={{
                    h1: ({ node, ...props }) => (
                        <h1
                            className="font-extrabold text-lg text-slate-900 mt-5 mb-2 first:mt-0"
                            {...props}
                        />
                    ),
                    h2: ({ node, ...props }) => (
                        <h2
                            className="font-extrabold text-base text-slate-900 mt-5 mb-2 first:mt-0"
                            {...props}
                        />
                    ),
                    h3: ({ node, ...props }) => (
                        <h3
                            className="font-bold text-[15px] text-slate-900 mt-4 mb-1.5 first:mt-0"
                            {...props}
                        />
                    ),
                    strong: ({ node, children, ...props }) => (
                        <strong className="font-bold text-slate-900" {...props}>
                            {decorarHijosReact(children, indiceEstudiantes, regexNombres, onClickEstudiante)}
                        </strong>
                    ),
                    code: ({ node, children, ...props }) => (
                        <span className="font-sans" {...props}>
                            {decorarHijosReact(children, indiceEstudiantes, regexNombres, onClickEstudiante)}
                        </span>
                    ),
                    ul: ({ node, ...props }) => (
                        <ul
                            className="list-disc pl-6 space-y-1.5 my-2.5 marker:text-slate-400"
                            {...props}
                        />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol
                            className="list-decimal pl-6 space-y-1.5 my-2.5 marker:font-semibold marker:text-slate-500"
                            {...props}
                        />
                    ),
                    li: ({ node, children, ...props }) => (
                        <li className="pl-1 leading-7 text-slate-800" {...props}>
                            {decorarHijosReact(children, indiceEstudiantes, regexNombres, onClickEstudiante)}
                        </li>
                    ),
                    p: ({ node, children, ...props }) => (
                        <p className="mb-3 last:mb-0 leading-7 text-slate-800" {...props}>
                            {decorarHijosReact(children, indiceEstudiantes, regexNombres, onClickEstudiante)}
                        </p>
                    ),
                    blockquote: ({ node, children, ...props }) => (
                        <blockquote
                            className="my-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
                            {...props}
                        >
                            {decorarHijosReact(children, indiceEstudiantes, regexNombres, onClickEstudiante)}
                        </blockquote>
                    ),
                    hr: ({ node, ...props }) => <hr className="my-4 border-slate-200" {...props} />,
                }}
            >
                {contenido}
            </ReactMarkdown>
        </div>
    );
}
