<?php
declare(strict_types=1);
/**
 * "+" on an empty tree position: a sponsor can register a new member exactly at an empty
 * slot inside their own placement team, never outside it and never on a filled slot.
 * Needs the local API on 127.0.0.1:8090. Usage: php backendserver/tests/tree_place_test.php <existing sponsor ID>
 */
const BASE = 'http://127.0.0.1:8090/api/member';
$top = $argv[1] ?? exit("existing sponsor ID required\n");
$fail = 0;
function call(string $method, string $path, ?array $body = null): array {
    $ch = curl_init(BASE . $path);
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body)]);
    $r = json_decode((string) curl_exec($ch), true) ?? [];
    curl_close($ch);
    return $r;
}
function check(string $name, bool $ok, $got = null): void { global $fail; if (!$ok) $fail++; echo ($ok ? 'ok    ' : 'FAIL  ') . "$name" . ($ok ? '' : ' => ' . json_encode($got)) . "\n"; }
function join_member(string $sponsor, string $team, ?string $place = null): array {
    $n = random_int(10000000, 99999999);
    $u = call('GET', '/username/new')['data'] ?? [];
    $b = ['name' => "Place $n", 'phone' => "017$n", 'email' => "p$n@example.com", 'password' => '1111', 'confirm_password' => '1111', 'accepted_terms' => 1,
        'referral_code' => $sponsor, 'team' => $team, 'username' => $u['username'] ?? '', 'username_token' => $u['username_token'] ?? ''];
    if ($place !== null) $b['place'] = $place;
    return call('POST', '/register', $b);
}
$s = join_member($top, 'R')['data']['life_id'] ?? exit("could not create sponsor\n");
$a = join_member($s, 'L')['data']['life_id'] ?? exit("could not create left child\n");

$p = call('GET', "/sponsor?code=$s&team=R&place=$a");
check('preview shows the chosen empty position', ($p['data']['placement_life_id'] ?? '') === $a && ($p['data']['placement_side'] ?? '') === 'R', $p);

$r = join_member($s, 'R', $a);
check('joins exactly at the chosen empty position', ($r['ok'] ?? false) === true, $r);

$p = call('GET', "/sponsor?code=$s&team=R&place=$a");
check('that position is now filled', ($p['error'] ?? '') === 'This position is already filled', $p);

$r = join_member($s, 'L', $s);
check('a filled position cannot be joined', ($r['error'] ?? '') === 'This position is already filled', $r);

$r = join_member($s, 'L', $top);
check('a position outside the sponsor team is refused', ($r['error'] ?? '') === 'This position is not in your team', $r);

$r = join_member($s, 'L', 'NO-SUCH-ID');
check('unknown position member is refused', ($r['error'] ?? '') === 'Placement member not found', $r);

$r = join_member($s, 'R');
check('normal team links still work without a position', ($r['ok'] ?? false) === true, $r);
exit($fail ? 1 : 0);
