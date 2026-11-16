<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class ConexionIA
{
    public static function validarBaseUrl(string $baseUrl): string
    {
        $baseUrl = rtrim(trim($baseUrl), '/');
        $oficiales = array_column(ConfiguracionIAService::PROVEEDORES, 'base_url');
        $aprobadas = array_merge($oficiales, config('services.ia.bases_aprobadas', []));

        if (preg_match('~\Ahttps://[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:/[a-zA-Z0-9_-]+)*\z~', $baseUrl)
            && filter_var(parse_url($baseUrl, PHP_URL_HOST), FILTER_VALIDATE_IP) === false
            && in_array($baseUrl, $aprobadas, true)) {
            return $baseUrl;
        }

        throw ValidationException::withMessages([
            'base_url' => 'Elige un proveedor oficial o solicita al administrador un destino HTTPS aprobado.',
        ]);
    }

    public static function cliente(string $baseUrl, array $headers, int $timeout): PendingRequest
    {
        $cliente = Http::baseUrl(self::validarBaseUrl($baseUrl))
            ->withHeaders($headers)
            ->withoutRedirecting()
            ->timeout($timeout);

        if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA') && ! ini_get('curl.cainfo')) {
            $cliente->withOptions(['curl' => [CURLOPT_SSL_OPTIONS => CURLSSLOPT_NATIVE_CA]]);
        }

        return $cliente;
    }
}
