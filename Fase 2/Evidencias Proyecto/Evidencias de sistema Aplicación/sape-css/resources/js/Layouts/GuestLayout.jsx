import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen flex bg-slate-50 font-sans selection:bg-sape-burdeo selection:text-white">
            {/* PANEL IZQUIERDO: IDENTIDAD INSTITUCIONAL Y PREVIEW ANIMADO (Oculto en móvil) */}
            <div className="hidden lg:flex lg:w-7/12 relative overflow-hidden bg-gradient-to-br from-[#4A0E09] via-[#6E1710] to-[#2E0805] text-white p-12 flex-col justify-between">
                {/* Luces ambientales decorativas */}
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-sape-amarillo/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Encabezado Institucional */}
                <div className="relative z-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3.5 group">
                        <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-lg group-hover:scale-105 transition-transform">
                            <ApplicationLogo className="w-10 h-10" />
                        </div>
                        <div>
                            <span className="block text-lg font-extrabold tracking-tight text-white">
                                S.A.P.E <span className="text-sape-amarillo">CSS</span>
                            </span>
                            <span className="block text-xs text-white/70 font-medium">
                                Colegio San Sebastián de Melipilla
                            </span>
                        </div>
                    </Link>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 border border-white/15 text-sape-amarillo backdrop-blur-sm">
                        Plataforma de Alerta Pedagógica
                    </span>
                </div>

                {/* Bloque Central con Tarjetas Flotantes Animadas */}
                <div className="relative z-10 max-w-xl space-y-6 my-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-4"
                    >
                        <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
                            Sistema de Alerta{' '}
                            <span className="text-sape-amarillo">Pedagógica Escolar</span>
                        </h1>
                        <p className="text-base text-white/80 leading-relaxed font-normal">
                            Plataforma integral para el monitoreo temprano del rendimiento académico, acompañamiento formativo y comunicación directa con apoderados.
                        </p>
                    </motion.div>

                    {/* Tarjetas flotantes de demostración */}
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.15 }}
                            className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-xl"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-sape-amarillo">
                                    Analítica Curricular
                                </span>
                            </div>
                            <p className="text-sm font-bold text-white">
                                Monitoreo por Curso y Asignatura
                            </p>
                            <p className="text-xs text-white/70 mt-1">
                                Detección automática de cuartiles y riesgo pedagógico.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.25 }}
                            className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-xl"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-sape-amarillo">
                                    Gestión Docente
                                </span>
                                <span className="text-xs font-extrabold text-white/90">IA + Bitácora</span>
                            </div>
                            <p className="text-sm font-bold text-white">
                                Informes y Acompañamiento
                            </p>
                            <p className="text-xs text-white/70 mt-1">
                                Asistente pedagógico y contacto formal con apoderados.
                            </p>
                        </motion.div>
                    </div>
                </div>

                {/* Pie Institucional */}
                <div className="relative z-10 flex items-center justify-between text-xs text-white/60 border-t border-white/10 pt-6">
                    <span>© {new Date().getFullYear()} Colegio San Sebastián de Melipilla</span>
                    <span>Enseñanza Media · Gestión Académica</span>
                </div>
            </div>

            {/* PANEL DERECHO: FORMULARIO DE ACCESO */}
            <div className="w-full lg:w-5/12 flex flex-col justify-center items-center p-6 sm:p-12 relative">
                {/* Encabezado visible solo en móvil */}
                <div className="lg:hidden mb-8 text-center">
                    <Link href="/" className="inline-flex flex-col items-center gap-2">
                        <ApplicationLogo className="w-14 h-14" />
                        <span className="text-xl font-extrabold text-sape-burdeo">
                            S.A.P.E CSS
                        </span>
                    </Link>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/80 p-8 sm:p-10"
                >
                    {children}
                </motion.div>
            </div>
        </div>
    );
}
