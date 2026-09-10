import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
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

function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/app", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signIn() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      toast.error(result.error.message || "No pudimos iniciar sesión");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app", replace: true });
  }

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
            <h1 className="font-serif text-3xl">Bienvenida a Eleva</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa con tu cuenta de Google para acceder al sistema de agendamiento.
            </p>
            <button
              onClick={signIn}
              disabled={loading}
              className="mt-8 w-full inline-flex items-center justify-center gap-3 rounded-full border border-border bg-white px-6 py-3 text-sm font-medium hover:bg-secondary/50 disabled:opacity-60 transition"
            >
              <GoogleIcon />
              {loading ? "Conectando..." : "Continuar con Google"}
            </button>
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
