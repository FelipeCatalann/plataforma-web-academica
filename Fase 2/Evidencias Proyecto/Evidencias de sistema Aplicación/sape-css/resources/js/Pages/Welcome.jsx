import { Head, Link } from '@inertiajs/react';

export default function Welcome({ auth }) {
    return (
        <>
            <Head title="Bienvenidos - Colegio San Sebastián" />
            
            <div className="min-h-screen flex flex-col font-sans">
                
                <header className="bg-sape-burdeo py-4 shadow-md z-10 relative">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-sape-burdeo font-bold text-xl shadow-inner">
                                CSS
                            </div>
                            <span className="font-bold text-white text-xl tracking-wide hidden sm:block">
                                Colegio San Sebastián
                            </span>
                        </div>
                        <nav className="flex gap-4 items-center">
                            {auth.user ? (
                                <Link 
                                    href={route('dashboard')} 
                                    className="text-sape-burdeo bg-white hover:bg-sape-gris-claro px-5 py-2 rounded-md font-bold transition-colors shadow-sm"
                                >
                                    Ir a mi Portal
                                </Link>
                            ) : (
                                <Link 
                                    href={route('login')} 
                                    className="text-sape-burdeo bg-sape-amarillo hover:bg-yellow-400 px-6 py-2 rounded-md font-bold transition-all shadow-md hover:shadow-lg"
                                >
                                    Iniciar Sesión
                                </Link>
                            )}
                        </nav>
                    </div>
                </header>

                <main className="flex-grow flex items-center justify-center bg-gradient-to-b from-sape-burdeo to-sape-burdeo-hover px-4 sm:px-6 relative overflow-hidden">
                    
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute w-96 h-96 bg-white rounded-full blur-3xl -top-20 -left-20"></div>
                        <div className="absolute w-96 h-96 bg-sape-amarillo rounded-full blur-3xl bottom-10 right-10"></div>
                    </div>

                    <div className="max-w-4xl text-center space-y-8 relative z-10">
                        <div className="inline-block bg-sape-amarillo text-sape-burdeo px-4 py-1 rounded-full text-sm font-bold tracking-wider uppercase mb-4 shadow-sm">
                            Plataforma Institucional
                        </div>
                        
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight drop-shadow-md">
                            Sistema de Gestión <br /> 
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-sape-amarillo">
                                Académica
                            </span>
                        </h1>
                        
                        <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto font-light leading-relaxed">
                            Portal oficial del Colegio San Sebastián de Melipilla. Un espacio centralizado para gestionar el rendimiento escolar, calificaciones y recursos de nuestra comunidad educativa.
                        </p>
                        
                        <div className="pt-8 flex flex-col sm:flex-row justify-center gap-4">
                            {auth.user ? (
                                <Link 
                                    href={route('dashboard')} 
                                    className="inline-flex justify-center items-center bg-sape-amarillo text-sape-burdeo font-bold text-lg px-8 py-4 rounded-lg hover:bg-yellow-400 transition transform hover:-translate-y-1 shadow-lg"
                                >
                                    Ingresar a mi Portal →
                                </Link>
                            ) : (
                                <Link 
                                    href={route('login')} 
                                    className="inline-flex justify-center items-center bg-sape-amarillo text-sape-burdeo font-bold text-lg px-8 py-4 rounded-lg hover:bg-yellow-400 transition transform hover:-translate-y-1 shadow-lg"
                                >
                                    Acceder al Sistema
                                </Link>
                            )}
                        </div>
                    </div>
                </main>

                <footer className="bg-white border-t border-sape-gris py-6 text-center">
                    <p className="text-gray-500 text-sm font-medium">
                        © {new Date().getFullYear()} Colegio San Sebastián de Melipilla. Todos los derechos reservados.
                    </p>
                </footer>

            </div>
        </>
    );
}