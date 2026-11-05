import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { leerPreferenciasSape } from '@/utils/preferenciasSape';

const CRITERIOS_INSTITUCIONALES = [
    {
        id: 'alerta_academica',
        titulo: 'Alerta Académica Preventiva (Decreto 67)',
        descripcion: 'Cuando el estudiante presenta asignaturas bajo 4.0 o descenso de rendimiento.',
    },
    {
        id: 'citacion_entrevista',
        titulo: 'Citación a Entrevista con Profesor Jefe',
        descripcion: 'Para coordinar una reunión presencial o telefónica de seguimiento con la familia.',
    },
    {
        id: 'reporte_avance',
        titulo: 'Informativo de Avance Semestral',
        descripcion: 'Para compartir el promedio actual y mantener comunicación periódica con el hogar.',
    },
    {
        id: 'reconocimiento',
        titulo: 'Reconocimiento y Felicitación',
        descripcion: 'Para destacar el compromiso, esfuerzo o buen rendimiento académico del estudiante.',
    },
];

export default function ModalWhatsAppApoderado({
    estudiante,
    curso,
    profesorNombre,
    isOpen,
    onClose,
    onEnlaceGenerado,
}) {
    const [criterio, setCriterio] = useState('citacion_entrevista');
    const [telefono, setTelefono] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [urlGenerada, setUrlGenerada] = useState('');
    const [copiado, setCopiado] = useState(false);

    const abortControllerRef = useRef(null);
    const copyTimerRef = useRef(null);

    const cursoNombre = curso ? `${curso.nivel}° Medio ${curso.letra}` : 'su curso';
    const nombreDocente = profesorNombre || 'Profesor(a) Jefe';

    // Resumen académico automático del estudiante para preestructurar el mensaje
    const resumenAcademico = useMemo(() => {
        if (!estudiante || !Array.isArray(estudiante.calificaciones)) {
            return { promedioGeneral: null, asignaturasCriticas: [], mejoresAsignaturas: [] };
        }

        const porAsignatura = new Map();
        let sumaTotal = 0;
        let conteoTotal = 0;

        estudiante.calificaciones.forEach((cal) => {
            const valor = parseFloat(cal.valor || cal.evaluacion || cal.evaluación);
            if (!isNaN(valor) && valor > 0) {
                sumaTotal += valor;
                conteoTotal += 1;
                const nombreAsig = cal.asignatura_nombre || 'Asignatura';
                if (!porAsignatura.has(nombreAsig)) {
                    porAsignatura.set(nombreAsig, { suma: 0, count: 0 });
                }
                const actual = porAsignatura.get(nombreAsig);
                actual.suma += valor;
                actual.count += 1;
            }
        });

        const asignaturasCriticas = [];
        const mejoresAsignaturas = [];

        porAsignatura.forEach((datos, nombre) => {
            const prom = datos.suma / datos.count;
            if (prom < 4.0) {
                asignaturasCriticas.push(`${nombre} (${prom.toFixed(1)})`);
            } else if (prom >= 5.8) {
                mejoresAsignaturas.push(`${nombre} (${prom.toFixed(1)})`);
            }
        });

        return {
            promedioGeneral: conteoTotal > 0 ? (sumaTotal / conteoTotal).toFixed(1) : null,
            asignaturasCriticas,
            mejoresAsignaturas,
        };
    }, [estudiante]);

    const construirMensajePreestructurado = (criterioSeleccionado) => {
        if (!estudiante) return '';
        const nombreAlumno = `${estudiante.nombres || ''} ${estudiante.apellidos || ''}`.trim();
        const promTexto = resumenAcademico.promedioGeneral
            ? `${resumenAcademico.promedioGeneral}`
            : 'en evaluación';
        const detalleRojas =
            resumenAcademico.asignaturasCriticas.length > 0
                ? resumenAcademico.asignaturasCriticas.join(', ')
                : 'algunas evaluaciones recientes';
        const detalleDestacadas =
            resumenAcademico.mejoresAsignaturas.length > 0
                ? ` destacando especialmente en ${resumenAcademico.mejoresAsignaturas.slice(0, 2).join(' y ')}`
                : '';

        const prefs = leerPreferenciasSape();
        const pieFirma =
            prefs.incluirFirmaWhatsapp && prefs.firmaWhatsapp?.trim()
                ? `\n— ${prefs.firmaWhatsapp.trim()}`
                : '';

        switch (criterioSeleccionado) {
            case 'alerta_academica':
                return (
                    `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                    `Junto con saludar cordialmente, le escribe ${nombreDocente}, Profesor(a) Jefe de ${cursoNombre}. ` +
                    `Me comunico con usted en el marco de nuestro seguimiento pedagógico preventivo, ya que actualmente ${estudiante.nombres} registra un promedio general de ${promTexto} y requiere reforzar ${detalleRojas}.\n\n` +
                    `Para nosotros es fundamental trabajar en conjunto con la familia a tiempo. ¿En qué horario podríamos coordinar una breve entrevista presencial o telefónica esta semana?\n\n` +
                    `Quedo atento(a) a su confirmación. Muchas gracias.${pieFirma}`
                );

            case 'citacion_entrevista':
                return (
                    `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                    `Junto con saludar cordialmente, le escribe ${nombreDocente}, Profesor(a) Jefe de ${cursoNombre}. ` +
                    `Me gustaría citarle a una breve entrevista de seguimiento escolar para conversar sobre el proceso académico y formativo de ${estudiante.nombres} durante este semestre.\n\n` +
                    `Por favor, coménteme su disponibilidad dentro de los próximos días para agendar nuestra reunión.\n\n` +
                    `Saludos cordiales.${pieFirma}`
                );

            case 'reporte_avance':
                return (
                    `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                    `Le saluda cordialmente ${nombreDocente}, Profesor(a) Jefe de ${cursoNombre}. ` +
                    `Le escribo para informarle que, a la fecha, ${estudiante.nombres} mantiene un promedio general de ${promTexto} en sus calificaciones registradas${
                        resumenAcademico.asignaturasCriticas.length > 0
                            ? `, con atención prioritaria en ${detalleRojas}`
                            : ''
                    }.\n\n` +
                    `Cualquier duda o consulta sobre su avance pedagógico, quedo a su entera disposición. Saludos cordiales.${pieFirma}`
                );

            case 'reconocimiento':
                return (
                    `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                    `Le saluda con mucho agrado ${nombreDocente}, Profesor(a) Jefe de ${cursoNombre}. ` +
                    `Quiero felicitar a ${estudiante.nombres} y a su familia por su positivo desempeño escolar, alcanzando un promedio general de ${promTexto}${detalleDestacadas}.\n\n` +
                    `Le invito a seguir motivando este excelente compromiso. ¡Un cordial saludo!${pieFirma}`
                );

            default:
                return '';
        }
    };

    useEffect(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
            copyTimerRef.current = null;
        }

        if (isOpen && estudiante) {
            const prefs = leerPreferenciasSape();
            const criterioInicial =
                prefs.criterioDefaultWhatsapp && prefs.criterioDefaultWhatsapp !== 'auto'
                    ? prefs.criterioDefaultWhatsapp
                    : resumenAcademico.asignaturasCriticas.length > 0
                      ? 'alerta_academica'
                      : 'citacion_entrevista';

            setCriterio(criterioInicial);
            setTelefono(estudiante.apoderado_telefono || '+569');
            setMensaje(construirMensajePreestructurado(criterioInicial));
            setError('');
            setUrlGenerada('');
            setCopiado(false);
            setCargando(false);
        }

        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        };
    }, [isOpen, estudiante?.id]);

    // Cerrar con tecla Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !cargando) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, cargando, onClose]);

    const cambiarCriterio = (nuevoCriterio) => {
        setCriterio(nuevoCriterio);
        setMensaje(construirMensajePreestructurado(nuevoCriterio));
        setUrlGenerada('');
        setError('');
    };

    const prepararYAbrirWhatsApp = async () => {
        if (cargando) return;

        const soloDigitos = (telefono || '').replace(/\D/g, '');
        if (soloDigitos.length < 8 || soloDigitos.length > 15) {
            setError('Ingresa un número telefónico válido (por ejemplo: +56912345678).');
            return;
        }
        if (!mensaje.trim()) {
            setError('El mensaje para el apoderado no puede estar vacío.');
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setCargando(true);
        setError('');

        try {
            const respuesta = await axios.post(
                '/enlaces-whatsapp',
                {
                    estudiante_id: estudiante.id,
                    curso_id: curso.id,
                    telefono: telefono.trim(),
                    mensaje: mensaje.trim(),
                    criterio: criterio,
                },
                { signal: controller.signal }
            );

            if (respuesta.data.success && respuesta.data.url) {
                setUrlGenerada(respuesta.data.url);
                if (onEnlaceGenerado) {
                    onEnlaceGenerado(estudiante.id, respuesta.data.enlace, telefono.trim());
                }
                window.open(respuesta.data.url, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            if (axios.isCancel(err) || err.name === 'CanceledError') return;
            const msg =
                err.response?.data?.errors?.telefono?.[0] ||
                err.response?.data?.errors?.mensaje?.[0] ||
                err.response?.data?.message ||
                'No se pudo preparar el enlace de WhatsApp. Verifica el teléfono y tu conexión.';
            setError(msg);
        } finally {
            if (abortControllerRef.current === controller) {
                setCargando(false);
            }
        }
    };

    const copiarMensaje = async () => {
        if (!mensaje.trim()) return;
        try {
            await navigator.clipboard.writeText(mensaje);
            setCopiado(true);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopiado(false), 2500);
        } catch {
            setError('Tu navegador bloqueó el copiado automático. Selecciona el texto y presiona Ctrl+C.');
        }
    };

    if (!isOpen || !estudiante) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && !cargando) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-whatsapp-titulo"
                className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
            >
                {/* CABECERA */}
                <div className="bg-sape-burdeo px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <h2 id="modal-whatsapp-titulo" className="text-sape-amarillo text-lg font-bold leading-tight truncate">
                                Mensajería Personal a Apoderado (WhatsApp)
                            </h2>
                            <p className="text-white/85 text-xs truncate">
                                Prepara un mensaje revisable para abrir en tu WhatsApp Web o App móvil (sin bots ni cobros por API)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={cargando}
                        aria-label="Cerrar modal de WhatsApp"
                        className="text-white/80 hover:text-sape-amarillo p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* CUERPO DEL MODAL */}
                <div className="p-6 overflow-y-auto bg-slate-50 flex-grow space-y-5">
                    {/* FICHA RESUMEN DEL ESTUDIANTE Y APODERADO */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 break-words">
                                {estudiante.nombres} {estudiante.apellidos}
                            </h3>
                            <p className="text-xs text-slate-600 font-mono mt-0.5 tabular-nums">
                                ID/RUT: {estudiante.run || estudiante.identificadorInterno || 'Sin Registro'} • Curso: {cursoNombre}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center shrink-0">
                            <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-center">
                                <span className="block text-[10px] uppercase text-slate-600 font-bold">
                                    Promedio Gral.
                                </span>
                                <span
                                    className={`text-sm font-extrabold tabular-nums ${
                                        resumenAcademico.promedioGeneral &&
                                        parseFloat(resumenAcademico.promedioGeneral) < 4.0
                                            ? 'text-red-600'
                                            : 'text-sape-burdeo'
                                    }`}
                                >
                                    {resumenAcademico.promedioGeneral || '-'}
                                </span>
                            </div>

                            {resumenAcademico.asignaturasCriticas.length > 0 ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold tabular-nums">
                                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                    {resumenAcademico.asignaturasCriticas.length} asig. bajo 4.0
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                    Sin promedios críticos
                                </span>
                            )}
                        </div>
                    </div>

                    {/* PASO 1: TELÉFONO DEL APODERADO Y CRITERIO INSTITUCIONAL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <label htmlFor="wa-telefono-apoderado" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                1. Teléfono WhatsApp del Apoderado
                            </label>
                            <input
                                id="wa-telefono-apoderado"
                                type="tel"
                                maxLength={20}
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                placeholder="+56912345678"
                                className="w-full border-slate-300 rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo font-mono text-sm text-slate-800"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Cargado desde Nómina Syscol. Puedes editarlo si el apoderado actualizó su número.
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <label htmlFor="wa-criterio-seguimiento" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                2. Criterio Institucional de Seguimiento
                            </label>
                            <select
                                id="wa-criterio-seguimiento"
                                value={criterio}
                                onChange={(e) => cambiarCriterio(e.target.value)}
                                className="w-full border-slate-300 rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo text-sm font-medium text-slate-800"
                            >
                                {CRITERIOS_INSTITUCIONALES.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.titulo}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">
                                {CRITERIOS_INSTITUCIONALES.find((c) => c.id === criterio)?.descripcion}
                            </p>
                        </div>
                    </div>

                    {/* PASO 2: REVISIÓN Y EDICIÓN DEL MENSAJE PREESTRUCTURADO */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="wa-mensaje-editable" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                3. Mensaje Preestructurado (Revisable y Editable por el Profesor Jefe)
                            </label>
                            <button
                                type="button"
                                onClick={() => setMensaje(construirMensajePreestructurado(criterio))}
                                className="text-xs text-sape-burdeo hover:underline font-semibold"
                            >
                                Restaurar plantilla
                            </button>
                        </div>

                        <textarea
                            id="wa-mensaje-editable"
                            value={mensaje}
                            maxLength={2000}
                            onChange={(e) => setMensaje(e.target.value)}
                            rows={6}
                            className="w-full border-slate-300 rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo text-sm text-slate-800 leading-relaxed"
                            placeholder="Escribe o ajusta el mensaje para el apoderado..."
                        />

                        <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                            <span>
                                Puedes ajustar cualquier detalle antes de abrir WhatsApp. El mensaje no se envía solo.
                            </span>
                            <span className="font-mono tabular-nums">{mensaje.length} / 2000 caracteres</span>
                        </div>
                    </div>

                    {/* VISTA PREVIA ESTILO WHATSAPP */}
                    <div className="bg-[#EFEAE2] p-4 rounded-xl border border-slate-300 shadow-inner">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Vista Previa en WhatsApp ({telefono || 'Sin número'})
                            </span>
                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md font-semibold">
                                Envío directo sin bot (Click-to-Chat wa.me)
                            </span>
                        </div>
                        <div className="bg-[#D9FDD3] text-slate-900 p-3.5 rounded-lg rounded-tr-none shadow-sm text-xs whitespace-pre-wrap break-words leading-relaxed max-w-2xl ml-auto border border-emerald-200">
                            {mensaje || '(El mensaje aparecerá aquí)'}
                        </div>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-start gap-2.5 text-sm"
                        >
                            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="min-w-0">
                                <p className="font-bold text-red-900">Atención</p>
                                <p className="text-red-700 break-words">{error}</p>
                            </div>
                        </div>
                    )}

                    {urlGenerada && (
                        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                            <div>
                                <p className="font-bold">Enlace de WhatsApp preparado y registrado en bitácora</p>
                                <p className="text-xs text-emerald-700">
                                    Si tu navegador bloqueó la ventana emergente, usa el botón directo:
                                </p>
                            </div>
                            <a
                                href={urlGenerada}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-xs whitespace-nowrap"
                            >
                                <span>Abrir WhatsApp Ahora</span>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    )}
                </div>

                {/* PIE DEL MODAL */}
                <div className="bg-white px-6 py-4 flex flex-wrap justify-between items-center gap-3 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={copiarMensaje}
                        className="bg-slate-100 text-slate-700 font-semibold px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-200 transition-colors text-sm inline-flex items-center gap-2"
                    >
                        {copiado ? (
                            <>
                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Mensaje copiado</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Copiar solo texto</span>
                            </>
                        )}
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white text-slate-700 font-bold px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors text-sm"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            disabled={cargando || !mensaje.trim() || !telefono.trim()}
                            onClick={prepararYAbrirWhatsApp}
                            className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
                        >
                            {cargando ? (
                                <span>Preparando enlace...</span>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    <span>Abrir en WhatsApp (Web / Celular)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

