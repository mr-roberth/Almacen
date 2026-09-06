<?php
declare(strict_types=1);

// Copie este archivo como config.local.php y complete los valores.
// config.local.php está excluido de Git y bloqueado por .htaccess.
return [
    'database' => [
        'host' => 'localhost',
        'name' => 'ci4kash_Oleolab',
        'user' => 'USUARIO_MYSQL',
        'password' => 'CONTRASENA_MYSQL',
        'charset' => 'utf8mb4',
    ],
    'security' => [
        // Use la URL HTTPS exacta, sin diagonal final.
        'trusted_origin' => 'https://almacen.sudominio.com',
        'session_ttl_seconds' => 28800,
        'max_login_attempts' => 5,
        'lock_minutes' => 15,
    ],
    'notifications' => [
        // cPanel enviará los avisos mediante la función mail() de PHP.
        'enabled' => true,
        'from_email' => 'notificaciones@ci4kash.com',
        'from_name' => 'Oleolab',
    ],
];
