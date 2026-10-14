import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
            // AGREGAR ESTE BLOQUE DE COLORES
            colors: {
                sape: {
                    burdeo: '#6E1710',
                    'burdeo-hover': '#58120C', // Un tono más oscuro para cuando pasas el mouse
                    amarillo: '#E5E632',
                    gris: '#CFD2D7',
                    'gris-claro': '#F3F4F6' // Ideal para fondos
                }
            }
        },
    },

    plugins: [forms],
};