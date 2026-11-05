import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { MotionConfig } from 'framer-motion';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { inicializarPreferenciasSape } from './utils/preferenciasSape';

inicializarPreferenciasSape();

const appName = import.meta.env.VITE_APP_NAME || 'S.A.P.E CSS';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <MotionConfig reducedMotion="user">
                <App {...props} />
            </MotionConfig>,
        );
    },
    progress: {
        color: '#E5E632',
    },
});
