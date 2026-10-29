export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center justify-center rounded-xl border border-transparent bg-sape-burdeo px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sape-amarillo shadow-sm transition-all duration-200 hover:bg-sape-burdeo-hover hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sape-burdeo focus:ring-offset-2 active:scale-[0.99] ${
                    disabled && 'opacity-50 cursor-not-allowed'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
