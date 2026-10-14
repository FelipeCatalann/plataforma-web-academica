import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Iniciar Sesión - SAPE" />

            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-sape-burdeo">Ingreso al Portal</h2>
                <p className="text-sm text-gray-500 mt-1">Colegio San Sebastián de Melipilla</p>
            </div>

            {status && (
                <div className="mb-4 text-sm font-medium text-green-600 bg-green-50 p-3 rounded border border-green-200">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                <div>
                    <InputLabel htmlFor="email" value="Correo Electrónico" className="text-gray-700 font-bold" />

                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full border-sape-gris focus:border-sape-burdeo focus:ring-sape-burdeo rounded-md shadow-sm"
                        autoComplete="username"
                        isFocused={true}
                        onChange={(e) => setData('email', e.target.value)}
                    />

                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="password" value="Contraseña" className="text-gray-700 font-bold" />

                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="mt-1 block w-full border-sape-gris focus:border-sape-burdeo focus:ring-sape-burdeo rounded-md shadow-sm"
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />

                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="block">
                    <label className="flex items-center">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            className="text-sape-burdeo focus:ring-sape-burdeo"
                        />
                        <span className="ms-2 text-sm text-gray-600 font-medium">
                            Recordar mis datos
                        </span>
                    </label>
                </div>

                <div className="flex items-center justify-between pt-4">
                    {canResetPassword ? (
                        <Link
                            href={route('password.request')}
                            className="text-sm text-sape-burdeo hover:text-sape-burdeo-hover underline font-medium transition-colors"
                        >
                            ¿Olvidaste tu contraseña?
                        </Link>
                    ) : (
                        <div></div>
                    )}

                    <button 
                        disabled={processing}
                        className="bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover font-bold py-2 px-6 rounded-md shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-sape-burdeo focus:ring-offset-2 disabled:opacity-50"
                    >
                        Iniciar Sesión
                    </button>
                </div>
            </form>
        </GuestLayout>
    );
}