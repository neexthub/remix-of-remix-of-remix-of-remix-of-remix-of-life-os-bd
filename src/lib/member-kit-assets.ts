// Shared URLs for the static member-kit files. The version is a build-time content hash of
// public/member-kit, so browsers that cached an older stylesheet/image fetch the new one after a deploy.
const version: string = import.meta.env.VITE_MEMBER_KIT_VERSION || "dev";

export function memberKitAsset(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}v=${version}`;
}

export const NEEL_CSS_HREF = memberKitAsset("/member-kit/neel.css");
