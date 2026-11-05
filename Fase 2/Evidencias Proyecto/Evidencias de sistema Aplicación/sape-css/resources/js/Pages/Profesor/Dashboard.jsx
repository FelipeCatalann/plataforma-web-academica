import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function Dashboard({ auth }) {
    const fechaActual = new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const fechaFormateada = fechaActual.charAt(0).toUpperCase() + fechaActual.slice(1);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Portal Docente" />

            <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
                {/* Cabecera de Bienvenida */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                            Bienvenido, {auth.user.name}
                        </h1>
                        <p className="text-slate-600 text-sm sm:text-base mt-1 capitalize">
                            {fechaFormateada} • Portal Docente S.A.P.E CSS
                        </p>
                    </div>
                    <div className="bg-slate-100 text-sape-burdeo px-4 py-2 rounded-xl text-sm font-extrabold border border-slate-200/80 tabular-nums">
                        Año Escolar {new Date().getFullYear()}
                    </div>
                </div>

                {/* Tarjetas de Acceso Rápido */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tarjeta Jefatura */}
                    <Link
                        href={route('profesor.jefe')}
                        className="group bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between hover:border-sape-burdeo hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <div>
                            <div className="flex justify-between items-start gap-4 mb-4">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 group-hover:text-sape-burdeo transition-colors">
                                        Mi Jefatura de Curso
                                    </h2>
                                    <p className="text-xs font-bold text-slate-500 mt-0.5">
                                        Seguimiento integral, alertas Decreto 67 y contacto con apoderados
                                    </p>
                                </div>
                                <div className="p-3.5 bg-sape-burdeo/10 text-sape-burdeo rounded-2xl group-hover:bg-sape-burdeo group-hover:text-sape-amarillo transition-colors shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                                    </svg>
                                </div>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed mb-8">
                                Revisa la radiografía completa de calificaciones de tu curso asignado, identifica alumnos con subsectores bajo 4.0 y genera informes ejecutivos o comunicaciones por WhatsApp.
                            </p>
                        </div>
                        <div className="text-sape-burdeo font-extrabold text-sm flex items-center gap-2 group-hover:text-sape-burdeo-hover transition-colors">
                            <span>Ingresar a Mi Jefatura</span>
                            <span className="transform group-hover:translate-x-1 transition-transform" aria-hidden="true">&rarr;</span>
                        </div>
                    </Link>

                    {/* Tarjeta Asignaturas */}
                    <Link
                        href={route('profesor.asignatura')}
                        className="group bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between hover:border-sape-burdeo hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <div>
                            <div className="flex justify-between items-start gap-4 mb-4">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 group-hover:text-sape-burdeo transition-colors">
                                        Mis Asignaturas Impartidas
                                    </h2>
                                    <p className="text-xs font-bold text-slate-500 mt-0.5">
                                        Comparativa entre cursos, libro de notas y asistente IA por subsector
                                    </p>
                                </div>
                                <div className="p-3.5 bg-sape-burdeo/10 text-sape-burdeo rounded-2xl group-hover:bg-sape-burdeo group-hover:text-sape-amarillo transition-colors shrink-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253"></path>
                                    </svg>
                                </div>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed mb-8">
                                Compara el rendimiento de tus subsectores entre distintos cursos de Enseñanza Media y consulta el detalle semestral y anual de cada estudiante.
                            </p>
                        </div>
                        <div className="text-sape-burdeo font-extrabold text-sm flex items-center gap-2 group-hover:text-sape-burdeo-hover transition-colors">
                            <span>Ingresar a Mis Asignaturas</span>
                            <span className="transform group-hover:translate-x-1 transition-transform" aria-hidden="true">&rarr;</span>
                        </div>
                    </Link>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}