import React from 'react';
import { obtenerPresentacionModelo } from '@/utils/preferenciasSape';

export default function NombreModeloIA({
    modelo,
    modelId = null,
    variante = 'claro',
    mostrarTecnico = true,
    className = '',
    tecnicoClassName = '',
}) {
    const info = obtenerPresentacionModelo(modelo, modelId);

    const claseTecnico =
        variante === 'burdeo'
            ? 'sape-modelo-tecnico-burdeo'
            : variante === 'chip-activo'
              ? 'sape-modelo-tecnico-activo'
              : 'sape-modelo-tecnico';

    return (
        <span className={className} title={info.etiquetaCompleta}>
            <span>{info.nombre}</span>
            {mostrarTecnico && info.nombreTecnico ? (
                <span className={`${claseTecnico}${tecnicoClassName ? ` ${tecnicoClassName}` : ''}`}>
                    {' '}({info.nombreTecnico})
                </span>
            ) : null}
        </span>
    );
}
