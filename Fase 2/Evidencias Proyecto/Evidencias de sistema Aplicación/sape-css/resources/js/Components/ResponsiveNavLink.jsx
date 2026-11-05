import { Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}) {
    return (
        <Link
            {...props}
            className={`flex w-full items-center rounded-xl py-2.5 px-4 ${
                active
                    ? 'bg-sape-burdeo/10 text-sape-burdeo font-bold focus:bg-sape-burdeo/15'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-sape-burdeo font-medium focus:bg-slate-50 focus:text-sape-burdeo'
            } text-sm transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}
