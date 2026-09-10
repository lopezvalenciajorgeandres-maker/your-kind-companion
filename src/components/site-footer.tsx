import { Link } from "@tanstack/react-router";
import { Instagram, Facebook } from "lucide-react";
import logoUrl from "@/assets/eleva-logo.png";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Eleva System" className="h-10 w-10 rounded-full" />
            <span className="font-serif text-xl">Eleva <span className="text-primary">System</span></span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-md">
            Consultora de crecimiento para clínicas estéticas, spas y negocios de belleza.
            Estrategia que impacta, resultados que transforman.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">elevasystem.agency</p>
        </div>
        <div>
          <h4 className="font-medium text-sm mb-3">Navegar</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/servicios" className="hover:text-foreground">Servicios</Link></li>
            <li><Link to="/casos-exito" className="hover:text-foreground">Casos de éxito</Link></li>
            <li><Link to="/precios" className="hover:text-foreground">Planes</Link></li>
            <li><Link to="/blog" className="hover:text-foreground">Blog</Link></li>
            <li><Link to="/contacto" className="hover:text-foreground">Contacto</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-sm mb-3">Síguenos</h4>
          <div className="flex gap-3 text-muted-foreground">
            <a href="#" aria-label="Instagram" className="hover:text-primary"><Instagram className="h-5 w-5" /></a>
            <a href="#" aria-label="Facebook" className="hover:text-primary"><Facebook className="h-5 w-5" /></a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Belleza que impacta. Estrategia que conecta. Resultados que transforman.
          </p>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} Eleva System. Todos los derechos reservados.</span>
          <span>Hecho con cariño para tu marca.</span>
        </div>
      </div>
    </footer>
  );
}
