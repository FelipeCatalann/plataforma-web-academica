import axios from 'axios';

export function revisarImportacion(archivo, { onUploadProgress } = {}) {
    const datos = new FormData();
    datos.append('archivo_excel', archivo);
    return axios.post(route('admin.importar.revisar'), datos, {
        headers: { Accept: 'application/json' },
        onUploadProgress,
    });
}

export function mensajeRevision(error) {
    if (!error?.response) {
        return 'No fue posible conectar con el servidor. Verifica tu conexión e intenta nuevamente.';
    }
    if (error.response.status === 429) {
        return 'Realizaste varias revisiones seguidas. Espera unos segundos e intenta nuevamente.';
    }
    return error.response?.data?.errors?.archivo_excel?.[0]
        || error.response?.data?.message
        || 'No se pudo revisar la planilla.';
}
