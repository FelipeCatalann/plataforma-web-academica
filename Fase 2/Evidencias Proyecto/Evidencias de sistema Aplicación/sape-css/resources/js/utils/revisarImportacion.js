import axios from 'axios';

export function revisarImportacion(archivo) {
    const datos = new FormData();
    datos.append('archivo_excel', archivo);
    return axios.post(route('admin.importar.revisar'), datos, {
        headers: { Accept: 'application/json' },
    });
}

export function mensajeRevision(error) {
    return error.response?.data?.errors?.archivo_excel?.[0]
        || error.response?.data?.message
        || 'No se pudo revisar la planilla.';
}
