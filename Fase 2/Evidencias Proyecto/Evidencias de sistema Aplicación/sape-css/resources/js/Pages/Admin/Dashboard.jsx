import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function PanelDirector({ auth }) {
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Panel de Administración" />

            <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                            Centro de Administración Institucional
                        </h1>
                        <p className="text-slate-600 text-sm mt-1">
                            Monitoreo de rendimiento académico, carga de planillas Syscol y asignación de plantel docente.
                        </p>
                    </div>
                    <Link
                        href={route('dashboard')}
                        className="bg-sape-burdeo text-sape-amarillo px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-sape-burdeo-hover transition-all self-start sm:self-auto"
                    >
                        Ir al Panel de Dirección
                    </Link>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
