"""Package already-built cPanel public files without private server configuration."""
from pathlib import Path
import os
import shutil

ROOT = Path(__file__).resolve().parent.parent
STAGE = Path('/tmp/lifeos-cpanel-package')
if STAGE.exists():
    shutil.rmtree(STAGE)
WEB = STAGE / 'public_html'
shutil.copytree(ROOT / 'dist/client', WEB, ignore=shutil.ignore_patterns('.lovable', '*.map', '_headers'))
BACKEND = WEB / 'backendserver'
BACKEND.mkdir()
for name in ['index.php', '.htaccess', 'config.example.php', 'README.md', 'src', 'bin', 'database']:
    source = ROOT / 'backendserver' / name
    if source.is_dir():
        shutil.copytree(source, BACKEND / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.git', '.env'))
    else:
        shutil.copy2(source, BACKEND / name)
(BACKEND / 'storage').mkdir()
(BACKEND / 'storage/.htaccess').write_text('Require all denied\n')
# Domain/setup installer: DB credentials + schema-only or bundled legacy data.
shutil.copytree(ROOT / 'setup', WEB / 'setup', ignore=shutil.ignore_patterns('.install-*', '*.log', 'test_*.php'))
legacy_sql = Path(os.environ.get('LIFEOS_LEGACY_SQL', str(ROOT / 'setup/legacy-data.sql.gz')))
if not legacy_sql.is_file():
    raise SystemExit('Legacy SQL required: set LIFEOS_LEGACY_SQL to the signed LifeOS-Legacy-Data.sql.gz export.')
shutil.copy2(legacy_sql, WEB / 'setup/legacy-data.sql.gz')
(STAGE / 'INSTALL-BANGLA.txt').write_text('''Life OS — cPanel installation (domain root)

১. আগে বর্তমান ওয়েবসাইট ও MySQL database-এর backup নিন। ZIP-এর public_html-এর ভেতরের সব ফাইল আপনার domain-এর document root-এ দিন। .htaccess-ও দিতে হবে।
২. PHP 8.1+, pdo_mysql ও zlib চালু করুন; Apache/LiteSpeed-এ mod_rewrite ও .htaccess কাজ করতে হবে। Node.js/Composer লাগবে না।
৩. cPanel MySQL Database Wizard দিয়ে একটি নতুন EMPTY database/user তৈরি করে ALL PRIVILEGES দিন। Installer কোনো non-empty database overwrite করবে না।
৪. Browser-এ https://আপনার-ডোমেইন/setup খুলুন। Database host, port, name, username ও password দিন।
   • Without old data: সব table + আপনার দেওয়া initial Admin এবং company ROOT তৈরি হবে; sample sale/commission থাকবে না।
   • With all old data: bundled LifeOS-Legacy-Data.sql.gz থেকে পুরোনো সব member, profile, tree, Admin ও preserved history import হবে।
৫. Install Life OS now চাপুন। বড় legacy import-এ browser tab খোলা রাখুন; সফল ফলাফলে member/Admin সংখ্যা দেখাবে। Backend configuration-এ নতুন private signing keys নিজে তৈরি হবে।
৬. Success page-এ Delete setup script & open homepage চাপুন। এটি setup directory এবং public_html-এর bundled SQL copy মুছে homepage-এ যাবে। আলাদা SQL backup নিরাপদ জায়গায় রাখুন।
৭. /login ও /admin/login পরীক্ষা করুন। Without old data বেছে নিলে আপনার initial Admin email/username ও ROOT login একই initial password ব্যবহার করবে; পরে password বদলান। With old data হলে পুরোনো login কার্যকর থাকবে।
৮. Admin → Cron Setup খুলে current-domain cron URL ও পূর্ণ cPanel guide দেখুন। Actual payout আগের মতোই approval/reconciliation ছাড়া বন্ধ থাকে। Admin → Cashback API Setup-এ merchant key generate করে merchant server-এ রাখুন; API default OFF থাকে এবং আপনি Enable না করা পর্যন্ত কোনো cashback কাটা যাবে না।
৯. HTTPS চালু রাখুন। Setup-এর পরে /setup 404 হবে, /backendserver/config.php ও SQL files 403/404 হবে, এবং homepage/login refresh-এ খুলবে।

গুরুত্বপূর্ণ: Merchant app-এর server-ই নিজ user account-এ টাকা যোগ করবে। Website API শুধু member/password যাচাই করে cashback কাটে এবং debit_code দেয়। Merchant app প্রতিটি order-এর জন্য একই request_id সংরক্ষণ করবে, duplicate response বুঝবে এবং merchant-side credit-ও একবারই করবে।
''', encoding='utf-8')
print(STAGE)
