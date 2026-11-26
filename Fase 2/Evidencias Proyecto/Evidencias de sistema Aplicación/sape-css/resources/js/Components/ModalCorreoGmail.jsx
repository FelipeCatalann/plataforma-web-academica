import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import IconoGmail from '@/Components/IconoGmail';
import { leerPreferenciasSape } from '@/utils/preferenciasSape';

const CRITERIOS_APODERADO = [
    {
        id: 'alerta_academica',
        titulo: 'Alerta Académica',
        descripcion: 'Asignaturas bajo 4.0 o baja de rendimiento',
    },
    {
        id: 'citacion_entrevista',
        titulo: 'Citación a Entrevista',
        descripcion: 'Coordinar reunión con la familia',
    },
    {
        id: 'reporte_avance',
        titulo: 'Avance Semestral',
        descripcion: 'Informar promedio y progreso actual',
    },
    {
        id: 'reconocimiento',
        titulo: 'Reconocimiento',
        descripcion: 'Felicitar por buen logro escolar',
    },
];

const CRITERIOS_EQUIPO = [
    {
        id: 'coordinacion_interna',
        titulo: 'Coordinación Interna',
        descripcion: 'Seguimiento pedagógico entre docentes',
    },
    {
        id: 'derivacion_utp',
        titulo: 'Aviso a Dirección / UTP',
        descripcion: 'Escalar caso o solicitar apoyo técnico',
    },
    {
        id: 'comunicado_general',
        titulo: 'Correo Libre',
        descripcion: 'Mensaje directo sin plantilla fija',
    },
];

