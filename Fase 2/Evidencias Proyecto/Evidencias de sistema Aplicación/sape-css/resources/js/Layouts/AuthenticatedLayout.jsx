import Dropdown from '@/Components/Dropdown';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function AuthenticatedLayout({ header, children }) {
    const user = usePage().props.auth.user;
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);

    const iniciales = (user?.name || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('');

    const enRutaDocente =
        route().current('profesor.jefe') || route().current('profesor.asignatura');

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Barra superior institucional unificada */}
            <nav className="bg-sape-burdeo border-b border-sape-burdeo-hover shadow-md">
                <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between">
                        <div className="flex items-center">
                            {/* LOGO DEL COLEGIO */}
                            <div className="flex shrink-0 items-center gap-3">
                                <Link href={route('dashboard')} className="flex items-center gap-2.5 group">
                                    <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-sape-burdeo font-extrabold text-sm shadow-inner ring-2 ring-sape-amarillo/80 group-hover:scale-105 transition-transform">
                                        CSS
                                    </div>
                                    <div className="hidden sm:block leading-tight">
                                        <span className="text-white font-bold block tracking-wide text-sm">
                                            Colegio San Sebastián
                                        </span>
                                        <span className="text-sape-amarillo/90 text-[11px] font-medium block">
                                            Plataforma Académica S.A.P.E
                                        </span>
                                    </div>
                                </Link>
                            </div>

                            {/* NAVEGACIÓN RÁPIDA SUPERIOR */}
                            <div className="hidden space-x-2 sm:-my-px sm:ms-10 sm:flex items-center">
                                <Link
                                    href={route('dashboard')}
                                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition duration-150 ease-in-out ${
                                        route().current('dashboard')
                                            ? 'bg-sape-burdeo-hover text-sape-amarillo shadow-inner ring-1 ring-white/15'
                                            : 'text-white/80 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    Inicio
                                </Link>

                                {enRutaDocente && (
                                    <>
                                        <Link
                                            href={route('profesor.jefe')}
                                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition duration-150 ease-in-out ${
                                                route().current('profesor.jefe')
                                                    ? 'bg-sape-burdeo-hover text-sape-amarillo shadow-inner ring-1 ring-white/15'
                                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                            }`}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                            Mi Jefatura
                                        </Link>

                                        <Link
                                            href={route('profesor.asignatura')}
                                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition duration-150 ease-in-out ${
                                                route().current('profesor.asignatura')
                                                    ? 'bg-sape-burdeo-hover text-sape-amarillo shadow-inner ring-1 ring-white/15'
                                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                            }`}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253" />
                                            </svg>
                                            Mis Asignaturas
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="hidden sm:ms-6 sm:flex sm:items-center">
                            <div className="relative ms-3">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-md">
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-2.5 rounded-lg border border-white/15 bg-sape-burdeo-hover/70 px-3 py-1.5 text-sm font-medium leading-4 text-white hover:text-sape-amarillo hover:border-sape-amarillo/40 focus:outline-none transition ease-in-out duration-150"
                                            >
                                                <span className="w-7 h-7 rounded-full bg-sape-amarillo text-sape-burdeo font-extrabold text-xs flex items-center justify-center">
                                                    {iniciales}
                                                </span>
                                                <span>{user.name}</span>

                                                <svg className="-me-0.5 h-4 w-4 opacity-80" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </span>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content>
                                        <Dropdown.Link href={route('profile.edit')}>Mi Perfil</Dropdown.Link>
                                        <Dropdown.Link href={route('logout')} method="post" as="button">Cerrar Sesión</Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            </div>
                        </div>

                        {/* Menú Móvil */}
                        <div className="-me-2 flex items-center sm:hidden">
                            <button
                                onClick={() => setShowingNavigationDropdown((previousState) => !previousState)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-gray-200 hover:bg-sape-burdeo-hover hover:text-white focus:outline-none transition duration-150 ease-in-out"
                            >
                                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                    <path className={!showingNavigationDropdown ? 'inline-flex' : 'hidden'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    <path className={showingNavigationDropdown ? 'inline-flex' : 'hidden'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Desplegable en Móvil */}
                <div className={(showingNavigationDropdown ? 'block' : 'hidden') + ' sm:hidden bg-white'}>
                    <div className="space-y-1 pb-3 pt-2">
                        <ResponsiveNavLink href={route('dashboard')} active={route().current('dashboard')}>Inicio</ResponsiveNavLink>
                        {enRutaDocente && (
                            <>
                                <ResponsiveNavLink href={route('profesor.jefe')} active={route().current('profesor.jefe')}>Mi Jefatura</ResponsiveNavLink>
                                <ResponsiveNavLink href={route('profesor.asignatura')} active={route().current('profesor.asignatura')}>Mis Asignaturas</ResponsiveNavLink>
                            </>
                        )}
                    </div>
                    <div className="border-t border-gray-200 pb-1 pt-4">
                        <div className="px-4">
                            <div className="text-base font-medium text-gray-800">{user.name}</div>
                            <div className="text-sm font-medium text-gray-500">{user.email}</div>
                        </div>
                        <div className="mt-3 space-y-1">
                            <ResponsiveNavLink href={route('profile.edit')}>Mi Perfil</ResponsiveNavLink>
                            <ResponsiveNavLink method="post" href={route('logout')} as="button">Cerrar Sesión</ResponsiveNavLink>
                        </div>
                    </div>
                </div>
            </nav>

            {header && (
                <header className="bg-white shadow-sm border-b border-sape-gris">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{header}</div>
                </header>
            )}
            <main>{children}</main>
        </div>
    );
}
