<?php
declare(strict_types=1);
session_start();
require __DIR__ . '/Installer.php';

$root = dirname(__DIR__);
$backend = $root . '/backendserver';
$configFile = $backend . '/config.php';
$home = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/setup/index.php'))), '/');
$home = $home === '' || $home === '.' ? '/' : $home . '/';
$errors = []; $result = null; $deleteError = null;
$old = ['host' => '127.0.0.1', 'port' => '3306', 'name' => '', 'user' => '', 'mode' => 'schema', 'admin_name' => 'Admin', 'admin_email' => ''];

function configured(string $file): bool {
    if (!is_file($file)) return false;
    $text = (string) file_get_contents($file);
    return !str_contains($text, 'change-me-app-secret') && trim($text) !== '';
}
function esc(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function csrf(): string { return $_SESSION['lifeos_setup_csrf'] ??= bin2hex(random_bytes(32)); }
function checkCsrf(): void { if (!hash_equals((string) ($_SESSION['lifeos_setup_csrf'] ?? ''), (string) ($_POST['csrf'] ?? ''))) throw new RuntimeException('The form expired. Reload this page and try again.'); }

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'delete') {
    try {
        checkCsrf();
        $config = is_file($configFile) ? require $configFile : [];
        $sessionToken = (string) ($_SESSION['lifeos_setup_delete'] ?? '');
        $postedToken = (string) ($_POST['delete_token'] ?? '');
        if ($sessionToken === '' || !hash_equals($sessionToken, $postedToken) || empty($config['setup_delete_hash']) || !password_verify($postedToken, (string) $config['setup_delete_hash'])) throw new RuntimeException('Deletion confirmation is invalid. Use the successful-setup page in this same browser session.');
        LifeOsInstaller::removeDirectory(__DIR__);
        header('Location: ' . $home, true, 303);
        exit;
    } catch (Throwable $e) { $deleteError = $e->getMessage(); }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'install' && !configured($configFile)) {
    foreach (['host', 'port', 'name', 'user', 'mode', 'admin_name', 'admin_email'] as $key) $old[$key] = trim((string) ($_POST[$key] ?? $old[$key]));
    $createdConfig = false;
    try {
        checkCsrf();
        @set_time_limit(0); @ignore_user_abort(true);
        if (PHP_VERSION_ID < 80100) throw new RuntimeException('PHP 8.1 or newer is required.');
        if (!extension_loaded('pdo_mysql')) throw new RuntimeException('Enable the PHP pdo_mysql extension in cPanel.');
        $host = $old['host']; $port = (int) $old['port']; $name = $old['name']; $user = $old['user']; $pass = (string) ($_POST['pass'] ?? '');
        if ($host === '' || strlen($host) > 255 || preg_match('/[\s\x00-\x1f]/', $host)) throw new RuntimeException('Enter a valid database host.');
        if ($port < 1 || $port > 65535) throw new RuntimeException('Database port must be 1–65535.');
        if (!preg_match('/\A[A-Za-z0-9_]{1,64}\z/', $name)) throw new RuntimeException('Database name may contain only letters, numbers and underscore.');
        if ($user === '' || strlen($user) > 128 || strlen($pass) > 512) throw new RuntimeException('Enter valid database credentials.');
        if (!in_array($old['mode'], ['schema', 'legacy'], true)) throw new RuntimeException('Choose a setup type.');
        if ($old['mode'] === 'legacy' && !is_file(__DIR__ . '/legacy-data.sql.gz')) throw new RuntimeException('legacy-data.sql.gz is missing. Upload the complete package, not just the installer scripts.');
        $adminPassword = (string) ($_POST['admin_password'] ?? '');
        if ($old['mode'] === 'schema') {
            if (!filter_var($old['admin_email'], FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Enter a valid initial admin email.');
            if (!preg_match('/\A[A-Za-z][A-Za-z0-9_.-]{2,79}\z/', $old['admin_name'])) throw new RuntimeException('Admin username must be 3–80 letters, numbers, dot, dash or underscore.');
            if (strlen($adminPassword) < 10 || strlen($adminPassword) > 72) throw new RuntimeException('Initial admin password must be 10–72 characters.');
        }
        $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
        $serverDsn = "mysql:host=$host;port=$port;charset=utf8mb4";
        $pdo = new PDO($serverDsn, $user, $pass, $options);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$name`");
        $tables = (int) $pdo->query('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()')->fetchColumn();
        if ($tables !== 0) throw new RuntimeException('This database is not empty. Installation stopped to protect existing data; use a new empty database.');

        $deleteToken = bin2hex(random_bytes(32));
        $config = [
            'db' => ['host' => $host, 'port' => $port, 'name' => $name, 'user' => $user, 'pass' => $pass],
            'auto_setup' => true, 'commission_cron_enabled' => false, 'cron_base_url' => '', 'cron_http_execute' => false,
            'app_secret' => bin2hex(random_bytes(32)), 'master_key' => bin2hex(random_bytes(32)),
            'master_ip_allowlist' => [], 'cors_origins' => [], 'timezone' => 'Asia/Dhaka', 'token_ttl' => 43200,
            'setup_delete_hash' => password_hash($deleteToken, PASSWORD_DEFAULT),
        ];
        $written = @file_put_contents($configFile, "<?php\ndeclare(strict_types=1);\nreturn " . var_export($config, true) . ";\n", LOCK_EX);
        if ($written === false) throw new RuntimeException('Cannot write backendserver/config.php. Make backendserver writable, then retry.');
        @chmod($configFile, 0640); $createdConfig = true;
        require $backend . '/src/bootstrap.php';
        $applied = LifeOS\Migrations::apply($pdo);
        $pdo->exec("SET time_zone = '+06:00'"); $pdo->exec('SET NAMES utf8mb4');
        $statements = 0;
        if ($old['mode'] === 'legacy') {
            $statements = LifeOsInstaller::importSql($pdo, __DIR__ . '/legacy-data.sql.gz');
            // The dump may predate this package; apply only migrations absent from its migration ledger.
            $applied = array_merge($applied, LifeOS\Migrations::apply($pdo));
        } else {
            $hash = password_hash($adminPassword, PASSWORD_DEFAULT);
            $pdo->prepare('INSERT INTO admin_users (name, email, password, role_id, two_fa_enabled) VALUES (?,?,?,1,0)')->execute([$old['admin_name'], $old['admin_email'], $hash]);
            $pdo->prepare('INSERT INTO users (life_id, membership_no, referral_code, phone, pin_hash, status, accepted_terms) VALUES ("ROOT","ROOT","ROOT","00000000000",?,"active",1)')->execute([$hash]);
            $rootId = (int) $pdo->lastInsertId();
            $pdo->prepare('INSERT INTO user_wallets (user_id) VALUES (?)')->execute([$rootId]);
            $pdo->prepare('INSERT INTO user_profiles (user_id, name) VALUES (?, "Life OS Root")')->execute([$rootId]);
            LifeOS\Engine\Placement::ensureNode($rootId, null);
            $pdo->prepare('UPDATE lo_tree SET is_active = 1 WHERE user_id = ?')->execute([$rootId]);
        }
        $users = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        $admins = (int) $pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
        $_SESSION['lifeos_setup_delete'] = $deleteToken;
        $_SESSION['lifeos_setup_complete'] = true;
        $result = ['mode' => $old['mode'], 'migrations' => count($applied), 'statements' => $statements, 'users' => $users, 'admins' => $admins, 'delete_token' => $deleteToken];
    } catch (Throwable $e) {
        // A failed first setup must remain retryable after the database is emptied. Never expose the DB password.
        if ($createdConfig && !isset($_SESSION['lifeos_setup_complete'])) @unlink($configFile);
        $errors[] = $e instanceof PDOException ? 'Database operation failed. Check the credentials, permissions and server log; existing non-empty databases are never overwritten.' : $e->getMessage();
    }
}

$isConfigured = configured($configFile);
$canDelete = $isConfigured && !empty($_SESSION['lifeos_setup_complete']) && !empty($_SESSION['lifeos_setup_delete']);
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Life OS Setup</title>
<style>:root{--ink:#17223b;--muted:#5b6475;--paper:#fff;--page:#eef3f8;--brand:#075f49;--brand2:#0b7a5e;--danger:#a31225;--line:#d6dee8;--ok:#e7f6ef}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:15px/1.6 system-ui,-apple-system,sans-serif}main{max-width:820px;margin:36px auto;padding:0 18px}.card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:28px;box-shadow:0 12px 35px #17223b12}h1{margin:0;color:var(--brand);font-size:30px}h2{font-size:19px;margin-top:26px}.muted{color:var(--muted)}label{display:block;font-weight:650;margin-top:14px}input,select{width:100%;padding:11px;border:1px solid var(--line);border-radius:7px;background:var(--paper);color:var(--ink);font:inherit}input[type=radio]{width:auto;margin-right:7px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.choices{display:grid;grid-template-columns:1fr 1fr;gap:12px}.choice{border:1px solid var(--line);border-radius:8px;padding:14px;font-weight:500}.button{border:0;border-radius:7px;padding:12px 22px;background:var(--brand);color:var(--paper);font-weight:750;cursor:pointer;font:inherit;margin-top:22px}.button:hover{background:var(--brand2)}.danger{background:var(--danger)}.alert{padding:13px 16px;border-radius:8px;margin:15px 0;background:var(--ok)}.error{background:#fff0f1;color:var(--danger)}code{overflow-wrap:anywhere}.results{width:100%;border-collapse:collapse}.results td,.results th{padding:9px;border-bottom:1px solid var(--line);text-align:left}.warning{border-left:4px solid var(--danger);padding-left:14px}@media(max-width:620px){.grid,.choices{grid-template-columns:1fr}main{margin:15px auto}.card{padding:20px}}</style></head>
<body><main><div class="card"><h1>Life OS cPanel Setup</h1><p class="muted">Domain-based frontend + PHP/MySQL backend installer</p>
<?php if ($deleteError): ?><div class="alert error"><?= esc($deleteError) ?></div><?php endif; ?>
<?php if ($result): ?>
<div class="alert"><b>Setup completed successfully.</b><br>Your configuration was written and the database is ready. No database password or private key is shown here.</div>
<table class="results"><tr><th>Setup type</th><td><?= $result['mode'] === 'legacy' ? 'Legacy data included' : 'Schema only + initial Admin/ROOT' ?></td></tr><tr><th>New migrations applied</th><td><?= $result['migrations'] ?></td></tr><?php if ($result['mode'] === 'legacy'): ?><tr><th>Legacy SQL statements imported</th><td><?= $result['statements'] ?></td></tr><?php endif; ?><tr><th>Member accounts now present</th><td><?= $result['users'] ?></td></tr><tr><th>Admin accounts now present</th><td><?= $result['admins'] ?></td></tr></table>
<?php if ($result['mode'] === 'schema'): ?><p>Admin login: <b><?= esc($old['admin_email']) ?></b> or <b><?= esc($old['admin_name']) ?></b>. First member/company login: <b>ROOT</b>. Both use the initial password you entered. Change these passwords after signing in.</p><?php else: ?><p>Use the imported member and admin logins. Their password hashes and account history were preserved.</p><?php endif; ?>
<p class="warning"><b>Security step required:</b> delete this installer now. This also removes the bundled legacy SQL copy from public_html. Keep your separate backup safely outside the public web directory.</p>
<form method="post"><input type="hidden" name="action" value="delete"><input type="hidden" name="csrf" value="<?= esc(csrf()) ?>"><input type="hidden" name="delete_token" value="<?= esc($result['delete_token']) ?>"><button class="button danger" type="submit">Delete setup script &amp; open homepage</button></form>
<p><a href="<?= esc($home) ?>">Open homepage without deleting (not recommended)</a></p>
<?php elseif ($isConfigured && $canDelete): ?>
<div class="alert">Setup is complete in this browser session.</div><form method="post"><input type="hidden" name="action" value="delete"><input type="hidden" name="csrf" value="<?= esc(csrf()) ?>"><input type="hidden" name="delete_token" value="<?= esc($_SESSION['lifeos_setup_delete']) ?>"><button class="button danger" type="submit">Delete setup script &amp; open homepage</button></form>
<?php elseif ($isConfigured): ?>
<div class="alert"><b>Life OS is already configured.</b><br>For security, this installer will not change the configuration or database. Remove the <code>setup</code> directory manually through cPanel File Manager.</div><p><a href="<?= esc($home) ?>">Open homepage</a></p>
<?php else: ?>
<?php foreach ($errors as $error): ?><div class="alert error"><?= esc($error) ?></div><?php endforeach; ?>
<div class="alert">Use a <b>new empty MySQL database</b>. The installer refuses every non-empty database so existing accounts cannot be overwritten. Take backups before continuing.</div>
<form method="post"><input type="hidden" name="action" value="install"><input type="hidden" name="csrf" value="<?= esc(csrf()) ?>">
<h2>1. Database information</h2><div class="grid"><label>Database host<input name="host" value="<?= esc($old['host']) ?>" required></label><label>Port<input name="port" type="number" min="1" max="65535" value="<?= esc($old['port']) ?>" required></label><label>Database name<input name="name" value="<?= esc($old['name']) ?>" pattern="[A-Za-z0-9_]+" required></label><label>Database username<input name="user" value="<?= esc($old['user']) ?>" required></label></div><label>Database password<input name="pass" type="password" autocomplete="off"></label>
<h2>2. Choose setup data</h2><div class="choices"><label class="choice"><input type="radio" name="mode" value="schema" <?= $old['mode'] === 'schema' ? 'checked' : '' ?>><b>Without old data</b><br><span class="muted">All tables, one initial Admin and company ROOT account. No sample sales or commission.</span></label><label class="choice"><input type="radio" name="mode" value="legacy" <?= $old['mode'] === 'legacy' ? 'checked' : '' ?>><b>With all old data</b><br><span class="muted">Imports all bundled users, profiles, trees, admins and preserved history.</span></label></div>
<h2>3. Initial login (only for “Without old data”)</h2><div class="grid"><label>Admin username<input name="admin_name" value="<?= esc($old['admin_name']) ?>"></label><label>Admin email<input name="admin_email" type="email" value="<?= esc($old['admin_email']) ?>"></label></div><label>Initial Admin + ROOT password<input name="admin_password" type="password" minlength="10" maxlength="72" autocomplete="new-password"><span class="muted">10–72 characters. Used only when setting up without old data.</span></label>
<button class="button" type="submit">Install Life OS now</button></form>
<h2>Hosting checklist</h2><p class="muted">PHP 8.1+, pdo_mysql, zlib, Apache/LiteSpeed rewrite support, writable backendserver during setup. Keep this page private until installation and delete it immediately after success.</p>
<?php endif; ?></div></main></body></html>
