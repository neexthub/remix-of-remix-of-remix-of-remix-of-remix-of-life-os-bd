<?php
declare(strict_types=1);

/** Streaming SQL import and setup-directory removal helpers, kept separate for isolated tests. */
final class LifeOsInstaller
{
    public static function legacyPath(string $directory): string
    {
        $path = $directory . '/legacy-data.sql.gz';
        if (is_file($path)) return $path;
        $parts = glob($path . '.part*') ?: [];
        natsort($parts);
        if (!$parts) throw new RuntimeException('Legacy data file is missing.');
        $tmp = $path . '.assembling';
        $out = fopen($tmp, 'wb');
        if (!$out) throw new RuntimeException('Cannot assemble legacy data.');
        try {
            $index = 1;
            foreach ($parts as $part) {
                if ($part !== $path . '.part' . $index++) throw new RuntimeException('Legacy data part is missing.');
                $in = fopen($part, 'rb');
                if (!$in) throw new RuntimeException('Cannot read legacy data part.');
                try { if (stream_copy_to_stream($in, $out) === false) throw new RuntimeException('Cannot assemble legacy data.'); }
                finally { fclose($in); }
            }
        } finally { fclose($out); }
        if (!rename($tmp, $path)) throw new RuntimeException('Cannot save assembled legacy data.');
        return $path;
    }

    public static function importSql(PDO $pdo, string $path): int
    {
        if (!is_file($path)) throw new RuntimeException('Legacy data file is missing from the setup directory.');
        $compressed = str_ends_with(strtolower($path), '.gz');
        if ($compressed && !function_exists('gzopen')) throw new RuntimeException('PHP zlib is required to read legacy-data.sql.gz.');
        $handle = $compressed ? @gzopen($path, 'rb') : @fopen($path, 'rb');
        if (!$handle) throw new RuntimeException('Cannot open the legacy data SQL file.');
        $read = fn(int $n) => $compressed ? gzread($handle, $n) : fread($handle, $n);
        $eof = fn() => $compressed ? gzeof($handle) : feof($handle);
        $buffer = ''; $quote = null; $lineComment = false; $blockComment = false; $count = 0; $carry = '';
        try {
            while (!$eof() || $carry !== '') {
                $chunk = $eof() ? $carry : $carry . $read(65536);
                if ($chunk === false) throw new RuntimeException('Failed while reading the SQL file.');
                // Keep two lookahead characters so comments, escapes and doubled quotes can span reads.
                if (!$eof()) { $carry = substr($chunk, -2); $length = strlen($chunk) - 2; }
                else { $carry = ''; $length = strlen($chunk); }
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
                            $buffer .= $next; $i++;
                        } elseif ($c === $quote) {
                            if ($next === $quote) { $buffer .= $next; $i++; }
                            else $quote = null;
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
