<?php
declare(strict_types=1);
namespace LifeOS;

/** Current backend origin derived from the request, so a cPanel domain needs no frontend rebuild. */
final class ServerUrls
{
    public static function backendBase(): string
    {
        $host = (string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost');
        if (!preg_match('/\A[A-Za-z0-9.-]+(?::\d{1,5})?\z/', $host)) $host = 'localhost';
        $forwarded = strtolower(trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
        $https = $forwarded === 'https' || (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
        $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/backendserver/index.php'));
        $path = rtrim(str_replace('\\', '/', dirname($script)), '/');
        return ($https ? 'https' : 'http') . '://' . $host . ($path === '' || $path === '/' ? '' : $path);
    }
}
