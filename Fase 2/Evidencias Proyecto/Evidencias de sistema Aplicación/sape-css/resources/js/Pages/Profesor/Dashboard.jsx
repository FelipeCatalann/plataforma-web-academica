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

            <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
                {/* Cabecera de Bienvenida limpia */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                            Hola, {auth.user.name.split(' ')[0]} 👋
                        </h1>
                        <p className="text-slate-500 font-medium text-sm sm:text-base mt-2 capitalize">
                            {fechaFormateada} • Portal Docente S.A.P.E
                        </p>
                    </div>
                    <div className="bg-white text-slate-800 px-5 py-2.5 rounded-full text-sm font-bold border border-slate-200 shadow-sm">
                        Año Escolar {new Date().getFullYear()}
                    </div>
                </div>

                {/* Portales Inmersivos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    
                    {/* PORTAL 1: JEFATURA (Gradiente Institucional Burdeo) */}
                    <Link
                        href={route('profesor.jefe')}
                        className="relative overflow-hidden group bg-gradient-to-br from-sape-burdeo to-[#4a0e0a] rounded-[2rem] p-8 sm:p-10 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500"
                    >
                        {/* Marca de agua decorativa */}
                        <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                            <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>

                        {/* Contenido */}
                        <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
                            <div>
                                <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded-full mb-6">
                                    Módulo Principal
                                </span>
                                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
                                    Mi Jefatura
                                </h2>
                                <p className="text-white/80 text-sm sm:text-base font-medium max-w-sm leading-relaxed">
                                    Radiografía de tu curso, alertas por Decreto 67 y contacto con apoderados.
                                </p>
                            </div>
                            
                            <div className="mt-10 inline-flex items-center justify-between w-max gap-3 bg-white text-sape-burdeo px-7 py-3.5 rounded-2xl font-extrabold group-hover:bg-sape-amarillo group-hover:text-slate-900 transition-colors duration-300 shadow-sm">
                                Entrar a mi curso
                                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </div>
                        </div>
                    </Link>

                    {/* PORTAL 2: ASIGNATURAS (Gradiente Oscuro Elegante) */}
                    <Link
                        href={route('profesor.asignatura')}
                        className="relative overflow-hidden group bg-gradient-to-br from-slate-800 to-slate-950 rounded-[2rem] p-8 sm:p-10 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500"
                    >
                        {/* Marca de agua decorativa */}
                        <div className="absolute -right-8 -bottom-8 opacity-[0.07] group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none">
                            <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>

                        {/* Contenido */}
                        <div className="relative z-10 flex flex-col h-full justify-between min-h-[220px]">
                            <div>
                                <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/10 text-slate-300 text-xs font-bold rounded-full mb-6">
                                    Gestión Académica
                                </span>
                                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight group-hover:text-sape-amarillo transition-colors duration-300">
                                    Mis Asignaturas
                                </h2>
                                <p className="text-slate-400 text-sm sm:text-base font-medium max-w-sm leading-relaxed">
                                    Libro de notas, rendimiento semestral y comparativas entre cursos.
                                </p>
                            </div>
                            
                            <div className="mt-10 inline-flex items-center justify-between w-max gap-3 bg-white/10 backdrop-blur-md border border-white/20 text-white px-7 py-3.5 rounded-2xl font-extrabold group-hover:bg-sape-amarillo group-hover:text-slate-900 group-hover:border-sape-amarillo transition-all duration-300 shadow-sm">
                                Ver asignaturas
                                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </div>
                        </div>
                    </Link>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}