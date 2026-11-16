<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\EnsureEmailIsVerified;

class AsegurarAccesoAcademico extends EnsureEmailIsVerified
{
    public function handle($request, Closure $next, $redirectToRoute = null)
    {
        if ($request->user()?->tieneAccesoPorAltaDocente()) {
            return $next($request);
        }

        return parent::handle($request, $next, $redirectToRoute);
    }
}
