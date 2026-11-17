import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, IdCard, KeyRound, Loader2, LogIn, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { memberApi, memberToken } from "@/lib/member-api";
import { NEEL_LINKS } from "@/components/neel-frame";
import { memberKitAsset } from "@/lib/member-kit-assets";
import { LxField, LxInput, LxPassword } from "@/components/auth/auth-ui";
import "@/components/auth/auth-modern.css";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Member Login — Life OS" },
      { name: "description", content: "Sign in to your Life OS member account or register a new one." },
      { property: "og:title", content: "Member Login — Life OS" },
      { property: "og:description", content: "Sign in to your Life OS member account or register a new one." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: NEEL_LINKS,
  }),
  component: Login,
});

/** Member login: Account ID, password and the server's one-time image captcha; Register sits where Cancel used to be. */
function Login() {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<{ challenge_id: string; image: string } | null>(null);
  const [loadingCaptcha, setLoadingCaptcha] = useState(true);
  const codeInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const refreshCaptcha = async () => {
    setLoadingCaptcha(true); setCaptcha(null);
    if (codeInput.current) codeInput.current.value = "";
    try { setCaptcha(await memberApi<{ challenge_id: string; image: string }>("/captcha")); }
    catch { setErr("Security code is unavailable. Please try again."); }
    finally { setLoadingCaptcha(false); }
  };
  useEffect(() => { void refreshCaptcha(); }, []);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!captcha || loadingCaptcha) return;
    setErr(null); setBusy(true);
    try {
      memberToken.clear();
      const r = await memberApi<{ token: string }>("/login", { body: { username: String(fd.get("username") ?? "").trim(), password: fd.get("password"), challenge_id: captcha.challenge_id, security_code: fd.get("security_code") } });
      memberToken.set(r.token);
      navigate({ to: "/member" });
    } catch (x) {
      setErr((x as Error).message === "Failed to fetch" ? "Member server is not reachable right now." : (x as Error).message);
      await refreshCaptcha();
    } finally { setBusy(false); }
  };
  return (
    <div className="neel-viewport neel-login-page">
      <div className="lx">
        <div className="lx-card lx-card--login">
          <div className="lx-head">
            <Link to="/" aria-label="Life OS home"><img className="lx-logo" src={memberKitAsset("/member-kit/neel/logo-word.png")} alt="Life OS" /></Link>
            <h1 className="lx-title">Welcome back</h1>
            <p className="lx-sub">Log in to your member account</p>
          </div>
          <form className="lx-body" onSubmit={submit} autoComplete="off">
            {err && <div className="lx-alert" role="alert"><AlertCircle aria-hidden="true" />{err}</div>}
            <LxField label="Account ID" htmlFor="username">
              <LxInput id="username" name="username" icon={<IdCard />} type="text" placeholder="Account ID or mobile number" required autoComplete="username" />
            </LxField>
            <LxField label="Password" htmlFor="password">
              <LxPassword id="password" name="password" icon={<KeyRound />} placeholder="Your password" required autoComplete="current-password" />
            </LxField>
            <div className="lx-field">
              <label className="lx-label" htmlFor="security_code">Security Code</label>
              <div className="lx-captcha">
                <LxInput id="security_code" name="security_code" icon={<ShieldCheck />} type="text" placeholder="4 digits" required pattern="[0-9]{4}" maxLength={4} inputMode="numeric" inputRef={codeInput} />
                <button type="button" className="lx-captcha-img" aria-label="Refresh security code" title="Tap for a new code" disabled={loadingCaptcha || busy} onClick={() => { setErr(null); void refreshCaptcha(); }}>
                  {captcha ? <img src={captcha.image} alt="Security Code" width={112} height={26} /> : <span>{loadingCaptcha ? "Loading…" : "Retry"}</span>}
                  <RefreshCw aria-hidden="true" className={loadingCaptcha ? "animate-spin" : undefined} />
                </button>
              </div>
            </div>
            <div className="lx-row"><span /><Link to="/contact" className="lx-link">Forgot password?</Link></div>
            <button type="submit" className="lx-btn lx-btn--primary lx-btn--block" disabled={busy || loadingCaptcha || !captcha}>
              {busy ? <><Loader2 className="animate-spin" aria-hidden="true" />Logging in…</> : <><LogIn aria-hidden="true" />Login</>}
            </button>
            <div className="lx-divider">New to Life OS?</div>
            <Link to="/join" className="lx-btn lx-btn--ghost lx-btn--block"><UserPlus aria-hidden="true" />Register a new account</Link>
          </form>
          <div className="lx-foot">© {new Date().getFullYear()} Life OS Limited</div>
        </div>
      </div>
    </div>
  );
}
