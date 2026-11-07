import React, { useState } from 'react';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Login({ status, canResetPassword }) {
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [erroresLocales, setErroresLocales] = useState({});
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const errorEmail = erroresLocales.email || errors.email;
    const errorPassword = erroresLocales.password || errors.password;
    const mensajeErrorGeneral = errorEmail || errorPassword;

    const submit = (e) => {
        e.preventDefault();
        const nuevosErrores = {};
        const emailLimpio = (data.email || '').trim();

        if (!emailLimpio) {
            nuevosErrores.email = 'Debes ingresar tu correo electrónico.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
            nuevosErrores.email = 'El formato del correo electrónico ingresado no es válido.';
        }

        if (!data.password) {
            nuevosErrores.password = 'Debes ingresar tu contraseña para iniciar sesión.';
        }

        if (Object.keys(nuevosErrores).length > 0) {
            setErroresLocales(nuevosErrores);
            return;
        }

        setErroresLocales({});
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Iniciar Sesión - S.A.P.E CSS" />

            <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Bienvenido al Portal Institucional
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                    Ingresa con tus credenciales docentes o directivas para continuar.
                </p>
            </div>

            {status && (
                <div className="mb-5 text-sm font-semibold text-emerald-700 bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                    {status}
                </div>
            )}

            {mensajeErrorGeneral && (
                <div
                    role="alert"
                    aria-live="assertive"
                    className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3"
                >
                    <svg
                        className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                        />
                    </svg>
                    <div className="text-xs sm:text-sm">
                        <p className="font-extrabold text-red-900">
                            No se pudo iniciar sesión
                        </p>
                        <p className="font-medium text-red-700 mt-0.5">
                            {mensajeErrorGeneral}
                        </p>
                    </div>
                </div>
            )}

            <form onSubmit={submit} noValidate className="space-y-5">
                <div>
                    <InputLabel
                        htmlFor="email"
                        value="Correo Electrónico Institucional"
                        className="text-slate-700 font-bold text-xs uppercase tracking-wider mb-1.5"
                    />

                    <div className="relative">
                        <div className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${errorEmail ? 'text-red-500' : 'text-slate-400'}`}>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                                />
                            </svg>
                        </div>
                        <TextInput
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            placeholder="Ingresa tu correo electrónico"
                            aria-invalid={Boolean(errorEmail)}
                            className={`pl-11 block w-full ${errorEmail ? 'border-red-500 focus:border-red-600 focus:ring-red-500/20' : ''}`}
                            autoComplete="username"
                            isFocused={true}
                            onChange={(e) => {
                                setData('email', e.target.value);
                                if (erroresLocales.email) setErroresLocales((prev) => ({ ...prev, email: undefined }));
                                if (errors.email) clearErrors('email');
                            }}
                        />
                    </div>

                    <InputError message={errorEmail} className="mt-2 font-semibold" />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <InputLabel
                            htmlFor="password"
                            value="Contraseña"
                            className="text-slate-700 font-bold text-xs uppercase tracking-wider"
                        />
                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="text-xs text-sape-burdeo hover:text-sape-burdeo-hover font-bold transition-colors"
                            >
                                ¿Olvidaste tu contraseña?
                            </Link>
                        )}
                    </div>

                    <div className="relative">
                        <div className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${errorPassword ? 'text-red-500' : 'text-slate-400'}`}>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </div>
                        <TextInput
                            id="password"
                            type={mostrarPassword ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            placeholder="••••••••"
                            aria-invalid={Boolean(errorPassword)}
                            className={`pl-11 pr-11 block w-full ${errorPassword ? 'border-red-500 focus:border-red-600 focus:ring-red-500/20' : ''}`}
                            autoComplete="current-password"
                            onChange={(e) => {
                                setData('password', e.target.value);
                                if (erroresLocales.password) setErroresLocales((prev) => ({ ...prev, password: undefined }));
                                if (errors.password) clearErrors('password');
                            }}
                        />
                        <button
                            type="button"
                            aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            aria-pressed={mostrarPassword}
                            onClick={() => setMostrarPassword((prev) => !prev)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800 focus:outline-none focus:text-sape-burdeo transition-colors"
                        >
                            {mostrarPassword ? (
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                    />
                                </svg>
                            ) : (
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                </svg>
                            )}
                        </button>
                    </div>

                    <InputError message={errorPassword} className="mt-2 font-semibold" />
                </div>

                <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center cursor-pointer select-none">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            className="text-sape-burdeo focus:ring-sape-burdeo rounded"
                        />
                        <span className="ms-2 text-sm text-slate-600 font-medium">
                            Mantener sesión iniciada
                        </span>
                    </label>
                </div>

                <div className="pt-3">
                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full inline-flex items-center justify-center gap-2 bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover font-bold py-3 px-6 rounded-xl shadow-lg shadow-sape-burdeo/20 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sape-burdeo focus:ring-offset-2 disabled:opacity-50"
                    >
                        <span>{processing ? 'Verificando acceso...' : 'Iniciar Sesión en el Portal'}</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </form>
        </GuestLayout>
    );
}
