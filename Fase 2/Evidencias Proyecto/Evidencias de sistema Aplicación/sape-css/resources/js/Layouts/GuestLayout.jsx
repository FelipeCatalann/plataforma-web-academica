import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 font-sans selection:bg-sape-burdeo selection:text-white p-6 sm:p-10">
            <div className="mb-7 text-center">
                <Link href="/" className="inline-flex flex-col items-center gap-2 group">
                    <ApplicationLogo className="w-14 h-14 group-hover:scale-105 transition-transform" />
                    <div>
                        <span className="block text-xl font-extrabold tracking-tight text-sape-burdeo">
                            S.A.P.E <span className="text-slate-900">CSS</span>
                        </span>
                        <span className="block text-xs text-slate-500 font-medium">
                            Colegio San Sebastián de Melipilla
                        </span>
                    </div>
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/80 p-8 sm:p-10"
            >
                {children}
            </motion.div>

            <div className="mt-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-sape-burdeo transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                    <span>Volver al inicio</span>
                </Link>
            </div>
        </div>
    );
}
