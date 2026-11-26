/**
 * Utilidades puras para analizar respuestas del Copiloto Pedagógico IA
 * y derivar micro-visualizaciones deterministas a partir de cursoContexto.
 */

/**
 * Redondeo escolar chileno a 1 decimal consistente con PHP round($valor, 1)
 * (compensa imprecisión binaria IEEE-754 en mitades exactas como 31.6 / 8 = 3.95 -> 4.0).
 */
export const redondearNotaChilena = (valor) => {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
    return Math.round((valor + 1e-12) * 10) / 10;
};

export const calcularMetricasEstudianteCompleto = (est) => {
    const calificaciones = Array.isArray(est?.calificaciones) ? est.calificaciones : [];
    const valores = [];
    const porAsignatura = new Map();

    calificaciones.forEach((cal) => {
        const num = parseFloat(cal.valor || cal.evaluacion || cal.evaluación);
        if (!isNaN(num) && num >= 1.0 && num <= 7.0) {
            valores.push(num);
            const asig = cal.asignatura_nombre || 'General';
            if (!porAsignatura.has(asig)) {
                porAsignatura.set(asig, { suma: 0, count: 0 });
            }
            const item = porAsignatura.get(asig);
            item.suma += num;
            item.count += 1;
        }
    });

    const promedioNum =
        valores.length > 0 ? redondearNotaChilena(valores.reduce((a, b) => a + b, 0) / valores.length) : null;
    const promedioGeneral = promedioNum !== null ? promedioNum.toFixed(1) : '-';

    const ramosRojosDetalle = [];
    const ramosRojos = [];
    porAsignatura.forEach((datos, nombreAsig) => {
        if (datos.count > 0) {
            const prom = redondearNotaChilena(datos.suma / datos.count);
            if (prom !== null && prom < 4.0) {
                ramosRojosDetalle.push({ nombre: nombreAsig, promedio: prom });
                ramosRojos.push(`${nombreAsig} (${prom.toFixed(1)})`);
            }
        }
    });

    ramosRojosDetalle.sort((a, b) => a.promedio - b.promedio);

    const asistenciaRaw = est?.asistencia_anual ?? est?.pivot?.asistencia_pct ?? null;
    const asistenciaAnual =
        asistenciaRaw !== null && asistenciaRaw !== '' && !isNaN(parseFloat(asistenciaRaw))
            ? parseFloat(parseFloat(asistenciaRaw).toFixed(1))
            : null;

    const nombres = String(est?.nombres || '').trim();
    const apellidos = String(est?.apellidos || '').trim();
    const nombreCompleto = `${nombres} ${apellidos}`.trim();
    const iniciales = `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase() || 'ES';

    const enRiesgo = (promedioNum !== null && promedioNum < 4.0) || ramosRojosDetalle.length > 0;
    const estado = enRiesgo
        ? 'critico'
        : promedioNum !== null && promedioNum < 4.8
          ? 'atencion'
          : 'adecuado';

    return {
        promedioGeneral,
        promedioNum,
        ramosRojos,
        ramosRojosDetalle,
        asistenciaAnual,
        totalCorreos: Number(est?.total_correos || 0),
        rut: est?.identificadorInterno || est?.run || 'Sin RUT',
        nombreCompleto,
        iniciales,
        enRiesgo,
        estado,
    };
};

export const calcularMetricasCurso = (cursoContexto) => {
    const estudiantes = Array.isArray(cursoContexto?.estudiantes) ? cursoContexto.estudiantes : [];
    const totalAlumnos = estudiantes.length;

    if (totalAlumnos === 0) {
        return {
            totalAlumnos: 0,
            promedioGeneral: '-',
            promedioNum: null,
            cantCritico: 0,
            cantAtencion: 0,
            cantAdecuado: 0,
            pctCritico: 0,
            pctAtencion: 0,
            pctAdecuado: 0,
            enAlerta: 0,
            pctNotasBajo4: 0,
            asignaturas: [],
            asistencia: { disponible: false, promedio: null, bajoUmbral: 0, alumnosBajoUmbral: [] },
            semestres: { disponible: false, promS1: null, promS2: null, delta: null, variaciones: [] },
        };
    }

    let sumaPromedios = 0;
    let countPromedios = 0;
    let totalNotas = 0;
    let notasBajo4 = 0;
    let cantCritico = 0;
    let cantAtencion = 0;
    let cantAdecuado = 0;
    let enAlerta = 0;

    const asigMap = new Map();
    const sem1Global = [];
    const sem2Global = [];
    const asigSemMap = new Map();
    const asistencias = [];
    const alumnosBajoAsistencia = [];

    estudiantes.forEach((est) => {
        const m = calcularMetricasEstudianteCompleto(est);
        if (m.promedioNum !== null) {
            sumaPromedios += m.promedioNum;
            countPromedios += 1;
        }
        if (m.enRiesgo) {
            enAlerta += 1;
            cantCritico += 1;
        } else if (m.estado === 'atencion') {
            cantAtencion += 1;
        } else {
            cantAdecuado += 1;
        }

        if (m.asistenciaAnual !== null) {
            asistencias.push(m.asistenciaAnual);
            if (m.asistenciaAnual < 85) {
                alumnosBajoAsistencia.push({
                    id: est.id,
                    nombre: m.nombreCompleto,
                    asistencia: m.asistenciaAnual,
                    estudiante: est,
                });
            }
        }

        const porAsigEst = new Map();
        (est.calificaciones || []).forEach((cal) => {
            const val = parseFloat(cal.valor || cal.evaluacion || cal.evaluación);
            if (isNaN(val) || val < 1.0 || val > 7.0) return;

            totalNotas += 1;
            if (val < 4.0) notasBajo4 += 1;

            const nombreAsig = cal.asignatura_nombre || 'General';
            if (!asigMap.has(nombreAsig)) {
                asigMap.set(nombreAsig, { suma: 0, count: 0, alumnosBajo4: 0 });
            }
            const agg = asigMap.get(nombreAsig);
            agg.suma += val;
            agg.count += 1;

            if (!porAsigEst.has(nombreAsig)) {
                porAsigEst.set(nombreAsig, { suma: 0, count: 0 });
            }
            const estAgg = porAsigEst.get(nombreAsig);
            estAgg.suma += val;
            estAgg.count += 1;

            const sem = Number(cal.semestre);
            if (sem === 1) {
                sem1Global.push(val);
                if (!asigSemMap.has(nombreAsig)) asigSemMap.set(nombreAsig, { s1: [], s2: [] });
                asigSemMap.get(nombreAsig).s1.push(val);
            } else if (sem === 2) {
                sem2Global.push(val);
                if (!asigSemMap.has(nombreAsig)) asigSemMap.set(nombreAsig, { s1: [], s2: [] });
                asigSemMap.get(nombreAsig).s2.push(val);
            }
        });

        porAsigEst.forEach((d, nombreAsig) => {
            if (d.count > 0) {
                const promRedondeado = redondearNotaChilena(d.suma / d.count);
                if (promRedondeado !== null && promRedondeado < 4.0) {
                    asigMap.get(nombreAsig).alumnosBajo4 += 1;
                }
            }
        });
    });

    const promedioNum = countPromedios > 0 ? redondearNotaChilena(sumaPromedios / countPromedios) : null;
    const asignaturas = [];
    asigMap.forEach((d, nombre) => {
        if (d.count > 0) {
            asignaturas.push({
                nombre,
                promedio: redondearNotaChilena(d.suma / d.count),
                alumnosBajo4: d.alumnosBajo4,
            });
        }
    });
    asignaturas.sort((a, b) => a.promedio - b.promedio);

    const promAsist =
        asistencias.length > 0
            ? redondearNotaChilena(asistencias.reduce((a, b) => a + b, 0) / asistencias.length)
            : null;
    alumnosBajoAsistencia.sort((a, b) => a.asistencia - b.asistencia);

    const promS1 =
        sem1Global.length > 0
            ? redondearNotaChilena(sem1Global.reduce((a, b) => a + b, 0) / sem1Global.length)
            : null;
    const promS2 =
        sem2Global.length > 0
            ? redondearNotaChilena(sem2Global.reduce((a, b) => a + b, 0) / sem2Global.length)
            : null;

    const variaciones = [];
    asigSemMap.forEach((d, nombre) => {
        if (d.s1.length > 0 && d.s2.length > 0) {
            const p1 = redondearNotaChilena(d.s1.reduce((a, b) => a + b, 0) / d.s1.length);
            const p2 = redondearNotaChilena(d.s2.reduce((a, b) => a + b, 0) / d.s2.length);
            variaciones.push({
                nombre,
                s1: p1,
                s2: p2,
                delta: redondearNotaChilena(p2 - p1),
            });
        }
    });
    variaciones.sort((a, b) => a.delta - b.delta);

    const pctCritico = Math.round((cantCritico / totalAlumnos) * 100);
    const pctAtencion = Math.round((cantAtencion / totalAlumnos) * 100);
    const pctAdecuado = Math.max(0, 100 - pctCritico - pctAtencion);

    return {
        totalAlumnos,
        promedioGeneral: promedioNum !== null ? promedioNum.toFixed(1) : '-',
        promedioNum,
        cantCritico,
        cantAtencion,
        cantAdecuado,
        pctCritico,
        pctAtencion,
        pctAdecuado,
        enAlerta,
        pctNotasBajo4: totalNotas > 0 ? Math.round((notasBajo4 / totalNotas) * 100) : 0,
        asignaturas,
        asistencia: {
            disponible: promAsist !== null,
            promedio: promAsist,
            bajoUmbral: alumnosBajoAsistencia.length,
            alumnosBajoUmbral: alumnosBajoAsistencia.slice(0, 5),
        },
        semestres: {
            disponible: promS1 !== null && promS2 !== null,
            promS1,
            promS2,
            delta: promS1 !== null && promS2 !== null ? parseFloat((promS2 - promS1).toFixed(1)) : null,
            variaciones: variaciones.slice(0, 5),
        },
    };
};

export const detectarAsignaturasMencionadas = (texto, listaAsignaturas = []) => {
    if (!texto || !Array.isArray(listaAsignaturas) || listaAsignaturas.length === 0) return [];
    const textoLower = texto.toLowerCase();
    return listaAsignaturas.filter((a) => {
        const nom = String(a.nombre || '').toLowerCase();
        return nom.length >= 4 && textoLower.includes(nom);
    });
};

/**
 * Selecciona como máximo 1 micro-widget visual coherente con la respuesta (modo equilibrado).
 */
export const detectarIntencionVisual = (texto, herramientasUsadas = [], metricasCurso = null) => {
    if (!texto || texto.length < 90 || !metricasCurso || metricasCurso.totalAlumnos === 0) {
        return null;
    }

    const lower = texto.toLowerCase();
    const tools = Array.isArray(herramientasUsadas)
        ? herramientasUsadas.map((t) => String(t).toLowerCase())
        : [];

    // Evitar adjuntar gráficos cuando el asistente solo responde a un saludo genérico
    if (
        tools.length === 0 &&
        /^\s*¡?hola\b/i.test(texto) &&
        /\b(en qu[eé] puedo ayudar|ind[ií]queme qu[eé] necesita|c[oó]mo puedo apoyar)\b/i.test(lower)
    ) {
        return null;
    }

    if (
        metricasCurso.asistencia.disponible &&
        (tools.some((t) => t.includes('asistencia')) ||
            /\b(asistencia|inasistencia|ausentismo|85%)\b/i.test(lower))
    ) {
        return 'asistencia';
    }

    if (
        metricasCurso.semestres.disponible &&
        (tools.some((t) => t.includes('semestr')) ||
            /\b(semestre\s*1|semestre\s*2|primer semestre|segundo semestre|comparativa semestral|evoluci[oó]n)\b/i.test(
                lower
            ))
    ) {
        return 'semestres';
    }

    const asigMencionadas = detectarAsignaturasMencionadas(texto, metricasCurso.asignaturas);
    if (
        metricasCurso.asignaturas.length > 0 &&
        (asigMencionadas.length >= 2 ||
            /\b(asignatura|subsector|menor rendimiento|ramo[s]?\s+m[aá]s\s+baj|refuerzo)\b/i.test(lower))
    ) {
        return 'asignaturas';
    }

    if (
        tools.some((t) => t.includes('riesgo') || t.includes('nómina')) ||
        /\b(riesgo|decreto\s*67|bajo\s*4[.,]0|reprobaci[oó]n|alerta|promedio\s+del\s+curso|resumen\s+del\s+curso)\b/i.test(
            lower
        )
    ) {
        return 'riesgo';
    }

    return null;
};

/**
 * Extrae bloques estructurados de fases numeradas (### 1. Diagnóstico, ### 2. Apoyo...)
 * para mostrarlos como tarjetas visuales interactivas con checklist.
 */
export const extraerFasesPlan = (textoMarkdown) => {
    if (!textoMarkdown || typeof textoMarkdown !== 'string') return null;

    const lineas = textoMarkdown.split('\n');
    const indicesCabecera = [];

    for (let i = 0; i < lineas.length; i++) {
        const match = lineas[i].trim().match(/^#{2,3}\s+(\d+)[\.)]\s+(.+)$/);
        if (match) {
            indicesCabecera.push({
                index: i,
                numero: match[1],
                titulo: match[2].replace(/^\*+|\*+$/g, '').trim(),
            });
        }
    }

    if (indicesCabecera.length < 2) return null;

    const introduccion = lineas.slice(0, indicesCabecera[0].index).join('\n').trim();
    const fases = [];
    let cierre = '';

    for (let k = 0; k < indicesCabecera.length; k++) {
        const actual = indicesCabecera[k];
        const finBloque = k + 1 < indicesCabecera.length ? indicesCabecera[k + 1].index : lineas.length;
        const bloqueLineas = lineas.slice(actual.index + 1, finBloque);

        // Si es la última fase, separar cualquier sección posterior encabezada por ## o ### sin número
        let lineasFase = bloqueLineas;
        if (k === indicesCabecera.length - 1) {
            const idxCierre = bloqueLineas.findIndex((l) => /^#{1,3}\s+[^\d]/.test(l.trim()));
            if (idxCierre !== -1) {
                lineasFase = bloqueLineas.slice(0, idxCierre);
                cierre = bloqueLineas.slice(idxCierre).join('\n').trim();
            }
        }

        const campos = {
            objetivo: '',
            responsable: '',
            tiempo: '',
            acciones: [],
            otros: [],
        };

        let enAcciones = false;
        lineasFase.forEach((raw) => {
            const trim = raw.trim();
            if (!trim) return;

            const matchCampo = trim.match(/^[-*]\s+\*\*([^:*]+):?\*\*\s*(.*)$/);
            if (matchCampo) {
                const clave = matchCampo[1].trim();
                const claveLower = clave.toLowerCase();
                const valor = matchCampo[2].trim();
                enAcciones = false;

                if (claveLower.includes('objetivo')) {
                    campos.objetivo = valor;
                } else if (claveLower.includes('responsable')) {
                    campos.responsable = valor;
                } else if (claveLower.includes('tiempo') || claveLower.includes('plazo') || claveLower.includes('duración') || claveLower.includes('duracion')) {
                    campos.tiempo = valor;
                } else if (claveLower.includes('acci') || claveLower.includes('estrateg') || claveLower.includes('actividad')) {
                    enAcciones = true;
                    if (valor) campos.acciones.push(valor);
                } else {
                    campos.otros.push({ clave, valor });
                }
                return;
            }

            if (/^[-*•]\s+/.test(trim)) {
                const item = trim.replace(/^[-*•]\s+/, '').trim();
                if (enAcciones || raw.startsWith('  ')) {
                    campos.acciones.push(item);
                } else {
                    campos.acciones.push(item);
                }
                return;
            }

            if (!campos.objetivo) {
                campos.objetivo = trim;
            } else {
                campos.acciones.push(trim);
            }
        });

        fases.push({
            numero: actual.numero,
            titulo: actual.titulo,
            ...campos,
        });
    }

    const tieneContenidoEstructurado = fases.some(
        (f) => f.objetivo || f.acciones.length > 0 || f.responsable || f.tiempo
    );
    if (!tieneContenidoEstructurado) return null;

    return { introduccion, fases, cierre };
};

export const generarAccionesSiguientes = (
    intencionVisual,
    estudiantesDetectados = [],
    metricasCurso = null
) => {
    const acciones = [];

    if (intencionVisual === 'riesgo' || estudiantesDetectados.length > 0) {
        acciones.push({
            etiqueta: 'Pauta reunión apoderados',
            prompt: 'Redacta una pauta breve y clara para abordar estos casos en entrevista con apoderados según el Decreto 67.',
        });
        acciones.push({
            etiqueta: 'Plan de apoyo 4 semanas',
            prompt: 'Convierte este diagnóstico en un plan práctico de 4 semanas con responsable, acciones concretas y metas medibles.',
        });
    } else if (intencionVisual === 'asignaturas') {
        const asigCritica = metricasCurso?.asignaturas?.[0]?.nombre;
        acciones.push({
            etiqueta: 'Guía de refuerzo',
            prompt: asigCritica
                ? `Propón una actividad o guía de refuerzo concreta para mejorar los resultados en ${asigCritica}.`
                : 'Propón una actividad o guía de refuerzo concreta para la asignatura más baja del curso.',
        });
        acciones.push({
            etiqueta: 'Ver alumnos bajo 4.0',
            prompt: asigCritica
                ? `¿Qué estudiantes están bajo 4.0 en ${asigCritica} y qué apoyo prioritario necesitan?`
                : '¿Qué estudiantes requieren apoyo prioritario en estas asignaturas?',
        });
    } else if (intencionVisual === 'asistencia') {
        acciones.push({
            etiqueta: 'Mensaje a familias',
            prompt: 'Redacta un mensaje respetuoso para apoderados sobre la importancia de mejorar la asistencia (umbral 85% Decreto 67).',
        });
    } else if (intencionVisual === 'semestres') {
        acciones.push({
            etiqueta: 'Casos con mayor baja',
            prompt: 'Identifica a los estudiantes que más bajaron entre el Semestre 1 y el Semestre 2 y propone acciones.',
        });
    } else {
        acciones.push({
            etiqueta: 'Detectar alumnos en riesgo',
            prompt: 'Identifica a los estudiantes prioritarios bajo 4.0 en este curso y sugiere medidas preventivas Decreto 67.',
        });
        acciones.push({
            etiqueta: 'Plan por fases',
            prompt: 'Organiza estas recomendaciones en un plan concreto por fases con objetivo, acciones, responsable y plazo.',
        });
    }

    return acciones.slice(0, 3);
};
