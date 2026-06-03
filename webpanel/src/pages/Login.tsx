import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function loginImageSrc(): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}login.jpg`;
}

const Login = () => {
  const { t } = useLanguage();
  const { ready, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);

  if (ready && isAuthenticated) {
    return <Navigate to={from === "/login" ? "/" : from} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t("loginRequired"));
      return;
    }
    setPending(true);
    try {
      await login(email, password);
      navigate(from === "/login" ? "/" : from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginInvalid"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <div className="relative w-full lg:w-1/2 min-h-[220px] sm:min-h-[320px] lg:min-h-screen shrink-0 overflow-hidden bg-blue-950">
        {!heroFailed ? (
          <img
            src={loginImageSrc()}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            decoding="async"
            onError={() => setHeroFailed(true)}
          />
        ) : null}
        <div
          className="absolute inset-0 pointer-events-none bg-purple-600/50"
          aria-hidden
        />
      </div>

      <div className="flex flex-1 flex-col justify-center items-center p-6 sm:p-10 lg:w-1/2 min-h-0">
        <Card className="w-full max-w-md shadow-card border-border/80">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">{t("loginTitle")}</CardTitle>
            <CardDescription>{t("loginSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webpanel-email">{t("email")}</Label>
                <Input
                  id="webpanel-email"
                  type="email"
                  autoComplete="username"
                  placeholder={t("loginEmailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webpanel-password">{t("loginPassword")}</Label>
                <div className="relative">
                  <Input
                    id="webpanel-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={pending}
                    className="h-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    tabIndex={-1}
                    className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={pending}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full h-10" disabled={pending}>
                {pending ? t("loginSigningIn") : t("signIn")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
