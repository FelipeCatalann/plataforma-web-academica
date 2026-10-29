export default function ApplicationLogo({ className = 'w-12 h-12', ...props }) {
    return (
        <svg
            {...props}
            className={className}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Escudo Institucional S.A.P.E CSS */}
            <path
                d="M32 4L8 14V30C8 45.2 18.24 58.96 32 62C45.76 58.96 56 45.2 56 30V14L32 4Z"
                fill="#6E1710"
                stroke="#F5D000"
                strokeWidth="3"
                strokeLinejoin="round"
            />
            {/* Birrete / Libro Académico en Dorado */}
            <path
                d="M32 18L16 25L32 32L48 25L32 18Z"
                fill="#F5D000"
            />
            <path
                d="M22 29.5V38.5C22 41.5 26.5 44 32 44C37.5 44 42 41.5 42 38.5V29.5L32 34L22 29.5Z"
                fill="#FFFDF5"
                fillOpacity="0.92"
            />
            <path
                d="M46 26.5V37"
                stroke="#F5D000"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
