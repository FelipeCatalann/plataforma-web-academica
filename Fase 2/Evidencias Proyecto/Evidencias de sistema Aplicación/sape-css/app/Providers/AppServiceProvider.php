<?php

namespace App\Providers;

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

        RateLimiter::for('ia', fn (Request $request) => [
            Limit::perMinute(10)->by('cuenta-minuto:'.$request->user()->id),
            Limit::perDay(120)->by('cuenta-dia:'.$request->user()->id),
            Limit::perDay((int) config('services.ia.solicitudes_diarias', 2000))->by('instalacion-dia'),
        ]);
    }
}
