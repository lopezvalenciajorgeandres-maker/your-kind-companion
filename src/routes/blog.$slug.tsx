import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { posts, findPost } from "@/content/posts";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const p = findPost(params.slug);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — Eleva System` },
          { name: "description", content: loaderData.excerpt },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.excerpt },
          { property: "og:type", content: "article" },
        ]
      : [{ title: "Artículo no encontrado" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <MarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-serif text-3xl">Artículo no encontrado</h1>
        <Link to="/blog" className="mt-6 inline-flex text-primary">← Volver al blog</Link>
      </div>
    </MarketingLayout>
  ),
  component: Post,
});

function Post() {
  const post = Route.useLoaderData();
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <Link to="/blog" className="text-sm text-primary hover:underline">← Blog</Link>
        <span className="mt-4 block text-xs text-primary font-medium uppercase tracking-wide">{post.category}</span>
        <h1 className="mt-2 text-4xl md:text-5xl font-serif">{post.title}</h1>
        <div className="mt-3 text-sm text-muted-foreground">{post.date} · {post.readTime}</div>
        <div className="mt-8 aspect-video rounded-2xl bg-gradient-to-br from-lavender/40 to-sage/30" />
        <div className="prose prose-neutral mt-10 max-w-none">
          {post.body.split("\n\n").map((para: string, i: number) => (
            <p key={i} className="mt-4 text-foreground/80 leading-relaxed">{para}</p>
          ))}
        </div>
        <div className="mt-12 rounded-2xl bg-lavender/20 p-6 text-center">
          <p className="font-serif text-xl">¿Quieres crecer con nosotras?</p>
          <Link to="/contacto" className="mt-4 inline-flex rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium">Hablar con Eleva</Link>
        </div>
      </article>
    </MarketingLayout>
  );
}

// Preload known slugs in dev to catch bad links
void posts;
