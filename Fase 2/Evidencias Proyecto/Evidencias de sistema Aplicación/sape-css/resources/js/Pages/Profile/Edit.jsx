import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head } from '@inertiajs/react';
import { motion } from 'framer-motion';

export default function Edit({ auth, mustVerifyEmail, status }) {
    const iniciales = (auth?.user?.name || 'U')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Mi Perfil - S.A.P.E CSS" />

            <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
                {/* CABECERA DE PERFIL INSTITUCIONAL */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-[#52100B] via-sape-burdeo to-[#8B1E16] rounded-2xl p-6 sm:p-8 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-sape-amarillo text-sape-burdeo font-extrabold text-2xl flex items-center justify-center shadow-md">
                            {iniciales}
                        </div>
                        <div>
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/15 text-sape-amarillo mb-1">
                                Cuenta Institucional Activa
                            </span>
                            <h1 className="text-2xl font-extrabold tracking-tight">{auth.user.name}</h1>
                            <p className="text-sm text-white/80">{auth.user.email}</p>
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="p-6 sm:p-8 bg-white shadow-sm rounded-2xl border border-slate-200/80"
                    >
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="w-full"
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="p-6 sm:p-8 bg-white shadow-sm rounded-2xl border border-slate-200/80"
                    >
                        <UpdatePasswordForm className="w-full" />
                    </motion.div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
