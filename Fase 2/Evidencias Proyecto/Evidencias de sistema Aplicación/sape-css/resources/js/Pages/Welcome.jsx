import ApplicationLogo from '@/Components/ApplicationLogo';
import { Head, Link } from '@inertiajs/react';

export default function Welcome({ auth }) {
    return (
        <>
            <Head title="Bienvenidos - S.A.P.E CSS" />

            <div className="min-h-screen flex flex-col font-sans bg-slate-950 text-white selection:bg-sape-amarillo selection:text-sape-burdeo">
                {/* NAVBAR FLOTANTE */}
                <header className="sticky top-0 z-30 backdrop-blur-md bg-[#4A0E09]/85 border-b border-white/10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <ApplicationLogo className="w-9 h-9" />
                            <div>
                                <span className="font-extrabold text-white text-base tracking-tight block leading-none">
                                    S.A.P.E <span className="text-sape-amarillo">CSS</span>
                                </span>
                                <span className="text-[11px] text-white/70 font-medium hidden sm:block">
                                    Colegio San Sebastián de Melipilla
                                </span>
                            </div>
                        </div>

                        <nav className="flex gap-3 items-center">
                            {auth?.user ? (
                                <Link
                                    href={route('dashboard')}
                                    className="text-sape-burdeo bg-sape-amarillo hover:bg-yellow-400 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-md hover:-translate-y-0.5"
                                >
                                    Ir a mi Portal →
                                </Link>
                            ) : (
                                <Link
                                    href={route('login')}
                                    className="text-sape-burdeo bg-sape-amarillo hover:bg-yellow-400 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-md hover:-translate-y-0.5"
                                >
                                    Iniciar Sesión
                                </Link>
                            )}
                        </nav>
                    </div>
                </header>

                <main className="welcome-direct">
                    <div className="welcome-direct-intro">
                        <ApplicationLogo className="h-16 w-16" aria-hidden="true" />
                        <h1>S.A.P.E <span>CSS</span></h1>
                        <p>El portal del Colegio San Sebastián de Melipilla para seguir el rendimiento escolar y actuar a tiempo.</p>
                        <Link
                            href={auth?.user ? route('dashboard') : route('login')}
                            className="inline-flex min-h-12 w-fit items-center justify-center rounded-xl bg-sape-amarillo px-6 py-3 text-sm font-extrabold text-sape-burdeo transition-colors hover:bg-yellow-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                        >
                            {auth?.user ? 'Ir a mi portal' : 'Iniciar sesión'}
                        </Link>
                    </div>
                    <ul className="welcome-direct-capabilities">
                        <li>Rendimiento por curso</li>
                        <li>Alertas académicas</li>
                            <li>Informes y seguimiento pedagógico</li>
                    </ul>
                </main>

                <footer className="bg-[#240604] border-t border-white/10 py-5 text-center">
                    <p className="text-white/60 text-xs font-medium">
                        © {new Date().getFullYear()} Colegio San Sebastián de Melipilla · Sistema de Alerta Pedagógica Escolar (S.A.P.E CSS)
                    </p>
                </footer>
            </div>
        </>
    );
}
