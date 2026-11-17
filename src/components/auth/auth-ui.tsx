import { useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, CheckCircle2, Copy, Download, Eye, EyeOff, Check, ArrowRight } from "lucide-react";
import { credentialText, downloadCredentialCard, formatJoined, type CredentialCard } from "@/lib/credential-card";
import { memberKitAsset } from "@/lib/member-kit-assets";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { icon: ReactNode; action?: ReactNode; inputRef?: Ref<HTMLInputElement> };

/** Text input with a leading icon and optional trailing action button. */
export function LxInput({ icon, action, inputRef, ...rest }: InputProps) {
  return <div className={`lx-control${action ? " lx-control--action" : ""}`}>
    <span className="lx-ico" aria-hidden="true">{icon}</span>
    <input className="lx-input" ref={inputRef} {...rest} />
    {action}
  </div>;
}

export function LxField({ label, hint, htmlFor, children, className }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return <div className={`lx-field${className ? ` ${className}` : ""}`}>
    <label className="lx-label" htmlFor={htmlFor}>{label}{hint && <small>{hint}</small>}</label>
    {children}
  </div>;
}

/** Password input with a show/hide eye button. */
export function LxPassword({ icon, ...rest }: Omit<InputProps, "type" | "action">) {
  const [show, setShow] = useState(false);
  return <LxInput {...rest} icon={icon} type={show ? "text" : "password"}
    action={<button type="button" className="lx-iconbtn" onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"}>{show ? <EyeOff /> : <Eye />}</button>} />;
}

/** 0–4 score: length, mixed case, digits, symbols. */
export function passwordStrength(p: string): number {
  if (!p) return 0;
  let s = p.length >= 6 ? 1 : 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.max(1, Math.min(4, s));
}

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy"); t.remove(); return ok;
  }
}

/** "Save your login info" popup after registration: Account ID + password, copy and download-as-image. */
export function CredentialDialog({ open, card, container, continueLabel, onContinue, extra }: {
  open: boolean; card: CredentialCard | null; container?: HTMLElement | null; continueLabel: string; onContinue: () => void; extra?: ReactNode;
}) {
  const [msg, setMsg] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2200); };
  if (!card) return null;
  const save = async () => {
    setSaving(true);
    try { await downloadCredentialCard(card, memberKitAsset("/member-kit/neel/logo-word.png")); flash("Image saved to your downloads."); }
    catch { flash("Could not create the image. Please take a screenshot instead."); }
    finally { setSaving(false); }
  };
  return <DialogPrimitive.Root open={open}>
    <DialogPrimitive.Portal container={container ?? undefined}>
      <DialogPrimitive.Overlay className="lx-overlay" />
      <DialogPrimitive.Content className="lx-dialog" onEscapeKeyDown={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
        <div className="lx-dhead">
          <div className="lx-check"><CheckCircle2 aria-hidden="true" /></div>
          <DialogPrimitive.Title asChild><h2>Registration Successful</h2></DialogPrimitive.Title>
          <DialogPrimitive.Description asChild><p>Save this login info before you continue.</p></DialogPrimitive.Description>
        </div>
        <div className="lx-dbody">
          <div className="lx-credbox">
            <div className="lx-cred lx-cred--big">
              <div className="lx-cred-main"><div className="lx-cred-k">Account ID</div><div className="lx-cred-v" data-testid="cred-id">{card.accountId}</div></div>
              <button type="button" className="lx-iconbtn" aria-label="Copy Account ID" title="Copy Account ID" onClick={async () => flash(await copy(card.accountId) ? "Account ID copied." : "Copy failed.")}><Copy /></button>
            </div>
            <div className="lx-cred">
              <div className="lx-cred-main"><div className="lx-cred-k">Password</div><div className="lx-cred-v" data-testid="cred-pw">{showPw ? card.password : "•".repeat(Math.min(card.password.length, 12))}</div></div>
              <button type="button" className="lx-iconbtn" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw(s => !s)}>{showPw ? <EyeOff /> : <Eye />}</button>
              <button type="button" className="lx-iconbtn" aria-label="Copy password" title="Copy password" onClick={async () => flash(await copy(card.password) ? "Password copied." : "Copy failed.")}><Copy /></button>
            </div>
            <div className="lx-cred"><div className="lx-cred-main"><div className="lx-cred-k">Name</div><div className="lx-cred-v">{card.name}</div></div></div>
            {card.sponsorId && <div className="lx-cred"><div className="lx-cred-main"><div className="lx-cred-k">Sponsor ID</div><div className="lx-cred-v">{card.sponsorId}</div></div></div>}
            <div className="lx-cred"><div className="lx-cred-main"><div className="lx-cred-k">Joined</div><div className="lx-cred-v">{formatJoined(card.joinedAt)}</div></div></div>
          </div>
          <div className="lx-note"><AlertTriangle aria-hidden="true" />Keep this private. You need the Account ID and password to log in.</div>
          <div className="lx-dactions">
            <button type="button" className="lx-btn lx-btn--ghost" onClick={() => void save()} disabled={saving}><Download aria-hidden="true" />{saving ? "Saving…" : "Download Image"}</button>
            <button type="button" className="lx-btn lx-btn--ghost" onClick={async () => flash(await copy(credentialText(card)) ? "Login info copied." : "Copy failed.")}><Check aria-hidden="true" />Copy All</button>
            <button type="button" className="lx-btn lx-btn--primary" onClick={onContinue}>{continueLabel}<ArrowRight aria-hidden="true" /></button>
          </div>
          {extra}
          <div className="lx-toast" role="status" aria-live="polite">{msg}</div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
