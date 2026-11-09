<?php
declare(strict_types=1);
/** Isolated parser/removal tests; requires a disposable local MySQL instance. */
require __DIR__ . '/Installer.php';
$fail = 0; $tests = 0;
function check(string $name, bool $ok): void { global $fail, $tests; $tests++; if (!$ok) $fail++; echo ($ok ? 'ok    ' : 'FAIL  ') . $name . "\n"; }
$port = (int) (getenv('LIFEOS_SETUP_TEST_PORT') ?: 3306);
$pdo = new PDO("mysql:host=127.0.0.1;port=$port", 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('DROP DATABASE IF EXISTS lifeos_installer_parser');
$pdo->exec('CREATE DATABASE lifeos_installer_parser CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('USE lifeos_installer_parser');
$sql = "-- comment ; ignored\nCREATE TABLE samples (id INT PRIMARY KEY, value TEXT);\n"
    . "INSERT INTO samples VALUES (1, 'a;b'); /* block ; comment */\n"
    . "INSERT INTO samples VALUES (2, 'it''s fine');\n"
    . "INSERT INTO samples VALUES (3, 'backslash\\\\;still');\n"
    . "# another comment\nINSERT INTO samples VALUES (4, 'done');";
$file = tempnam(sys_get_temp_dir(), 'lifeos-parser-') . '.sql.gz';
$gz = gzopen($file, 'wb'); gzwrite($gz, $sql); gzclose($gz);
$count = LifeOsInstaller::importSql($pdo, $file);
check('Streaming importer executes every real statement once', $count === 5);
check('Quoted semicolons and comments do not split inserts', (int) $pdo->query('SELECT COUNT(*) FROM samples')->fetchColumn() === 4);
check('Doubled quote survives compressed import', $pdo->query('SELECT value FROM samples WHERE id=2')->fetchColumn() === "it's fine");
$pdo->exec('DROP DATABASE lifeos_installer_parser');
@unlink($file);
$base = sys_get_temp_dir() . '/lifeos-delete-' . bin2hex(random_bytes(4));
mkdir($base . '/setup', 0777, true);
file_put_contents($base . '/setup/index.php', '<?php // test');
file_put_contents($base . '/setup/legacy-data.sql.gz', 'test');
LifeOsInstaller::removeDirectory($base . '/setup');
check('Self-delete removes the entire setup directory', !file_exists($base . '/setup'));
@rmdir($base);
$unsafe = sys_get_temp_dir() . '/lifeos-not-setup-' . bin2hex(random_bytes(4)); mkdir($unsafe);
$blocked = false; try { LifeOsInstaller::removeDirectory($unsafe); } catch (RuntimeException) { $blocked = true; }
check('Self-delete refuses a non-setup directory', $blocked && is_dir($unsafe)); @rmdir($unsafe);
echo "\n$tests checks, $fail failures\n";
exit($fail ? 1 : 0);
