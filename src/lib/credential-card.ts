// Draws the "save your login info" card shown after registration as a downloadable PNG.
// Pure Canvas 2D (no screenshot library), so the image looks identical on every phone and computer.

export type CredentialCard = {
  accountId: string;
  password: string;
  name: string;
  phone?: string | undefined;
  sponsorId?: string | undefined;
  team?: "L" | "R" | undefined;
  joinedAt: Date;
  loginUrl: string;
};

/** Brand palette for the image (canvas cannot read CSS variables of an unmounted card). */
const C = { brand: "#093F89", brandInk: "#0B2A5C", cyan: "#10B0D7", leaf: "#8CC63F", ink: "#14213D", muted: "#66758C", line: "#E2E8F2", field: "#F5F8FC", warnBg: "#FFF6DB", warn: "#7A5A00", white: "#FFFFFF" };

export function formatJoined(d: Date): string {
  return d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

/** Plain-text version used by "Copy all". */
export function credentialText(c: CredentialCard): string {
  return [
    "Life OS — Member Login Info",
    `Account ID: ${c.accountId}`,
    `Password: ${c.password}`,
    `Name: ${c.name}`,
    c.phone ? `Mobile: ${c.phone}` : "",
    c.sponsorId ? `Sponsor ID: ${c.sponsorId}` : "",
    `Joined: ${formatJoined(c.joinedAt)}`,
    `Login: ${c.loginUrl}`,
  ].filter(Boolean).join("\n");
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

export async function drawCredentialCard(c: CredentialCard, logoSrc: string): Promise<HTMLCanvasElement> {
  const W = 1080, H = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, C.brand); bg.addColorStop(0.6, "#1E6FB8"); bg.addColorStop(1, C.cyan);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.09; ctx.fillStyle = C.white;
  for (const [x, y, r] of [[980, 120, 260], [80, 1340, 300], [900, 1260, 120], [140, 220, 90]] as const) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;

  // card
  const cx = 70, cy = 70, cw = W - 140, ch = H - 140;
  ctx.save(); ctx.shadowColor = "rgba(5,20,50,0.35)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  rr(ctx, cx, cy, cw, ch, 44); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();

  // logo
  const logo = await loadImage(logoSrc);
  if (logo) { const h = 92, w = (logo.width / logo.height) * h; ctx.drawImage(logo, (W - w) / 2, cy + 56, w, h); }
  else { ctx.fillStyle = C.brand; ctx.font = `800 72px ${FONT}`; ctx.textAlign = "center"; ctx.fillText("Life OS", W / 2, cy + 130); }

  // success badge
  ctx.textAlign = "center";
  const by = cy + 230;
  ctx.fillStyle = "#E7F6EC"; ctx.beginPath(); ctx.arc(W / 2, by, 46, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#1E9E55"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(W / 2 - 20, by + 2); ctx.lineTo(W / 2 - 4, by + 18); ctx.lineTo(W / 2 + 22, by - 14); ctx.stroke();
  ctx.fillStyle = C.brandInk; ctx.font = `800 50px ${FONT}`; ctx.fillText("Registration Successful", W / 2, by + 110);
  ctx.fillStyle = C.muted; ctx.font = `500 30px ${FONT}`; ctx.fillText("Save this card — it has your member login info", W / 2, by + 158);

  // account id highlight
  const ax = cx + 60, aw = cw - 120, ay = by + 200, ah = 190;
  const ag = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
  ag.addColorStop(0, C.brand); ag.addColorStop(1, C.cyan);
  rr(ctx, ax, ay, aw, ah, 30); ctx.fillStyle = ag; ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = `700 26px ${FONT}`; ctx.fillText("ACCOUNT ID", W / 2, ay + 58);
  ctx.fillStyle = C.white; ctx.font = `800 88px ${FONT}`; ctx.fillText(fit(ctx, c.accountId, aw - 60), W / 2, ay + 148);

  // details rows
  const rows: Array<[string, string, boolean]> = [
    ["Password", c.password, true],
    ["Name", c.name, false],
    ...(c.phone ? [["Mobile", c.phone, false] as [string, string, boolean]] : []),
    ...(c.sponsorId ? [["Sponsor ID", c.sponsorId, false] as [string, string, boolean]] : []),
    ["Joined", formatJoined(c.joinedAt), false],
  ];
  let ry = ay + ah + 36;
  const rh = 96;
  rr(ctx, ax, ry, aw, rows.length * rh, 26); ctx.fillStyle = C.field; ctx.fill();
  rows.forEach(([k, v, strong], i) => {
    const y = ry + i * rh;
    if (i > 0) { ctx.fillStyle = C.line; ctx.fillRect(ax + 28, y, aw - 56, 2); }
    ctx.textAlign = "left"; ctx.fillStyle = C.muted; ctx.font = `600 28px ${FONT}`; ctx.fillText(k, ax + 36, y + 58);
    ctx.textAlign = "right"; ctx.fillStyle = strong ? C.brand : C.ink; ctx.font = `${strong ? 800 : 650} ${strong ? 38 : 32}px ${FONT}`;
    ctx.fillText(fit(ctx, v, aw - 300), ax + aw - 36, y + 60);
  });
  ry += rows.length * rh + 36;

  // warning
  rr(ctx, ax, ry, aw, 92, 22); ctx.fillStyle = C.warnBg; ctx.fill();
  ctx.textAlign = "center"; ctx.fillStyle = C.warn; ctx.font = `650 26px ${FONT}`;
  ctx.fillText("Keep this card private. Never share your password.", W / 2, ry + 56);

  // footer
  ctx.fillStyle = C.muted; ctx.font = `500 26px ${FONT}`;
  ctx.fillText(fit(ctx, `Login: ${c.loginUrl}`, cw - 100), W / 2, cy + ch - 56);
  ctx.fillStyle = C.leaf; rr(ctx, W / 2 - 60, cy + ch - 30, 120, 8, 4); ctx.fill();
  return canvas;
}

export async function downloadCredentialCard(c: CredentialCard, logoSrc: string): Promise<void> {
  const canvas = await drawCredentialCard(c, logoSrc);
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Unable to create image");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `LifeOS-Account-${c.accountId}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
