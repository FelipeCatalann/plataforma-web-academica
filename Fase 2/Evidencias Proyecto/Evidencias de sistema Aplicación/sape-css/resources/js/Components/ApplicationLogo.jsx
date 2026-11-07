export default function ApplicationLogo({ className = '', ...props }) {
    return (
        <img
            {...props}
            // Mantenemos las clases que le pases, pero forzamos la proporción correcta
            className={`object-contain w-auto ${className}`}
            src="/images/insigniaCSS.png"
            alt="Insignia Colegio San Sebastián"
        />
    );
}