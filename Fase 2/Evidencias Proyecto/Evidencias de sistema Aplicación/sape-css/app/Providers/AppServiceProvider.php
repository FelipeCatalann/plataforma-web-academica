<?php

namespace App\Providers;

use App\Models\ConfiguracionIAInstitucional;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        RateLimiter::for('ia', function (Request $request) {
            $limiteInstalacion = ConfiguracionIAInstitucional::vigente()?->solicitudes_diarias_limite
                ?: (int) config('services.ia.solicitudes_diarias', 2000);

            return [
                Limit::perMinute(10)->by('cuenta-minuto:'.$request->user()->id),
                Limit::perDay(120)->by('cuenta-dia:'.$request->user()->id),
                Limit::perDay($limiteInstalacion)->by('instalacion-dia'),
            ];
        });
    }
}
