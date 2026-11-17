import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { memberApi, memberToken } from "@/lib/member-api";
import type { JoinTeam } from "@/lib/join-fields";

type Sponsor = { name: string; life_id: string; placement_life_id: string | null; placement_side: JoinTeam | null };
type Taken = { phone_taken: boolean; email_taken: boolean };

/** Login-page sign-up: sponsor code + Left/Right fill the placement live; only phone/email duplicates are checked. */
export function QuickRegister({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [team, setTeam] = useState<JoinTeam | null>(null);
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [sponsorMsg, setSponsorMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taken, setTaken] = useState<Taken>({ phone_taken: false, email_taken: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  // Placement is looked up live whenever the code or the chosen side changes.
  useEffect(() => {
    const c = code.trim();
    setSponsor(null); setSponsorMsg("");
    if (c.length < 3) return;
    const id = ++seq.current;
    setSponsorMsg("Checking…");
    const t = setTimeout(() => {
      memberApi<Sponsor>(`/sponsor?code=${encodeURIComponent(c)}${team ? `&team=${team}` : ""}`)
        .then(s => { if (seq.current === id) { setSponsor(s); setSponsorMsg(""); } })
        .catch(e => { if (seq.current === id) setSponsorMsg((e as Error).message === "Failed to fetch" ? "Server not reachable" : "Referral code not found"); });
    }, 400);
    return () => clearTimeout(t);
  }, [code, team]);

  // "Already registered?" check for phone and email, nothing else.
  useEffect(() => {
    const p = phone.trim(), m = email.trim();
    if (!p && !m) { setTaken({ phone_taken: false, email_taken: false }); return; }
    const t = setTimeout(() => {
      memberApi<Taken>(`/register/check?${new URLSearchParams({ phone: p, email: m }).toString()}`)
        .then(setTaken).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [phone, email]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!sponsor || !team || taken.phone_taken || taken.email_taken) return;
    if (fd.get("password") !== fd.get("confirm")) { setErr("Passwords do not match."); return; }
    setErr(null); setBusy(true);
    try {
      memberToken.clear();
      const r = await memberApi<{ token: string }>("/register", { body: {
        quick: 1, name: fd.get("name"), phone, email, referral_code: code.trim(), team,
        password: fd.get("password"), confirm_password: fd.get("confirm"),
      } });
      memberToken.set(r.token);
      navigate({ to: "/member" });
    } catch (x) {
      setErr((x as Error).message === "Failed to fetch" ? "Member server is not reachable right now." : (x as Error).message);
    } finally { setBusy(false); }
  };

  const ready = !!sponsor && !!team && !taken.phone_taken && !taken.email_taken && !busy;
  return (
    <form className="form" onSubmit={submit} autoComplete="off" aria-label="Register">
      <br />
      <table width={240} cellPadding={5} cellSpacing={5}>
        <tbody>
          <tr><th className="lo-reg-title">New Member Register</th></tr>
          <tr><td><input type="text" name="name" aria-label="Full Name" placeholder="Full Name" required autoComplete="name" /></td></tr>
          <tr><td>
            <input type="text" name="phone" aria-label="Phone Number" placeholder="Phone Number" required value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
            {taken.phone_taken && <div className="lo-login-error" role="alert">This phone is already registered</div>}
          </td></tr>
          <tr><td>
            <input type="text" name="email" aria-label="Email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            {taken.email_taken && <div className="lo-login-error" role="alert">This email is already registered</div>}
          </td></tr>
          <tr><td>
            <input type="text" name="referral_code" aria-label="Referral Code" placeholder="Sponsor Referral Code / ID" required value={code} onChange={e => setCode(e.target.value)} />
            {sponsorMsg && <div className={sponsorMsg === "Checking…" ? "lo-reg-note" : "lo-login-error"} role="status">{sponsorMsg}</div>}
            {sponsor && <div className="lo-reg-note">Sponsor: <b>{sponsor.name}</b> ({sponsor.life_id})</div>}
          </td></tr>
          <tr><td className="lo-reg-team">
            <label><input type="radio" name="team" value="L" checked={team === "L"} onChange={() => setTeam("L")} required /> Left</label>
            <label><input type="radio" name="team" value="R" checked={team === "R"} onChange={() => setTeam("R")} /> Right</label>
          </td></tr>
          <tr><td><input type="text" aria-label="Placement ID" placeholder="Placement ID (auto)" readOnly tabIndex={-1} className="lo-reg-auto"
            value={sponsor && team && sponsor.placement_life_id ? `${sponsor.placement_life_id} — ${team === "L" ? "Left" : "Right"}` : ""} /></td></tr>
          <tr><td><input type="password" name="password" aria-label="Password" placeholder="Password" required minLength={4} maxLength={72} autoComplete="new-password" /></td></tr>
          <tr><td><input type="password" name="confirm" aria-label="Confirm Password" placeholder="Confirm Password" required minLength={4} maxLength={72} autoComplete="new-password" /></td></tr>
          <tr><td style={{ textAlign: "center" }}>
            <input type="submit" value={busy ? "Registering…" : "Register"} disabled={!ready} />{" "}
            <input type="button" value="Back to Login" onClick={onBack} />
          </td></tr>
          <tr><th role={err ? "alert" : undefined} className="lo-login-error">{err}</th></tr>
        </tbody>
      </table>
      <div className="lo-login-footer">CopyRights©{new Date().getFullYear()} By <br />Life OS Limited</div>
    </form>
  );
}
