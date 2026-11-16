import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function AccesoRestringido({ mensaje }) {
    return (
        <AuthenticatedLayout>
            <Head title="Acceso restringido" />
            <section aria-labelledby="titulo-acceso" className="mx-auto my-10 w-full max-w-xl px-4 sm:px-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                    <h1 id="titulo-acceso" className="text-2xl font-extrabold text-slate-900">Acceso restringido</h1>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{mensaje}</p>
                    <Link
                        href={route('dashboard')}
                        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-sape-burdeo px-4 py-2 text-sm font-bold text-sape-amarillo hover:bg-sape-burdeo-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        Volver al inicio
                    </Link>
                </div>
            </section>
        </AuthenticatedLayout>
    );
}
