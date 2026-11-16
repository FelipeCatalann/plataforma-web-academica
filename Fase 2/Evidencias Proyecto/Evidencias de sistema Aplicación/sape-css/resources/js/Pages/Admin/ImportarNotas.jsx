import React, { useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { mensajeRevision, revisarImportacion } from '@/utils/revisarImportacion';

export default function ImportarNotas() {
    // Obtenemos las variables de sesión global (flash) desde Inertia
    const { flash } = usePage().props;

    // Manejo del formulario
    const { data, setData, post, processing, errors } = useForm({
        archivo_excel: null,
    });
    const [revisado, setRevisado] = useState(null);
    const [revisando, setRevisando] = useState(false);
    const [errorRevision, setErrorRevision] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        if (!data.archivo_excel || revisando || processing) return;
        setErrorRevision('');
        if (revisado !== data.archivo_excel) {
            setRevisando(true);
            try {
                await revisarImportacion(data.archivo_excel);
                setRevisado(data.archivo_excel);
            } catch (error) {
                setErrorRevision(mensajeRevision(error));
            } finally {
                setRevisando(false);
            }
            return;
        }
        post(route('admin.importar.store'), {
            forceFormData: true, // Importante para enviar archivos binarios correctamente
            onFinish: () => setRevisado(null),
        });
    };

    return (
        <div className="p-6 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-4 mt-10">
            <h1 className="text-xl font-bold text-gray-800">
                Módulo ETL: Importar Nómina y Calificaciones
            </h1>
            
            {/* Mensaje de Éxito */}
            {flash?.success && (
                <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded-md text-sm">
                    {flash.success}
                </div>
            )}
            
            {/* Mensaje de Error global / Excepción */}
            {flash?.error && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                    {flash.error}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Seleccionar planilla Excel
                    </label>
                    <input 
                        type="file"
                        accept=".xlsx,.xls"
                        disabled={revisando || processing}
                        onChange={e => setData('archivo_excel', e.target.files[0])}
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm text-gray-700"
                    />
                    
                    {/* Mensaje de Error de Validación en el archivo */}
                    {(errorRevision || errors.archivo_excel) && (
                        <div className="text-red-500 text-sm mt-1">
                            {errorRevision || errors.archivo_excel}
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={!data.archivo_excel || processing || revisando}
                    className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                    {processing ? 'Importando…' : revisando ? 'Revisando…' :
                        revisado === data.archivo_excel && revisado ? 'Confirmar importación' : 'Revisar planilla'}
                </button>
            </form>
        </div>
    );
}
