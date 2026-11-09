<?php
declare(strict_types=1);

/** Streaming SQL import and setup-directory removal helpers, kept separate for isolated tests. */
final class LifeOsInstaller
{
    public static function importSql(PDO $pdo, string $path): int
    {
        if (!is_file($path)) throw new RuntimeException('Legacy data file is missing from the setup directory.');
        $compressed = str_ends_with(strtolower($path), '.gz');
        if ($compressed && !function_exists('gzopen')) throw new RuntimeException('PHP zlib is required to read legacy-data.sql.gz.');
        $handle = $compressed ? @gzopen($path, 'rb') : @fopen($path, 'rb');
        if (!$handle) throw new RuntimeException('Cannot open the legacy data SQL file.');
        $read = fn(int $n) => $compressed ? gzread($handle, $n) : fread($handle, $n);
        $eof = fn() => $compressed ? gzeof($handle) : feof($handle);
        $buffer = ''; $quote = null; $lineComment = false; $blockComment = false; $count = 0;
        try {
            while (!$eof()) {
                $chunk = $read(65536);
                if ($chunk === false) throw new RuntimeException('Failed while reading the SQL file.');
                $length = strlen($chunk);
                for ($i = 0; $i < $length; $i++) {
                    $c = $chunk[$i]; $next = $chunk[$i + 1] ?? '';
                    if ($lineComment) {
                        if ($c === "\n") { $lineComment = false; $buffer .= ' '; }
                        continue;
                    }
                    if ($blockComment) {
                        if ($c === '*' && $next === '/') { $blockComment = false; $i++; $buffer .= ' '; }
                        continue;
                    }
                    if ($quote !== null) {
                        $buffer .= $c;
                        if ($c === '\\' && $next !== '') {
                            if ($i + 1 < $length) { $buffer .= $next; $i++; }
                            else { $nextChunk = $read(1); if ($nextChunk !== false && $nextChunk !== '') { $buffer .= $nextChunk; } }
                        } elseif ($c === $quote) {
                            if ($next === $quote) {
                                if ($i + 1 < $length) { $buffer .= $next; $i++; }
                                else { $nextChunk = $read(1); if ($nextChunk !== false && $nextChunk !== '') { $buffer .= $nextChunk; } }
                            } else $quote = null;
                        }
                        continue;
                    }
                    if (($c === '-' && $next === '-' && ctype_space($chunk[$i + 2] ?? ' ')) || $c === '#') { $lineComment = true; continue; }
                    if ($c === '/' && $next === '*') { $blockComment = true; $i++; continue; }
                    if ($c === "'" || $c === '"' || $c === '`') { $quote = $c; $buffer .= $c; continue; }
                    if ($c === ';') {
                        $statement = trim($buffer); $buffer = '';
                        if ($statement !== '') { $pdo->exec($statement); $count++; }
                        continue;
                    }
                    $buffer .= $c;
                }
            }
            $statement = trim($buffer);
            if ($statement !== '') { $pdo->exec($statement); $count++; }
            if ($quote !== null || $blockComment) throw new RuntimeException('The SQL file ends inside a string or comment.');
            return $count;
        } finally {
            $compressed ? gzclose($handle) : fclose($handle);
        }
    }

    public static function removeDirectory(string $directory): void
    {
        $real = realpath($directory);
        if ($real === false || basename($real) !== 'setup' || !is_file($real . '/index.php')) throw new RuntimeException('Setup path safety check failed.');
        $items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($real, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($items as $item) {
            $path = $item->getPathname();
            if ($item->isLink() || $item->isFile()) { if (!@unlink($path)) throw new RuntimeException('Could not delete ' . $item->getFilename() . '. Remove the setup directory manually.'); }
            elseif (!@rmdir($path)) throw new RuntimeException('Could not remove a setup subdirectory. Remove it manually.');
        }
        if (!@rmdir($real)) throw new RuntimeException('Setup files were deleted but the directory remains. Remove the empty setup directory manually.');
    }
}
