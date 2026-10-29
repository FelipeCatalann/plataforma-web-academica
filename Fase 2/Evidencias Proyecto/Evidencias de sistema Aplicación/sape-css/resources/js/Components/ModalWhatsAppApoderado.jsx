import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const CRITERIOS_INSTITUCIONALES = [
    {
        id: 'alerta_academica',
        titulo: '⚠️ Alerta Académica Preventiva (Decreto 67)',
        descripcion: 'Cuando el estudiante presenta asignaturas bajo 4.0 o descenso de rendimiento.',
    },
    {
        id: 'citacion_entrevista',
        titulo: '📅 Citación a Entrevista con Profesor Jefe',
        descripcion: 'Para coordinar una reunión presencial o telefónica de seguimiento con la familia.',
    },
    {
        id: 'reporte_avance',
        titulo: '📊 Informativo de Avance Semestral',
        descripcion: 'Para compartir el promedio actual y mantener comunicación periódica con el hogar.',
    },
    {
        id: 'reconocimiento',
        titulo: '🌟 Reconocimiento y Felicitación',
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
        const nombreAlumno = `${estudiante.nombres} ${estudiante.apellidos}`.trim();
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

        switch (criterioSeleccionado) {
            case 'alerta_academica':
                return (
                    `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                    `Junto con saludar cordialmente, le escribe ${nombreDocente}, Profesor(a) Jefe de ${cursoNombre}. ` +
                    `Me comunico con usted en el marco de nuestro seguimiento pedagógico preventivo, ya que actualmente ${estudiante.nombres} registra un promedio general de ${promTexto} y requiere reforzar ${detalleRojas}.\n\n` +
                    `Para nosotros es fundamental trabajar en conjunto con la familia a tiempo. ¿En qué horario podríamos coordinar una breve entrevista presencial o telefónica esta semana?\n\n` +
                    `Quedo atento(a) a su confirmación. Muchas gracias.`
                );

            case 'citacion_entrevista':
                return (
                    `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                    `Junto con saludar cordialmente, le escribe ${nombreDocente}, Profesor(a) Jefe de ${cursoNombre}. ` +
                    `Me gustaría citarle a una breve entrevista de seguimiento escolar para conversar sobre el proceso académico y formativo de ${estudiante.nombres} durante este semestre.\n\n` +
                    `Por favor, coménteme su disponibilidad dentro de los próximos días para agendar nuestra reunión.\n\n` +
                    `Saludos cordiales.`
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
                    `Cualquier duda o consulta sobre su avance pedagógico, quedo a su entera disposición. Saludos cordiales.`
                );

            case 'reconocimiento':
                return (
                    `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                    `Le saluda con mucho agrado ${nombreDocente}, Profesor(a) Jefe de ${cursoNombre}. ` +
                    `Quiero felicitar a ${estudiante.nombres} y a su familia por su positivo desempeño escolar, alcanzando un promedio general de ${promTexto}${detalleDestacadas}.\n\n` +
                    `Le invito a seguir motivando este excelente compromiso. ¡Un cordial saludo!`
                );

            default:
                return '';
        }
    };

    useEffect(() => {
        if (isOpen && estudiante) {
            const criterioInicial =
                resumenAcademico.asignaturasCriticas.length > 0
                    ? 'alerta_academica'
                    : 'citacion_entrevista';

            setCriterio(criterioInicial);
            setTelefono(estudiante.apoderado_telefono || '+569');
            setMensaje(construirMensajePreestructurado(criterioInicial));
            setError('');
            setUrlGenerada('');
            setCopiado(false);
        }
    }, [isOpen, estudiante]);

    const cambiarCriterio = (nuevoCriterio) => {
        setCriterio(nuevoCriterio);
        setMensaje(construirMensajePreestructurado(nuevoCriterio));
        setUrlGenerada('');
    };

    const prepararYAbrirWhatsApp = async () => {
        setCargando(true);
        setError('');

        try {
            const respuesta = await axios.post('/enlaces-whatsapp', {
                estudiante_id: estudiante.id,
                curso_id: curso.id,
                telefono: telefono,
                mensaje: mensaje,
                criterio: criterio,
            });

            if (respuesta.data.success && respuesta.data.url) {
                setUrlGenerada(respuesta.data.url);
                if (onEnlaceGenerado) {
                    onEnlaceGenerado(estudiante.id, respuesta.data.enlace, telefono);
                }
                window.open(respuesta.data.url, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            const msg =
                err.response?.data?.errors?.telefono?.[0] ||
                err.response?.data?.errors?.mensaje?.[0] ||
                err.response?.data?.message ||
                'No se pudo preparar el enlace de WhatsApp. Verifica el teléfono y el mensaje.';
            setError(msg);
        } finally {
            setCargando(false);
        }
    };

    if (!isOpen || !estudiante) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* CABECERA */}
                <div className="bg-sape-burdeo px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="bg-emerald-500 text-white p-2 rounded-lg shadow-sm font-bold text-lg">
                            💬
                        </span>
                        <div>
                            <h2 className="text-sape-amarillo text-lg font-bold leading-tight">
                                Mensajería Personal a Apoderado (WhatsApp)
                            </h2>
                            <p className="text-white/80 text-xs">
                                Prepara un mensaje revisable para abrir en tu WhatsApp Web o App móvil (sin bots ni cobros por API)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-sape-amarillo font-bold text-xl transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* CUERPO DEL MODAL */}
                <div className="p-6 overflow-y-auto bg-sape-gris-claro flex-grow space-y-5">
                    {/* FICHA RESUMEN DEL ESTUDIANTE Y APODERADO */}
                    <div className="bg-white p-4 rounded-xl border border-sape-gris shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">
                                Estudiante en Seguimiento
                            </p>
                            <h3 className="text-lg font-bold text-gray-900">
                                {estudiante.nombres} {estudiante.apellidos}
                            </h3>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">
                                ID/RUT: {estudiante.run || estudiante.identificadorInterno || 'Sin Registro'} • Curso: {cursoNombre}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-center">
                                <span className="block text-[10px] uppercase text-gray-500 font-bold">
                                    Promedio Gral.
                                </span>
                                <span
                                    className={`text-sm font-bold ${
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
                                <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                                    🔴 {resumenAcademico.asignaturasCriticas.length} asig. bajo 4.0
                                </div>
                            ) : (
                                <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                                    🟢 Sin promedios críticos
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PASO 1: TELÉFONO DEL APODERADO Y CRITERIO INSTITUCIONAL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-sape-gris shadow-sm">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                1. Teléfono WhatsApp del Apoderado
                            </label>
                            <input
                                type="text"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                placeholder="+56912345678"
                                className="w-full border-sape-gris rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo font-mono text-sm"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">
                                Cargado desde Nómina Syscol. Puedes editarlo si el apoderado actualizó su número.
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-sape-gris shadow-sm">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                2. Criterio Institucional de Seguimiento
                            </label>
                            <select
                                value={criterio}
                                onChange={(e) => cambiarCriterio(e.target.value)}
                                className="w-full border-sape-gris rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo text-sm font-medium"
                            >
                                {CRITERIOS_INSTITUCIONALES.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.titulo}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-gray-500 mt-1">
                                {CRITERIOS_INSTITUCIONALES.find((c) => c.id === criterio)?.descripcion}
                            </p>
                        </div>
                    </div>

                    {/* PASO 2: REVISIÓN Y EDICIÓN DEL MENSAJE PREESTRUCTURADO */}
                    <div className="bg-white p-4 rounded-xl border border-sape-gris shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                3. Mensaje Preestructurado (Revisable y Editable por el Profesor Jefe)
                            </label>
                            <button
                                type="button"
                                onClick={() => setMensaje(construirMensajePreestructurado(criterio))}
                                className="text-xs text-sape-burdeo hover:underline font-semibold"
                            >
                                ↺ Restaurar plantilla
                            </button>
                        </div>

                        <textarea
                            value={mensaje}
                            onChange={(e) => setMensaje(e.target.value)}
                            rows={6}
                            className="w-full border-sape-gris rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo text-sm leading-relaxed"
                            placeholder="Escribe o ajusta el mensaje para el apoderado..."
                        />

                        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                            <span>
                                💡 Puedes ajustar cualquier detalle antes de abrir WhatsApp. El mensaje no se envía solo.
                            </span>
                            <span className="font-mono">{mensaje.length} / 2000 caracteres</span>
                        </div>
                    </div>

                    {/* VISTA PREVIA ESTILO WHATSAPP */}
                    <div className="bg-[#EFEAE2] p-4 rounded-xl border border-gray-300 shadow-inner">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                                Vista Previa en WhatsApp ({telefono || 'Sin número'})
                            </span>
                            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                                Envío directo sin bot (Click-to-Chat wa.me)
                            </span>
                        </div>
                        <div className="bg-[#D9FDD3] text-gray-900 p-3.5 rounded-lg rounded-tr-none shadow-sm text-xs whitespace-pre-wrap leading-relaxed max-w-2xl ml-auto border border-emerald-200">
                            {mensaje || '(El mensaje aparecerá aquí)'}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm">
                            <p className="font-bold">Atención</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {urlGenerada && (
                        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                            <div>
                                <p className="font-bold">✅ Enlace de WhatsApp preparado y registrado en bitácora</p>
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
                                ↗ Abrir WhatsApp Ahora
                            </a>
                        </div>
                    )}
                </div>

                {/* PIE DEL MODAL */}
                <div className="bg-white px-6 py-4 flex flex-wrap justify-between items-center gap-3 border-t border-sape-gris">
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(mensaje);
                            setCopiado(true);
                            setTimeout(() => setCopiado(false), 2500);
                        }}
                        className="bg-gray-100 text-gray-700 font-semibold px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-200 transition-colors text-sm"
                    >
                        {copiado ? '✅ Mensaje copiado' : '📋 Copiar solo texto'}
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white text-gray-700 font-bold px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            disabled={cargando || !mensaje.trim() || !telefono.trim()}
                            onClick={prepararYAbrirWhatsApp}
                            className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-lg shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
                        >
                            {cargando ? (
                                <span>Preparando enlace...</span>
                            ) : (
                                <>
                                    <span>📲 Abrir en WhatsApp (Web / Celular)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
