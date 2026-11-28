import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SubidaExcelDirector from '@/Components/Director/SubidaExcelDirector';
import { Head, Link, usePage } from '@inertiajs/react';

export default function ImportarNotas() {
    const { auth } = usePage().props;

    return (
        <AuthenticatedLayout user={auth?.user}>
            <Head title="Importar Planillas Syscol" />

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                            Importación de Planillas Syscol
                        </h1>
                        <p className="text-slate-600 text-sm mt-1">
                            Sube una planilla Excel de Nómina y Calificaciones (.xlsx o .xls).
                        </p>
                    </div>
                    <Link
                        href={route('admin.director')}
                        className="text-sm font-bold text-sape-burdeo hover:underline shrink-0"
                    >
                        Volver al Panel de Dirección
                    </Link>
                </div>

                <SubidaExcelDirector />
            </div>
        </AuthenticatedLayout>
    );
}

