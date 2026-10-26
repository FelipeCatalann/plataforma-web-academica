import React, { useState, useRef, useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SearchableSelect from '@/Components/SearchableSelect';
import { Head, useForm, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';

// 1. Recibimos las asignaturas como prop
export default function PanelDirector({ auth, profesores = [], cursos = [], asignaturas = [] }) {
    const [vistaActiva, setVistaActiva] = useState('estadisticas');
    const { flash } = usePage().props;
    const [alertaGlobal, setAlertaGlobal] = useState('');
    console.log("Asignaturas cargadas:", asignaturas);
    useEffect(() => {
        if (flash?.success) {
            setAlertaGlobal(flash.success);
            setTimeout(() => setAlertaGlobal(''), 5000);
        }
    }, [flash]);

    const { data: dataImp, setData: setDataImp, post: postImp, processing: procImp, reset: resetImp } = useForm({
        archivo_excel: null,
    });
    const fileInputRef = useRef(null);

    const manejarSeleccionArchivo = (e) => {
        const file = e.target.files[0];
        if (file) setDataImp('archivo_excel', file);
    };

    const manejarImportacion = () => {
        if (!dataImp.archivo_excel) return;
        postImp(route('admin.importar.store'), {
            preserveScroll: true,
            onSuccess: () => {
                resetImp('archivo_excel');
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        });
    };

    // 2. Agregamos asignatura_id al formulario
    const { data: dataAsig, setData: setDataAsig, post: postAsig, processing: procAsig, reset: resetAsig, errors: errorsAsig } = useForm({
        profesor_id: '',
        curso_id: '',
        tipo_rol: 'jefe',
        asignatura_id: '' // Nuevo campo
    });

    const manejarAsignacion = (e) => {
        e.preventDefault();
        postAsig(route('admin.asignar.curso'), {
            preserveScroll: true,
            onSuccess: () => resetAsig()
        });
    };

    const cursosOpciones = useMemo(() => {
        return (cursos || []).map((curso) => ({
            id: curso.id,
            nombre: `${curso.nivel}° ${curso.letra}`,
            detalle: curso.anioEscolar ? `Año ${curso.anioEscolar}` : '',
        }));
    }, [cursos]);

    // Filtrar asignaturas: si hay curso seleccionado, trae las de ese curso (sin repetidas).
    // Si no hay curso, deduplica por nombre único para evitar nombres repetidos en la lista.
    const asignaturasDisponibles = useMemo(() => {
        if (dataAsig.curso_id) {
            const cursoSeleccionado = (cursos || []).find((c) => String(c.id) === String(dataAsig.curso_id));
            if (cursoSeleccionado && Array.isArray(cursoSeleccionado.asignaturas) && cursoSeleccionado.asignaturas.length > 0) {
                return cursoSeleccionado.asignaturas;
            }
        }

        const unicas = [];
        const nombresVistos = new Set();
        (asignaturas || []).forEach((asig) => {
            const nom = (asig.nombre || '').trim();
            if (nom && !nombresVistos.has(nom.toLowerCase())) {
                nombresVistos.add(nom.toLowerCase());
                unicas.push(asig);
            }
        });
        return unicas;
    }, [dataAsig.curso_id, cursos, asignaturas]);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Panel de Dirección" />

            <AnimatePresence>
                {alertaGlobal && (
                    <motion.div 
                        initial={{ opacity: 0, y: -50 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -50 }}
                        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-100 border-2 border-green-500 text-green-800 px-8 py-4 rounded-xl shadow-2xl font-bold text-lg flex items-center gap-3"
                    >
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        {alertaGlobal}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
                
                <aside className="w-full md:w-72 bg-white border-r border-sape-gris shadow-sm flex-shrink-0 relative z-10">
                    <div className="p-6">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Centro de Mando</h2>
                        <nav className="space-y-2 mb-6">
                            <button onClick={() => setVistaActiva('estadisticas')} className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group ${vistaActiva === 'estadisticas' ? 'bg-sape-burdeo text-sape-amarillo shadow-md' : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                                <span className="font-semibold text-sm">Estadísticas Globales</span>
                            </button>
                        </nav>

                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Administración</h2>
                        <nav className="space-y-2 mb-6">
                            <button onClick={() => setVistaActiva('profesores')} className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group ${vistaActiva === 'profesores' ? 'bg-sape-burdeo text-sape-amarillo shadow-md' : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                <span className="font-semibold text-sm">Asignar Profesores</span>
                            </button>
                            <button onClick={() => setVistaActiva('importar')} className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group ${vistaActiva === 'importar' ? 'bg-sape-burdeo text-sape-amarillo shadow-md' : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                <span className="font-semibold text-sm">Importar Datos</span>
                            </button>
                        </nav>
                    </div>
                </aside>

                <main className="flex-1 p-6 md:p-8 bg-gray-50 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        
                        {/* ESTADÍSTICAS */}
                        {vistaActiva === 'estadisticas' && (
                            <motion.div key="stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo">
                                    <h1 className="text-2xl font-bold text-sape-burdeo">Visión General</h1>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white p-6 rounded-xl border border-sape-gris shadow-sm flex items-center gap-4">
                                        <div className="p-3 bg-sape-gris-claro text-sape-burdeo rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg></div>
                                        <div><p className="text-sm text-gray-500 font-semibold">Cursos Activos</p><p className="text-2xl font-bold text-gray-800">{cursos.length || 0}</p></div>
                                    </div>
                                    <div className="bg-white p-6 rounded-xl border border-sape-gris shadow-sm flex items-center gap-4">
                                        <div className="p-3 bg-sape-burdeo/10 text-sape-burdeo rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>
                                        <div><p className="text-sm text-gray-500 font-semibold">Profesores</p><p className="text-2xl font-bold text-gray-800">{profesores.length || 0}</p></div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ASIGNACIÓN DE PROFESORES */}
                        {vistaActiva === 'profesores' && (
                            <motion.div key="profesores" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo">
                                    <h1 className="text-2xl font-bold text-sape-burdeo">Asignación de Carga Académica</h1>
                                    <p className="text-gray-500 text-sm mt-1">Vincula a los profesores con sus respectivos cursos para habilitar su acceso al Libro de Clases.</p>
                                </div>

                                <div className="bg-white p-8 rounded-xl border border-sape-gris shadow-sm max-w-2xl">
                                    <form onSubmit={manejarAsignacion} className="space-y-5">
                                        
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">1. Seleccionar Profesor</label>
                                            <SearchableSelect
                                                options={profesores}
                                                value={dataAsig.profesor_id}
                                                onChange={(val) => setDataAsig('profesor_id', val)}
                                                placeholder="-- Selecciona o busca un profesor --"
                                                searchPlaceholder="Buscar profesor por nombre o correo..."
                                                name="profesor_id"
                                                required
                                                error={errorsAsig.profesor_id}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">2. Seleccionar Curso</label>
                                            <SearchableSelect
                                                options={cursosOpciones}
                                                value={dataAsig.curso_id}
                                                onChange={(val) => {
                                                    setDataAsig((prev) => ({
                                                        ...prev,
                                                        curso_id: val,
                                                        asignatura_id: '',
                                                    }));
                                                }}
                                                labelKey="nombre"
                                                subLabelKey="detalle"
                                                placeholder="-- Selecciona o busca un curso --"
                                                searchPlaceholder="Buscar curso por nivel o letra (ej. 1° B)..."
                                                name="curso_id"
                                                required
                                                error={errorsAsig.curso_id}
                                                emptyTitle="No se encontraron cursos"
                                                itemSingular="curso disponible"
                                                itemPlural="cursos disponibles"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">3. Tipo de Asignación (Rol)</label>
                                            <div className="flex gap-6 bg-gray-50 p-3 rounded-lg border border-sape-gris">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="radio" name="tipo_rol" value="jefe" 
                                                        checked={dataAsig.tipo_rol === 'jefe'}
                                                        onChange={(e) => {
                                                            setDataAsig('tipo_rol', 'jefe');
                                                            setDataAsig('asignatura_id', ''); // Limpiamos la asignatura si es jefe
                                                        }}
                                                        className="text-sape-burdeo focus:ring-sape-burdeo w-5 h-5"
                                                    />
                                                    <span className="font-bold text-gray-800">Profesor Jefe</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="radio" name="tipo_rol" value="asignatura" 
                                                        checked={dataAsig.tipo_rol === 'asignatura'}
                                                        onChange={(e) => setDataAsig('tipo_rol', 'asignatura')}
                                                        className="text-sape-burdeo focus:ring-sape-burdeo w-5 h-5"
                                                    />
                                                    <span className="font-bold text-gray-800">Profesor de Asignatura</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* 3. MOSTRAMOS LAS ASIGNATURAS SOLO SI ELIGIÓ "Profesor de Asignatura" */}
                                        <AnimatePresence>
                                            {dataAsig.tipo_rol === 'asignatura' && (
                                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pt-2">
                                                    <div>
                                                        <label className="block text-sm font-semibold text-gray-700 mb-1">4. Seleccionar Asignatura</label>
                                                        <SearchableSelect
                                                            options={asignaturasDisponibles}
                                                            value={dataAsig.asignatura_id}
                                                            onChange={(val) => setDataAsig('asignatura_id', val)}
                                                            labelKey="nombre"
                                                            subLabelKey=""
                                                            placeholder="-- Selecciona o busca la Asignatura --"
                                                            searchPlaceholder="Buscar asignatura por nombre..."
                                                            name="asignatura_id"
                                                            required={dataAsig.tipo_rol === 'asignatura'}
                                                            error={errorsAsig.asignatura_id}
                                                            emptyTitle="No se encontraron asignaturas"
                                                            itemSingular="asignatura disponible"
                                                            itemPlural="asignaturas disponibles"
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="pt-4 border-t border-sape-gris flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={procAsig}
                                                className="bg-sape-burdeo text-sape-amarillo px-8 py-3 rounded-lg font-bold shadow-md hover:bg-sape-burdeo-hover transition-colors disabled:opacity-50"
                                            >
                                                {procAsig ? 'Guardando...' : 'Asignar Carga Académica'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        )}

                        {/* IMPORTAR DATOS */}
                        {vistaActiva === 'importar' && (
                            <motion.div key="importar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo">
                                    <h1 className="text-2xl font-bold text-sape-burdeo">Importación Syscol</h1>
                                </div>
                                <div className="bg-white p-8 rounded-xl border border-sape-gris shadow-sm">
                                    <input type="file" ref={fileInputRef} onChange={manejarSeleccionArchivo} className="hidden" accept=".csv, .xls, .xlsx" />
                                    <div onClick={() => fileInputRef.current.click()} className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 transition-colors cursor-pointer text-center ${dataImp.archivo_excel ? 'border-sape-burdeo bg-sape-burdeo/5' : 'border-sape-gris hover:bg-gray-50'}`}>
                                        <svg className={`h-16 w-16 mb-4 ${dataImp.archivo_excel ? 'text-sape-burdeo' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <p className="text-gray-700 font-bold text-lg">{dataImp.archivo_excel ? dataImp.archivo_excel.name : 'Haz clic para seleccionar tu archivo Excel'}</p>
                                    </div>
                                    <div className="mt-8 flex justify-end">
                                        <button onClick={manejarImportacion} disabled={!dataImp.archivo_excel || procImp} className="bg-sape-burdeo text-sape-amarillo px-8 py-3 rounded-lg font-bold hover:bg-sape-burdeo-hover disabled:opacity-50">
                                            {procImp ? 'Procesando...' : 'Importar Archivo'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </AuthenticatedLayout>
    );
}