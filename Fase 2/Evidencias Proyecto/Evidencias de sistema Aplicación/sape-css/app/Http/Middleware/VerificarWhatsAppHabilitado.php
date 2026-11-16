<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerificarWhatsAppHabilitado
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('funciones.whatsapp'), 404);

        return $next($request);
    }
}
