import { useCallback, useEffect, useRef, useState } from "react";
import { User as UserIcon, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const AVATAR_MAX_DIM = 160;
const JPEG_QUALITY = 0.82;

function initialsFromEmail(email: string) {
  const part = email.split("@")[0] || email;
  if (part.length >= 2) return part.slice(0, 2).toUpperCase();
  return (part[0] || "?").toUpperCase();
}

async function fileToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = Math.min(AVATAR_MAX_DIM / w, AVATAR_MAX_DIM / h, 1);
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load"));
    };
    img.src = url;
  });
}

type ProfileUserResponse = {
  user: { id: string; email: string; name: string; avatarDataUrl: string | null };
};

const Profile = () => {
  const { t } = useLanguage();
  const { user, setUserFromServer } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarDataUrl ?? null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.name);
    setAvatarPreview(user.avatarDataUrl ?? null);
  }, [user]);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const openPicker = () => fileRef.current?.click();

  const onPickAvatar = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      try {
        const dataUrl = await fileToJpegDataUrl(file);
        setAvatarPreview(dataUrl);
      } catch {
        toast({ variant: "destructive", description: t("profileAvatarLoadError") });
      }
    },
    [t],
  );

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const body: { name: string; avatarDataUrl: string | null } = {
        name: displayName.trim() || user.email,
        avatarDataUrl: avatarPreview,
      };
      const { user: u } = await apiRequest<ProfileUserResponse>("/api/webpanel/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setUserFromServer(u);
      toast({ description: t("profileSavedToast") });
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : t("save"),
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const removeAvatar = () => {
    setAvatarPreview(null);
  };

  const savePassword = async () => {
    if (newPw !== confirmPw) {
      toast({ variant: "destructive", description: t("profilePasswordMismatch") });
      return;
    }
    if (newPw.length < 6) {
      toast({ variant: "destructive", description: t("profilePasswordMin") });
      return;
    }
    setPwSaving(true);
    try {
      await apiRequest("/api/webpanel/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      toast({ description: t("passwordChangedToast") });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      let wrong = /incorrect/i.test(raw);
      try {
        const j = JSON.parse(raw) as { error?: string };
        if (j?.error && /incorrect/i.test(j.error)) wrong = true;
      } catch {
        /* plain text */
      }
      toast({
        variant: "destructive",
        description: wrong ? t("profileWrongPassword") : raw || t("save"),
      });
    } finally {
      setPwSaving(false);
    }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <PageHeader title={t("myProfile")} icon={<UserIcon className="h-5 w-5" />} />

      <div className="max-w-2xl space-y-6">
        <Card className="p-6 shadow-card space-y-5">
          <h3 className="text-sm font-semibold text-foreground">{t("profileAvatarSection")}</h3>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="h-24 w-24 rounded-full overflow-hidden bg-muted shrink-0 ring-2 ring-border">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-primary text-primary-foreground text-2xl font-semibold">
                  {initialsFromEmail(user.email)}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3 w-full min-w-0">
              <p className="text-sm text-muted-foreground">{t("profileAvatarHelp")}</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onPickAvatar}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={openPicker}>
                  {t("profileChoosePhoto")}
                </Button>
                {(avatarPreview || user.avatarDataUrl) && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={removeAvatar}>
                    {t("profileRemovePhoto")}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-display-name">{t("profileDisplayName")}</Label>
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="max-w-md"
              autoComplete="nickname"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-muted-foreground">{t("email")}</Label>
            <p className="text-sm font-medium text-foreground">{user.email}</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" onClick={saveProfile} disabled={profileSaving} className="min-w-[120px]">
              {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </div>
        </Card>

        <Card className="p-6 shadow-card space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{t("changePassword")}</h3>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="pw-current">{t("profileCurrentPassword")}</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="pw-new">{t("profileNewPassword")}</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="pw-confirm">{t("profileConfirmPassword")}</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button type="button" variant="secondary" onClick={savePassword} disabled={pwSaving}>
              {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("updatePassword")}
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Profile;