export default function ModalCorreoGmail({
    isOpen,
    onClose,
    estudiante = null,
    curso = null,
    profesorNombre = '',
    destinatarioInicial = null,
    onCorreoGenerado = null,
}) {
    const tieneEstudiante = Boolean(estudiante);
    const [tipoDestinatario, setTipoDestinatario] = useState(
        destinatarioInicial?.tipo || (tieneEstudiante ? 'apoderado' : 'equipo_docente')
    );
    const [correoDestino, setCorreoDestino] = useState('');
    const [nombreDestino, setNombreDestino] = useState('');
    const [cc, setCc] = useState('');
    const [mostrarCc, setMostrarCc] = useState(false);
    const [criterio, setCriterio] = useState('citacion_entrevista');
    const [asunto, setAsunto] = useState('');
    const [cuerpo, setCuerpo] = useState('');

    const [directorio, setDirectorio] = useState([]);
    const [cargandoDirectorio, setCargandoDirectorio] = useState(false);
    const [busquedaEquipo, setBusquedaEquipo] = useState('');

    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [resultadoGmail, setResultadoGmail] = useState(null);
    const [copiado, setCopiado] = useState(false);

    const abortControllerRef = useRef(null);
    const copyTimerRef = useRef(null);

    const cursoNombre = curso ? `${curso.nivel}° Medio ${curso.letra}` : '';
    const nombreEmisor = profesorNombre || 'Equipo Docente';

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

    const construirPlantilla = (tipo, criterioSel, nombreDestActual = '') => {
        const prefs = leerPreferenciasSape();
        const pieFirma =
            prefs.incluirFirmaCorreo && prefs.firmaCorreo?.trim()
                ? `\n\nAtentamente,\n${nombreEmisor}\n${prefs.firmaCorreo.trim()}`
                : `\n\nAtentamente,\n${nombreEmisor}`;

        if (tipo === 'apoderado' && estudiante) {
            const nombreAlumno = `${estudiante.nombres || ''} ${estudiante.apellidos || ''}`.trim();
            const promTexto = resumenAcademico.promedioGeneral || 'en evaluación';
            const detalleRojas =
                resumenAcademico.asignaturasCriticas.length > 0
                    ? resumenAcademico.asignaturasCriticas.join(', ')
                    : 'algunas evaluaciones recientes';
            const detalleDestacadas =
                resumenAcademico.mejoresAsignaturas.length > 0
                    ? ` destacando especialmente en ${resumenAcademico.mejoresAsignaturas.slice(0, 2).join(' y ')}`
                    : '';
            const sufijoCurso = cursoNombre ? ` (${cursoNombre})` : '';

            switch (criterioSel) {
                case 'alerta_academica':
                    return {
                        asunto: `Seguimiento académico preventivo - ${nombreAlumno}${sufijoCurso}`,
                        cuerpo:
                            `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                            `Junto con saludar cordialmente, me comunico con usted en el marco de nuestro acompañamiento pedagógico preventivo${cursoNombre ? ` en ${cursoNombre}` : ''}. Actualmente ${estudiante.nombres} registra un promedio general de ${promTexto} y requiere reforzar ${detalleRojas}.\n\n` +
                            `Nos gustaría coordinar una breve entrevista esta semana para definir apoyos en conjunto. Por favor indíqueme su disponibilidad horaria.${pieFirma}`,
                    };
                case 'citacion_entrevista':
                    return {
                        asunto: `Citación a entrevista - ${nombreAlumno}${sufijoCurso}`,
                        cuerpo:
                            `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                            `Junto con saludar cordialmente, le escribo para citarle a una entrevista de seguimiento escolar sobre el proceso académico y formativo de ${estudiante.nombres}${cursoNombre ? ` en ${cursoNombre}` : ''}.\n\n` +
                            `Le agradezco confirmar su disponibilidad dentro de los próximos días para agendar nuestra reunión.${pieFirma}`,
                    };
                case 'reporte_avance':
                    return {
                        asunto: `Informe de avance escolar - ${nombreAlumno}${sufijoCurso}`,
                        cuerpo:
                            `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                            `Junto con saludar cordialmente, le informo que a la fecha ${estudiante.nombres} mantiene un promedio general de ${promTexto}${
                                resumenAcademico.asignaturasCriticas.length > 0
                                    ? `, con foco de refuerzo en ${detalleRojas}`
                                    : ''
                            }.\n\n` +
                            `Quedo a su disposición ante cualquier consulta sobre su avance.${pieFirma}`,
                    };
                case 'reconocimiento':
                    return {
                        asunto: `Reconocimiento académico - ${nombreAlumno}${sufijoCurso}`,
                        cuerpo:
                            `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\n` +
                            `Es muy grato felicitar a ${estudiante.nombres} y a su familia por su destacado desempeño escolar${cursoNombre ? ` en ${cursoNombre}` : ''}, alcanzando un promedio general de ${promTexto}${detalleDestacadas}.\n\n` +
                            `Le invitamos a seguir motivando este excelente compromiso.${pieFirma}`,
                    };
                default:
                    return {
                        asunto: `Comunicación escolar - ${nombreAlumno}${sufijoCurso}`,
                        cuerpo: `Estimado(a) apoderado(a) de ${nombreAlumno}:\n\nJunto con saludar cordialmente, le escribo respecto de ${estudiante.nombres}.${pieFirma}`,
                    };
            }
        }

        const saludoDest = nombreDestActual ? `Estimado(a) ${nombreDestActual}:` : 'Estimado(a) colega:';
        const nombreAlumno = estudiante
            ? `${estudiante.nombres || ''} ${estudiante.apellidos || ''}`.trim()
            : '';
        const contextoAlumno = estudiante
            ? `${nombreAlumno}${cursoNombre ? ` (${cursoNombre})` : ''}`
            : cursoNombre || 'el establecimiento';

        if (criterioSel === 'derivacion_utp') {
            return {
                asunto: estudiante
                    ? `Seguimiento y apoyo UTP - ${nombreAlumno}${cursoNombre ? ` (${cursoNombre})` : ''}`
                    : `Solicitud de coordinación - Dirección / UTP`,
                cuerpo:
                    `${saludoDest}\n\n` +
                    (estudiante
                        ? `Junto con saludar, comparto antecedentes académicos de ${contextoAlumno} (promedio actual ${resumenAcademico.promedioGeneral || 'en evaluación'}${
                              resumenAcademico.asignaturasCriticas.length > 0
                                  ? `, con asignaturas bajo 4.0 en ${resumenAcademico.asignaturasCriticas.join(', ')}`
                                  : ''
                          }) para evaluar medidas de acompañamiento conjunto.`
                        : `Junto con saludar, me comunico para coordinar acciones pedagógicas del establecimiento.`) +
                    pieFirma,
            };
        }

        if (criterioSel === 'comunicado_general') {
            return {
                asunto: cursoNombre ? `Coordinación académica - ${cursoNombre}` : 'Comunicación interna',
                cuerpo: `${saludoDest}\n\nJunto con saludar cordialmente, le escribo para coordinar lo siguiente:\n\n${pieFirma}`,
            };
        }

        return {
            asunto: estudiante
                ? `Coordinación docente - ${nombreAlumno}${cursoNombre ? ` (${cursoNombre})` : ''}`
                : cursoNombre
                  ? `Coordinación docente - ${cursoNombre}`
                  : 'Coordinación pedagógica',
            cuerpo:
                `${saludoDest}\n\n` +
                (estudiante
                    ? `Junto con saludar, te escribo para coordinar el seguimiento pedagógico de ${contextoAlumno}${
                          resumenAcademico.promedioGeneral
                              ? ` (promedio general ${resumenAcademico.promedioGeneral})`
                              : ''
                      }.`
                    : `Junto con saludar, te escribo para coordinar temas pedagógicos${cursoNombre ? ` de ${cursoNombre}` : ''}.`) +
                pieFirma,
        };
    };

    // Cargar directorio interno de docentes y directivos cuando se abre el modal
    useEffect(() => {
        if (!isOpen) return;
        let activo = true;
        setCargandoDirectorio(true);
        axios
            .get('/correos-gmail/directorio')
            .then((res) => {
                if (activo && Array.isArray(res.data?.contactos)) {
                    setDirectorio(res.data.contactos);
                }
            })
            .catch(() => {
                // El usuario siempre puede escribir el correo manualmente
            })
            .finally(() => {
                if (activo) setCargandoDirectorio(false);
            });
        return () => {
            activo = false;
        };
    }, [isOpen]);

    // Inicializar campos al abrir el modal
    useEffect(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
            copyTimerRef.current = null;
        }

        if (!isOpen) return;

        const prefs = leerPreferenciasSape();
        const tipoInicial =
            destinatarioInicial?.tipo || (estudiante ? 'apoderado' : 'equipo_docente');

        const criterioInicial =
            tipoInicial === 'apoderado' && estudiante
                ? prefs.criterioDefaultCorreo && prefs.criterioDefaultCorreo !== 'auto'
                    ? prefs.criterioDefaultCorreo
                    : resumenAcademico.asignaturasCriticas.length > 0
                      ? 'alerta_academica'
                      : 'citacion_entrevista'
                : 'coordinacion_interna';

        const correoInicial =
            destinatarioInicial?.correo ||
            (tipoInicial === 'apoderado' ? estudiante?.apoderado_correo || '' : '');
        const nombreInicial =
            destinatarioInicial?.nombre ||
            (tipoInicial === 'apoderado' ? estudiante?.apoderado_nombre || '' : '');

        const plantilla = construirPlantilla(tipoInicial, criterioInicial, nombreInicial);

        setTipoDestinatario(tipoInicial);
        setCorreoDestino(correoInicial);
        setNombreDestino(nombreInicial);
        setCc('');
        setMostrarCc(false);
        setCriterio(criterioInicial);
        setAsunto(destinatarioInicial?.asunto || plantilla.asunto);
        setCuerpo(destinatarioInicial?.cuerpo || plantilla.cuerpo);
        setBusquedaEquipo('');
        setError('');
        setResultadoGmail(null);
        setCopiado(false);
        setCargando(false);
    }, [isOpen, estudiante?.id, destinatarioInicial?.correo, destinatarioInicial?.tipo]);

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

    const cambiarTipoDestinatario = (nuevoTipo) => {
        setTipoDestinatario(nuevoTipo);
        setResultadoGmail(null);
        setError('');

        if (nuevoTipo === 'apoderado' && estudiante) {
            const prefs = leerPreferenciasSape();
            const crit =
                prefs.criterioDefaultCorreo && prefs.criterioDefaultCorreo !== 'auto'
                    ? prefs.criterioDefaultCorreo
                    : resumenAcademico.asignaturasCriticas.length > 0
                      ? 'alerta_academica'
                      : 'citacion_entrevista';
            setCriterio(crit);
            setCorreoDestino(estudiante.apoderado_correo || '');
            setNombreDestino(estudiante.apoderado_nombre || '');
            const p = construirPlantilla('apoderado', crit);
            setAsunto(p.asunto);
            setCuerpo(p.cuerpo);
        } else {
            const crit = 'coordinacion_interna';
            setCriterio(crit);
            if (nuevoTipo === 'otro') {
                setCorreoDestino('');
                setNombreDestino('');
            } else if (curso?.profesor_jefe_email && !destinatarioInicial?.correo) {
                setCorreoDestino(curso.profesor_jefe_email);
                setNombreDestino(curso.profesor_jefe_nombre || '');
            } else {
                setCorreoDestino(destinatarioInicial?.correo || '');
                setNombreDestino(destinatarioInicial?.nombre || '');
            }
            const p = construirPlantilla(nuevoTipo, crit, '');
            setAsunto(p.asunto);
            setCuerpo(p.cuerpo);
        }
    };

    const seleccionarContactoEquipo = (contacto) => {
        setCorreoDestino(contacto.email);
        setNombreDestino(contacto.nombre);
        setTipoDestinatario(contacto.categoria === 'direccion_utp' ? 'direccion_utp' : 'equipo_docente');
        const p = construirPlantilla(
            contacto.categoria === 'direccion_utp' ? 'direccion_utp' : 'equipo_docente',
            criterio,
            contacto.nombre
        );
        setAsunto(p.asunto);
        setCuerpo(p.cuerpo);
        setError('');
        setResultadoGmail(null);
    };

    const cambiarCriterio = (nuevoCriterio) => {
        setCriterio(nuevoCriterio);
        const p = construirPlantilla(tipoDestinatario, nuevoCriterio, nombreDestino);
        setAsunto(p.asunto);
        setCuerpo(p.cuerpo);
        setResultadoGmail(null);
        setError('');
    };

    const contactosFiltrados = useMemo(() => {
        const q = busquedaEquipo.trim().toLowerCase();
        if (!q) return directorio;
        return directorio.filter(
            (c) =>
                (c.nombre || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.rol || '').toLowerCase().includes(q) ||
                (c.detalle || '').toLowerCase().includes(q)
        );
    }, [directorio, busquedaEquipo]);

    const prepararYAbrirGmail = async () => {
        if (cargando) return;
        const correoLimpio = correoDestino.trim();
        if (!correoLimpio || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
            setError('Ingresa un correo electrónico válido (ejemplo: apoderado@gmail.com).');
            return;
        }
        if (cc.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cc.trim())) {
            setError('El correo en copia (CC) no tiene un formato válido.');
            return;
        }
        if (!asunto.trim()) {
            setError('Escribe un asunto para el correo.');
            return;
        }
        if (!cuerpo.trim()) {
            setError('El mensaje no puede estar vacío.');
            return;
        }

        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setCargando(true);
        setError('');

        try {
            const { data } = await axios.post(
                '/correos-gmail',
                {
                    estudiante_id: estudiante?.id || null,
                    curso_id: curso?.id || null,
                    tipo_destinatario: tipoDestinatario,
                    nombre_destino: nombreDestino.trim() || null,
                    correo_destino: correoLimpio,
                    cc: cc.trim() || null,
                    asunto: asunto.trim(),
                    cuerpo: cuerpo.trim(),
                    origen: 'correo_directo',
                    criterio,
                },
                { signal: controller.signal }
            );

            if (data?.success && data?.gmail_url) {
                let copiadoAuto = false;
                if (data.excede_limite && navigator.clipboard) {
                    try {
                        await navigator.clipboard.writeText(cuerpo.trim());
                        copiadoAuto = true;
                    } catch {
                        // El botón de copiar queda disponible
                    }
                }

                setResultadoGmail({
                    url: data.gmail_url,
                    excedeLimite: Boolean(data.excede_limite),
                    copiadoAuto,
                });

                if (onCorreoGenerado && estudiante?.id) {
                    onCorreoGenerado(
                        estudiante.id,
                        data.comunicacion,
                        tipoDestinatario === 'apoderado' ? correoLimpio : null
                    );
                }

                window.open(data.gmail_url, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            if (axios.isCancel(err) || err.name === 'CanceledError') return;
            const msg =
                err.response?.data?.errors?.correo_destino?.[0] ||
                err.response?.data?.errors?.cc?.[0] ||
                err.response?.data?.errors?.asunto?.[0] ||
                err.response?.data?.errors?.cuerpo?.[0] ||
                err.response?.data?.message ||
                'No se pudo preparar el correo en Gmail. Revisa los datos e intenta nuevamente.';
            setError(msg);
        } finally {
            if (abortControllerRef.current === controller) {
                setCargando(false);
            }
        }
    };

    const copiarTexto = async () => {
        if (!cuerpo.trim()) return;
        try {
            await navigator.clipboard.writeText(cuerpo);
            setCopiado(true);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopiado(false), 2500);
        } catch {
            setError('Tu navegador bloqueó el copiado automático. Selecciona el texto y presiona Ctrl+C.');
        }
    };

    if (!isOpen) return null;

    const criteriosActivos =
        tipoDestinatario === 'apoderado' && estudiante ? CRITERIOS_APODERADO : CRITERIOS_EQUIPO;
    const mostrarDirectorio =
        tipoDestinatario === 'equipo_docente' || tipoDestinatario === 'direccion_utp';

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
                aria-labelledby="modal-gmail-titulo"
                className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
            >
                {/* CABECERA */}
                <div className="bg-sape-burdeo px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                            <IconoGmail className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <h2 id="modal-gmail-titulo" className="text-sape-amarillo text-lg font-bold leading-tight truncate">
                                Redactar correo con Gmail
                            </h2>
                            <p className="text-white/85 text-xs truncate">
                                Prepara el mensaje en S.A.P.E y ábrelo listo en tu correo Gmail
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={cargando}
                        aria-label="Cerrar ventana de correo Gmail"
                        className="text-white/80 hover:text-sape-amarillo p-1.5 rounded-lg hover:bg-sape-burdeo-hover transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* CUERPO */}
                <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 flex-grow space-y-4">
                    {/* Contexto de estudiante si existe */}
                    {estudiante && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">
                                    {estudiante.nombres} {estudiante.apellidos}
                                </h3>
                                <p className="text-xs text-slate-600 font-mono mt-0.5 tabular-nums">
                                    RUT: {estudiante.run || estudiante.identificadorInterno || 'Sin registro'}
                                    {cursoNombre ? ` · ${cursoNombre}` : ''}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center shrink-0">
                                <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-center">
                                    <span className="block text-[10px] uppercase text-slate-600 font-bold">Prom.</span>
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
                                {resumenAcademico.asignaturasCriticas.length > 0 && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold tabular-nums">
                                        <span className="w-2 h-2 rounded-full bg-red-600" />
                                        {resumenAcademico.asignaturasCriticas.length} bajo 4.0
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Selector de destinatario */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                1. Destinatario
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {estudiante && (
                                    <button
                                        type="button"
                                        onClick={() => cambiarTipoDestinatario('apoderado')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                            tipoDestinatario === 'apoderado'
                                                ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                        }`}
                                    >
                                        Apoderado
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => cambiarTipoDestinatario('equipo_docente')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        mostrarDirectorio
                                            ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                    }`}
                                >
                                    Equipo Docente / Dirección
                                </button>
                                <button
                                    type="button"
                                    onClick={() => cambiarTipoDestinatario('otro')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        tipoDestinatario === 'otro'
                                            ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                    }`}
                                >
                                    Otro correo
                                </button>
                            </div>
                        </div>

                        {/* Directorio rápido del establecimiento */}
                        {mostrarDirectorio && (
                            <div className="space-y-2 pt-1">
                                <input
                                    type="text"
                                    value={busquedaEquipo}
                                    onChange={(e) => setBusquedaEquipo(e.target.value)}
                                    placeholder="Buscar profesor o directivo por nombre o correo..."
                                    className="w-full rounded-lg border-slate-300 bg-slate-50 text-xs text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                                />
                                {cargandoDirectorio ? (
                                    <p className="text-xs text-slate-500">Cargando directorio del colegio...</p>
                                ) : contactosFiltrados.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                        {contactosFiltrados.slice(0, 12).map((c) => {
                                            const activo =
                                                correoDestino.trim().toLowerCase() ===
                                                (c.email || '').toLowerCase();
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => seleccionarContactoEquipo(c)}
                                                    className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                                                        activo
                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                                                    }`}
                                                >
                                                    <span className="block text-xs font-bold leading-tight">
                                                        {c.nombre}
                                                    </span>
                                                    <span className="block text-[10px] text-slate-500">
                                                        {c.detalle} · {c.email}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500">
                                        Sin coincidencias. Puedes escribir el correo directamente abajo.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label
                                        htmlFor="gmail-correo-destino"
                                        className="block text-xs font-bold text-slate-700"
                                    >
                                        Correo destino (Para)
                                    </label>
                                    {!mostrarCc && (
                                        <button
                                            type="button"
                                            onClick={() => setMostrarCc(true)}
                                            className="text-[11px] font-bold text-sape-burdeo hover:underline"
                                        >
                                            + Agregar CC
                                        </button>
                                    )}
                                </div>
                                <input
                                    id="gmail-correo-destino"
                                    type="email"
                                    value={correoDestino}
                                    onChange={(e) => setCorreoDestino(e.target.value)}
                                    placeholder={
                                        tipoDestinatario === 'apoderado'
                                            ? 'apoderado@gmail.com'
                                            : 'docente@colegio.cl'
                                    }
                                    className="w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                                />
                                {tipoDestinatario === 'apoderado' && estudiante && (
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Se guardará en la ficha del apoderado para próximos correos.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    htmlFor="gmail-asunto"
                                    className="block text-xs font-bold text-slate-700 mb-1"
                                >
                                    Asunto
                                </label>
                                <input
                                    id="gmail-asunto"
                                    type="text"
                                    maxLength={200}
                                    value={asunto}
                                    onChange={(e) => setAsunto(e.target.value)}
                                    placeholder="Asunto del correo..."
                                    className="w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                                />
                            </div>
                        </div>

                        {mostrarCc && (
                            <div>
                                <label htmlFor="gmail-cc" className="block text-xs font-bold text-slate-700 mb-1">
                                    Copia (CC - opcional)
                                </label>
                                <input
                                    id="gmail-cc"
                                    type="email"
                                    value={cc}
                                    onChange={(e) => setCc(e.target.value)}
                                    placeholder="direccion@colegio.cl"
                                    className="w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                                />
                            </div>
                        )}
                    </div>

                    {/* Plantilla rápida + Editor */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                2. Plantilla y mensaje
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    const p = construirPlantilla(tipoDestinatario, criterio, nombreDestino);
                                    setAsunto(p.asunto);
                                    setCuerpo(p.cuerpo);
                                }}
                                className="text-xs font-bold text-sape-burdeo hover:underline"
                            >
                                Restaurar texto
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {criteriosActivos.map((item) => {
                                const activo = criterio === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => cambiarCriterio(item.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                            activo
                                                ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {item.titulo}
                                    </button>
                                );
                            })}
                        </div>

                        <textarea
                            id="gmail-cuerpo-editable"
                            value={cuerpo}
                            onChange={(e) => setCuerpo(e.target.value)}
                            rows={6}
                            maxLength={12000}
                            aria-label="Cuerpo editable del correo"
                            className="w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 leading-relaxed focus:border-sape-burdeo focus:ring-sape-burdeo"
                            placeholder="Escribe o ajusta el mensaje antes de abrir Gmail..."
                        />

                        <div className="flex justify-between items-center text-[11px] text-slate-500">
                            <span>El correo no se envía solo: se abrirá en tu Gmail para confirmación final.</span>
                            <span className="font-mono tabular-nums">{cuerpo.length} caracteres</span>
                        </div>
                    </div>

                    {/* Vista previa estilo Gmail dentro de SAPE */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <IconoGmail className="w-4 h-4" />
                                <span className="text-xs font-extrabold text-slate-800">
                                    Vista previa del correo
                                </span>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-600">
                                Se abrirá en mail.google.com
                            </span>
                        </div>
                        <div className="p-4 space-y-2 text-xs">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2 border-b border-slate-100 text-slate-600">
                                <span>
                                    Para: <strong className="text-slate-900">{correoDestino || 'Sin correo'}</strong>
                                </span>
                                {cc.trim() && (
                                    <span>
                                        CC: <strong className="text-slate-900">{cc}</strong>
                                    </span>
                                )}
                                <span className="w-full">
                                    Asunto: <strong className="text-slate-900">{asunto || 'Sin asunto'}</strong>
                                </span>
                            </div>
                            <div className="whitespace-pre-wrap break-words text-slate-800 leading-relaxed max-h-40 overflow-y-auto">
                                {cuerpo || '(El mensaje aparecerá aquí)'}
                            </div>
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

                    {resultadoGmail && (
                        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div>
                                <p className="font-bold text-sm">Correo listo en Gmail y registrado en bitácora</p>
                                <p className="text-emerald-800 mt-0.5">
                                    {resultadoGmail.excedeLimite
                                        ? resultadoGmail.copiadoAuto
                                            ? 'El texto es extenso y se copió al portapapeles: presiona Ctrl+V en Gmail.'
                                            : 'El texto es extenso: cópialo con el botón inferior y pégalo en Gmail.'
                                        : 'Si tu navegador bloqueó la pestaña nueva, ábrelo aquí:'}
                                </p>
                            </div>
                            <a
                                href={resultadoGmail.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 bg-white text-slate-900 border border-slate-300 hover:bg-slate-100 font-bold px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                                <IconoGmail className="w-4 h-4" />
                                <span>Abrir Gmail ahora</span>
                            </a>
                        </div>
                    )}
                </div>

                {/* PIE */}
                <div className="bg-white px-6 py-4 flex flex-wrap justify-between items-center gap-3 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={copiarTexto}
                        className="bg-slate-100 text-slate-700 font-semibold px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-200 transition-colors text-sm inline-flex items-center gap-2"
                    >
                        <span>{copiado ? 'Texto copiado' : 'Copiar texto'}</span>
                    </button>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white text-slate-700 font-bold px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors text-sm"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            disabled={cargando || !cuerpo.trim() || !correoDestino.trim() || !asunto.trim()}
                            onClick={prepararYAbrirGmail}
                            className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold px-5 py-2.5 rounded-xl shadow-sm disabled:opacity-50 transition-colors inline-flex items-center gap-2 text-sm"
                        >
                            <span className="w-5 h-5 rounded-md bg-white flex items-center justify-center shrink-0">
                                <IconoGmail className="w-3.5 h-3.5" />
                            </span>
                            <span>{cargando ? 'Preparando...' : 'Abrir en Gmail'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
