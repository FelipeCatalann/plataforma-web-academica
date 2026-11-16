<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'ia' => [
        'solicitudes_diarias' => env('IA_SOLICITUDES_DIARIAS', 2000),
        'dias_historial' => env('IA_DIAS_HISTORIAL', 30),
        'purgar_historial' => env('IA_PURGAR_HISTORIAL', false),
        'bases_aprobadas' => array_values(array_filter(array_map(
            fn (string $url) => rtrim(trim($url), '/'),
            explode(',', (string) env('IA_BASES_HTTPS_APROBADAS', ''))
        ))),
    ],

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
