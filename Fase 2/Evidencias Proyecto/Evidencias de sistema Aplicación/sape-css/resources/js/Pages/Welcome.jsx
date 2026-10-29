import ApplicationLogo from '@/Components/ApplicationLogo';
import { Head, Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

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

                {/* HERO PRINCIPAL CON ANIMACIONES */}
                <main className="flex-grow flex flex-col justify-center bg-gradient-to-br from-[#3A0A06] via-[#6E1710] to-[#240604] px-4 sm:px-6 py-16 relative overflow-hidden">
                    {/* Luces de fondo */}
                    <div className="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-sape-amarillo/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-[32rem] h-[32rem] bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="max-w-6xl mx-auto w-full relative z-10 space-y-14">
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, ease: 'easeOut' }}
                            className="text-center max-w-3xl mx-auto space-y-6"
                        >
                            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur-md text-sape-amarillo px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase shadow-sm">
                                Plataforma de Alerta Pedagógica
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
                                Gestión Académica y{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sape-amarillo via-amber-200 to-white">
                                    Acompañamiento Escolar
                                </span>
                            </h1>

                            <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
                                Monitoreo temprano de calificaciones, detección de riesgo académico por cuartiles, asistente pedagógico con IA y comunicación formal con apoderados.
                            </p>

                            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
                                <Link
                                    href={auth?.user ? route('dashboard') : route('login')}
                                    className="inline-flex justify-center items-center gap-2 bg-sape-amarillo text-sape-burdeo font-extrabold text-base px-8 py-4 rounded-xl hover:bg-yellow-400 transition-all transform hover:-translate-y-0.5 shadow-xl shadow-black/20"
                                >
                                    <span>{auth?.user ? 'Ingresar a mi Portal' : 'Acceder al Sistema'}</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </Link>
                            </div>
                        </motion.div>

                        {/* TARJETAS DE PILARES DEL SISTEMA */}
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: { opacity: 0 },
                                visible: {
                                    opacity: 1,
                                    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
                                },
                            }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                            {[
                                {
                                    badge: 'Analítica Institucional',
                                    title: 'Monitoreo por Curso y Cuartiles',
                                    desc: 'Visualización en tiempo real del rendimiento de 1° a 4° Medio a partir de planillas oficiales Syscol.',
                                },
                                {
                                    badge: 'Seguimiento Pedagógico',
                                    title: 'Alertas y Bitácora Pedagógica',
                                    desc: 'Identificación automática de estudiantes en situación crítica e historial trazable de intervenciones.',
                                },
                                {
                                    badge: 'Vínculo Familia-Escuela',
                                    title: 'Informes IA y Contacto Apoderados',
                                    desc: 'Generación asistida de reportes ejecutivos y mensajería pre-estructurada para apoderados.',
                                },
                            ].map((item, idx) => (
                                <motion.div
                                    key={idx}
                                    variants={{
                                        hidden: { opacity: 0, y: 20 },
                                        visible: { opacity: 1, y: 0 },
                                    }}
                                    whileHover={{ y: -4 }}
                                    className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 shadow-xl transition-all"
                                >
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-sape-amarillo">
                                        {item.badge}
                                    </span>
                                    <h3 className="text-lg font-extrabold text-white mt-1.5">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm text-white/75 mt-2 leading-relaxed">
                                        {item.desc}
                                    </p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
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
