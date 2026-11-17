export const NOTA_MINIMA = 4;
export const ASISTENCIA_MINIMA = 85;

function promedio(valores) {
    if (valores.length === 0) return null;

    const media = valores.reduce((suma, valor) => suma + valor, 0) / valores.length;
    return Math.round((media + Number.EPSILON) * 10) / 10;
}

function resumen(notas) {
    const numericas = notas.filter((nota) => nota !== null);
    const bajoMinimo = numericas.filter((nota) => nota < NOTA_MINIMA).length;

    return {
        promedio: promedio(numericas),
        total: numericas.length,
        bajoMinimo,
        desdeMinimo: numericas.length - bajoMinimo,
    };
}

export function calcularMapaTermico(curso, semestre) {
    const asignaturas = [...new Map(curso.asignaturas.map((asignatura) => [asignatura.id, asignatura])).values()]
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const filas = curso.estudiantes.map((estudiante) => {
        const notasPorAsignatura = new Map();

        for (const calificacion of estudiante.calificaciones) {
            const nota = Number(calificacion.valor);
            const periodo = Number(calificacion.semestre);
            if (!(nota >= 1 && nota <= 7) || ![1, 2].includes(periodo)) continue;

            const id = calificacion.asignatura_id;
            if (!notasPorAsignatura.has(id)) notasPorAsignatura.set(id, [[], []]);
            notasPorAsignatura.get(id)[periodo - 1].push(nota);
        }

        const notas = asignaturas.map(({ id }) => {
            const periodos = notasPorAsignatura.get(id);
            if (!periodos) return null;

            const promedios = periodos.map(promedio);
            return semestre === 0 ? promedio(promedios.filter((nota) => nota !== null)) : promedios[semestre - 1];
        });

        const { promedio: promedioGeneral, bajoMinimo } = resumen(notas);
        return { estudiante, notas, promedioGeneral, bajoMinimo };
    });

    return {
        asignaturas,
        filas,
        curso: resumen(filas.map((fila) => fila.promedioGeneral)),
        porAsignatura: asignaturas.map((_, indice) => resumen(filas.map((fila) => fila.notas[indice]))),
    };
}
