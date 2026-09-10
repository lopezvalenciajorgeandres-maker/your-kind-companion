export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  body: string;
};

export const posts: Post[] = [
  {
    slug: "5-estrategias-para-llenar-tu-agenda-de-spa",
    title: "5 estrategias para llenar la agenda de tu spa",
    excerpt: "Tácticas probadas para atraer nuevas clientas y hacer que las que ya tienes vuelvan más seguido.",
    category: "Estrategia",
    date: "10 julio 2026",
    readTime: "6 min",
    body: `El primer error que vemos en la mayoría de los spas es que atraen tráfico, pero no lo convierten en citas reservadas. En este artículo te compartimos cinco tácticas que hemos aplicado con nuestras clientas y que han multiplicado sus reservas mes a mes.

1. Ofrece una primera experiencia irresistible. No hablamos de descuentos genéricos, sino de un ritual de bienvenida que sorprenda. La primera visita es la que decide si tendrás una clienta recurrente.

2. Automatiza los recordatorios. Un recordatorio 24 horas antes y otro 2 horas antes reduce las inasistencias hasta en un 60%. En nuestra plataforma gratuita ya vienen incluidos.

3. Trabaja tu ficha de Google. El 78% de las personas que buscan un spa lo hacen en Google Maps. Optimiza fotos, horarios y reseñas cada semana.

4. Contenido educativo, no solo promocional. Muestra la ciencia detrás de cada tratamiento y por qué es único.

5. Programas de fidelización simples. Un sistema claro de puntos o recompensas puede aumentar la frecuencia de visita más que cualquier descuento puntual.`,
  },
  {
    slug: "seo-local-clinicas-esteticas",
    title: "SEO local para clínicas estéticas: la guía práctica",
    excerpt: "Cómo aparecer primero cuando alguien busca una clínica estética en tu ciudad.",
    category: "SEO",
    date: "3 julio 2026",
    readTime: "8 min",
    body: `El SEO local es el motor que llena consultorios y clínicas estéticas. La mayoría de las búsquedas terminan en las tres primeras opciones del mapa de Google, así que si tu ficha no está optimizada estás dejando dinero sobre la mesa.

En esta guía te compartimos el checklist que aplicamos con nuestras clientas para escalar posiciones en semanas y no en meses.

Empieza por reclamar y verificar tu ficha en Google Business Profile. Asegúrate de que dirección, horarios y teléfono coincidan exactamente con los de tu sitio web. Sube al menos 30 fotos reales y actualízalas cada mes.

Las reseñas son el segundo factor más importante. Diseña un flujo automático para pedirlas después de cada cita — se puede hacer con WhatsApp o email en menos de un minuto.

Y por último: contenido local. Escribe artículos que mencionen tu ciudad, barrios y tratamientos específicos que ofreces. Google conecta esas señales geográficas con tu ficha y te sube de posición.`,
  },
  {
    slug: "instagram-para-negocios-de-belleza",
    title: "Instagram para negocios de belleza: qué publicar cada semana",
    excerpt: "Un calendario editorial simple y probado para spas, salones y clínicas estéticas.",
    category: "Redes sociales",
    date: "25 junio 2026",
    readTime: "5 min",
    body: `Instagram sigue siendo la vitrina más poderosa para negocios de belleza — pero solo si publicas con intención. Este es el calendario semanal que recomendamos a nuestras clientas.

Lunes: transformación real. Antes y después de un tratamiento, con historia y contexto.

Miércoles: educación. Explica un tratamiento, ingrediente o técnica en un carrusel corto.

Viernes: detrás de cámara. El equipo, el espacio, la energía. Humaniza tu marca.

Todos los días: mínimo 3 stories. Encuestas, cajitas de preguntas y momentos reales del día.

La constancia es más importante que la perfección. Tres publicaciones bien pensadas por semana superan a diez publicaciones improvisadas.`,
  },
];

export function findPost(slug: string) {
  return posts.find((p) => p.slug === slug);
}
