import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { posts } from "@/content/posts";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Estrategias para negocios de belleza | Eleva System" },
      { name: "description", content: "Ideas, guías y estrategias de marketing digital para spas, clínicas estéticas y salones de belleza." },
      { property: "og:title", content: "Blog — Eleva System" },
      { property: "og:description", content: "Aprende a hacer crecer tu negocio de belleza con estrategia digital." },
    ],
  }),
  component: Blog,
});

function Blog() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <span className="text-sm text-primary font-medium tracking-wide uppercase">Blog</span>
        <h1 className="mt-2 text-4xl md:text-6xl font-serif">Ideas para elevar tu negocio</h1>
      </section>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-24 grid gap-6 md:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="group rounded-2xl border border-border bg-card p-6 hover:shadow-lg transition">
            <div className="aspect-video rounded-xl bg-gradient-to-br from-lavender/40 to-sage/30 mb-5" />
            <span className="text-xs text-primary font-medium">{p.category}</span>
            <h3 className="mt-2 font-serif text-xl group-hover:text-primary transition">{p.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
            <div className="mt-4 text-xs text-muted-foreground">{p.date} · {p.readTime}</div>
          </Link>
        ))}
      </section>
    </MarketingLayout>
  );
}
