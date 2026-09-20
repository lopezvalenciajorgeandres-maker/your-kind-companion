import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/eleva-logo.png";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar — Eleva System" },
      { name: "description", content: "Ingresa a la plataforma gratuita de agendamiento de citas de Eleva System." },
      { property: "og:title", content: "Ingresar — Eleva System" },
      { property: "og:description", content: "Accede a tu agenda de citas gratuita." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Auth,
});

type Mode = "signin" | "signup" | "reset" | "recovery";

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        return;
      }
      if (event === "SIGNED_IN" && session) navigate({ to: "/app", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const redirectTo = () => window.location.origin + "/auth";

  async function signInWithGoogle() {
    setLoading(true);
    // Supabase responde el error "provider is not enabled" en la página de redirección,
    // así que verificamos antes para poder avisar aquí mismo.
    if (!(await isGoogleEnabled())) {
      toast.error("Google aún no está habilitado en Supabase. Ingresa con tu correo y contraseña.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      toast.error(error.message || "No pudimos iniciar sesión con Google");
      setLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return; // onAuthStateChange redirige a /app
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo() },
        });
        if (error) throw error;
        if (data.session) return; // confirmación de correo desactivada: entra directo
        toast.success("Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja.");
        setMode("signin");
        return;
      }
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
        if (error) throw error;
        toast.success("Te enviamos un enlace para restablecer tu contraseña.");
        setMode("signin");
        return;
      }
      if (mode === "recovery") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Contraseña actualizada.");
        navigate({ to: "/app", replace: true });
        return;
      }
    } catch (err) {
      toast.error(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "signup" ? "Crea tu cuenta" : mode === "reset" ? "Recuperar contraseña" : mode === "recovery" ? "Nueva contraseña" : "Bienvenida a Eleva";
  const cta =
    mode === "signup" ? "Crear cuenta" : mode === "reset" ? "Enviar enlace" : mode === "recovery" ? "Guardar contraseña" : "Ingresar";

  const inputClass =
    "mt-1 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition";

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex bg-gradient-to-br from-lavender/50 to-sage/30 items-center justify-center p-12">
        <div className="max-w-sm text-center">
          <img src={logoUrl} alt="Eleva System" className="w-52 mx-auto" />
          <p className="mt-6 font-serif text-2xl text-foreground">
            "Belleza que impacta. Estrategia que conecta."
          </p>
          <p className="mt-3 text-sm text-foreground/70">
            Accede a tu agenda de citas gratuita.
          </p>
        </div>
      </div>
      <div className="flex flex-col p-6 sm:p-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="font-serif text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signup"
                ? "Regístrate con tu correo para acceder al sistema de agendamiento."
                : mode === "reset"
                  ? "Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña."
                  : mode === "recovery"
                    ? "Elige una nueva contraseña para tu cuenta."
                    : "Ingresa con tu correo o con Google para acceder al sistema de agendamiento."}
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode !== "recovery" && (
                <label className="block text-sm">
                  <span className="text-foreground/80">Correo electrónico</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="tu@correo.com"
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label className="block text-sm">
                  <span className="text-foreground/80">{mode === "recovery" ? "Nueva contraseña" : "Contraseña"}</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Mínimo 6 caracteres"
                  />
                </label>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition"
              >
                {loading ? "Un momento..." : cta}
              </button>
            </form>

            {mode === "signin" && (
              <>
                <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
                </div>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-3 rounded-full border border-border bg-white px-6 py-3 text-sm font-medium hover:bg-secondary/50 disabled:opacity-60 transition"
                >
                  <GoogleIcon />
                  Continuar con Google
                </button>
              </>
            )}

            <div className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
              {mode === "signin" && (
                <>
                  <button type="button" onClick={() => setMode("signup")} className="text-left hover:text-foreground">
                    ¿No tienes cuenta? <span className="underline">Regístrate</span>
                  </button>
                  <button type="button" onClick={() => setMode("reset")} className="text-left hover:text-foreground">
                    ¿Olvidaste tu contraseña?
                  </button>
                </>
              )}
              {(mode === "signup" || mode === "reset") && (
                <button type="button" onClick={() => setMode("signin")} className="text-left hover:text-foreground">
                  ¿Ya tienes cuenta? <span className="underline">Ingresar</span>
                </button>
              )}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Al continuar aceptas nuestros términos y política de privacidad.
              El registro y la agenda son 100% gratuitos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

async function isGoogleEnabled(): Promise<boolean> {
  try {
    const url = import.meta.env["VITE_SUPABASE_URL"] as string;
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const json = (await res.json()) as { external?: Record<string, boolean> };
    return Boolean(json.external?.["google"]);
  } catch {
    return true; // si no podemos verificar, dejamos que Supabase decida
  }
}

function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada.";
  if (/already registered|already exists/i.test(msg)) return "Ese correo ya tiene una cuenta. Ingresa con tu contraseña.";
  if (/password should be at least/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  return msg || "Algo salió mal. Inténtalo de nuevo.";
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.87 0-5.29-1.94-6.16-4.54H2.18v2.85A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18a11 11 0 0 0 0 9.87l3.66-2.85Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.32 9.13 5.38 12 5.38Z" />
    </svg>
  );
}
