// Demo content for a fresh Loom install: authors, categories, tags, CTAs, posts with rich bodies and FAQs,
// a few translations, Featured Articles, and one item in the Trash. Everything is created through
// the admin API, so each save, version and publish passes the same rules an editor's would.
//
//   pnpm dev:api          # in another terminal — the script talks to the running API
//   pnpm db:seed:demo
//
// It refuses to run against a Space that already has posts; `pnpm db:reset` starts over.
// Env: CMS_API_URL (default http://localhost:4000), DEMO_SITE (demo), DEMO_SPACE (production).
// It signs in as the admin `pnpm db:seed` made — CMS_SEED_ADMIN_EMAIL and CMS_SEED_ADMIN_PASSWORD,
// which `pnpm db:seed:demo` reads from packages/database/.env.
import { createRequire } from "node:module";

const require = createRequire(new URL("../api/package.json", import.meta.url));
const sharp = require("sharp");

const API = (process.env.CMS_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);
const SITE_SLUG = process.env.DEMO_SITE ?? "demo";
const SPACE_SLUG = process.env.DEMO_SPACE ?? "production";
const SESSION_COOKIE = "loom_session";

// The session cookie from signing in, sent with every call after it
let session;

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(body && { "content-type": "application/json" }),
        ...(session && { cookie: session }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(
      `Cannot reach the API at ${API}. Start it with \`pnpm dev:api\` first. (${error.cause?.code ?? error.message})`,
    );
  }
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const message = json?.error?.message ?? json?.message ?? json?.raw ?? json;
    throw new Error(
      `${method} ${path} → ${res.status}: ${typeof message === "string" ? message : JSON.stringify(message)}`,
    );
  }
  const signedIn = res.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (signedIn) session = signedIn.split(";")[0];
  return json.data ?? json;
}

async function signIn() {
  const email = process.env.CMS_SEED_ADMIN_EMAIL;
  const password = process.env.CMS_SEED_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error(
      "Set CMS_SEED_ADMIN_EMAIL and CMS_SEED_ADMIN_PASSWORD in packages/database/.env — the admin `pnpm db:seed` made.",
    );
  return call("POST", "/admin/auth/login", { email, password });
}

const publish = (type, id, language = "en") =>
  call("POST", `/admin/content/${type}/${id}/locales/${language}/publish`);

const FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif";
const esc = (s) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function bannerSvg({ width, height, from, to, title, label }) {
  const size = Math.round(width / 19);
  const lines = title ? wrap(title, 24) : [];
  const top = height * 0.55 - ((lines.length - 1) * size * 1.18) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${width * 0.88}" cy="${height * 0.12}" r="${height * 0.42}" fill="#fff" fill-opacity="0.09"/>
  <circle cx="${width * 0.05}" cy="${height * 1.02}" r="${height * 0.5}" fill="#000" fill-opacity="0.08"/>
  ${label ? `<text x="${width * 0.07}" y="${height * 0.17}" font-family="${FONT}" font-size="${Math.round(size * 0.42)}" font-weight="600" letter-spacing="3" fill="#fff" fill-opacity="0.85">${esc(label.toUpperCase())}</text>` : ""}
  ${lines.map((l, i) => `<text x="${width * 0.07}" y="${top + i * size * 1.18}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#fff">${esc(l)}</text>`).join("\n  ")}
</svg>`;
}

function squareSvg({ size, from, to, text }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${Math.round(size * 0.38)}" font-weight="700" fill="#fff">${esc(text)}</text>
</svg>`;
}

function chartSvg() {
  const bars = [
    ["Before", 3.4, "#94a3b8"],
    ["After", 2.0, "#2563eb"],
  ];
  const w = 1200;
  const h = 640;
  const scale = 105;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="80" y="90" font-family="${FONT}" font-size="40" font-weight="700" fill="#0f172a">Largest Contentful Paint (seconds, p75)</text>
  <line x1="80" y1="560" x2="1120" y2="560" stroke="#cbd5e1" stroke-width="2"/>
  ${bars
    .map(([name, value, color], i) => {
      const x = 220 + i * 420;
      const barH = value * scale;
      return `<rect x="${x}" y="${560 - barH}" width="260" height="${barH}" rx="8" fill="${color}"/>
  <text x="${x + 130}" y="${545 - barH}" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="700" fill="#0f172a">${value.toFixed(1)}s</text>
  <text x="${x + 130}" y="610" text-anchor="middle" font-family="${FONT}" font-size="32" fill="#475569">${name}</text>`;
    })
    .join("\n  ")}
</svg>`;
}

async function upload(filename, svg, altText) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const presign = await call("POST", "/admin/media/uploads", {
    filename,
    mimeType: "image/png",
    sizeBytes: png.length,
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(presign.fields))
    form.append(key, value);
  form.append("file", new Blob([png], { type: "image/png" }), filename);
  const res = await fetch(presign.url, { method: "POST", body: form });
  if (!res.ok)
    throw new Error(
      `Uploading ${filename} to storage failed: ${res.status} ${await res.text()}`,
    );
  return call("POST", "/admin/media", { key: presign.key, filename, altText });
}

const t = (text, marks) =>
  marks ? { type: "text", text, marks } : { type: "text", text };
const bold = (text) => t(text, [{ type: "bold" }]);
const italic = (text) => t(text, [{ type: "italic" }]);
const code = (text) => t(text, [{ type: "code" }]);
const link = (text, href) => t(text, [{ type: "link", attrs: { href } }]);
const entryLink = (text, entryType, entryId) =>
  t(text, [{ type: "entryLink", attrs: { entryType, entryId } }]);
const p = (...parts) => ({
  type: "paragraph",
  content: parts.map((part) => (typeof part === "string" ? t(part) : part)),
});
const h = (level, text) => ({
  type: "heading",
  attrs: { level },
  content: [t(text)],
});
const list = (type, items) => ({
  type,
  content: items.map((item) => ({
    type: "listItem",
    content: [Array.isArray(item) ? p(...item) : p(item)],
  })),
});
const ul = (...items) => list("bulletList", items);
const ol = (...items) => list("orderedList", items);
const quote = (...parts) => ({ type: "blockquote", content: [p(...parts)] });
const ctaEmbed = (ctaId) => ({ type: "ctaEmbed", attrs: { ctaId } });
const mediaEmbed = (mediaId) => ({ type: "mediaEmbed", attrs: { mediaId } });
const cell = (type, text) => ({ type, content: [p(text)] });
const table = (header, rows) => ({
  type: "table",
  content: [
    {
      type: "tableRow",
      content: header.map((text) => cell("tableHeader", text)),
    },
    ...rows.map((row) => ({
      type: "tableRow",
      content: row.map((text) => cell("tableCell", text)),
    })),
  ],
});
const doc = (...content) => ({ type: "doc", content });

const PALETTE = {
  blue: ["#1d4ed8", "#0ea5e9"],
  violet: ["#6d28d9", "#db2777"],
  green: ["#047857", "#65a30d"],
  amber: ["#b45309", "#e11d48"],
  slate: ["#0f172a", "#475569"],
};

const AUTHORS = [
  {
    key: "maya",
    name: "Maya Chen",
    initials: "MC",
    colors: PALETTE.violet,
    jobTitle: "Head of Content",
    bio: "Maya leads the content team at Acme. She writes about product launches, the craft of documentation, and how small teams ship big things.",
    es: {
      jobTitle: "Directora de Contenido",
      bio: "Maya dirige el equipo de contenido de Acme. Escribe sobre lanzamientos de producto, el oficio de la documentación y cómo los equipos pequeños logran grandes cosas.",
    },
  },
  {
    key: "daniel",
    name: "Daniel Okafor",
    initials: "DO",
    colors: PALETTE.blue,
    jobTitle: "Senior Software Engineer",
    bio: "Daniel works on Acme's platform team, where he spends most of his time making things faster. Before Acme he built payment systems.",
    es: {
      jobTitle: "Ingeniero de Software Sénior",
      bio: "Daniel trabaja en el equipo de plataforma de Acme, donde dedica la mayor parte de su tiempo a hacer que todo sea más rápido. Antes de Acme construyó sistemas de pago.",
    },
  },
  {
    key: "sofia",
    name: "Sofia Romero",
    initials: "SR",
    colors: PALETTE.green,
    jobTitle: "Product Designer",
    bio: "Sofia designs Acme's editor and maintains its design system. She cares about accessibility, typography and interfaces that get out of the way.",
  },
];

const CATEGORIES = [
  {
    key: "product",
    slug: "product-updates",
    gameCode: "product",
    colors: PALETTE.violet,
    icon: "P",
    title: "Product Updates",
    description:
      "Release announcements, new features and improvements across Acme's products.",
    seoMetaTitle: "Acme Product Updates and Release Notes",
    seoMetaDescription:
      "The latest Acme releases, new features and improvements, explained by the people who built them.",
    es: {
      title: "Novedades del producto",
      description:
        "Anuncios de versiones, nuevas funciones y mejoras en los productos de Acme.",
    },
  },
  {
    key: "engineering",
    slug: "engineering",
    gameCode: "engineering",
    colors: PALETTE.blue,
    icon: "E",
    title: "Engineering",
    description:
      "How we build Acme: architecture, performance work and lessons from production.",
    seoMetaTitle: "Engineering at Acme",
    seoMetaDescription:
      "Deep dives into Acme's architecture, performance work and the lessons we learn running software in production.",
    es: {
      title: "Ingeniería",
      description:
        "Cómo construimos Acme: arquitectura, rendimiento y lecciones aprendidas en producción.",
    },
  },
  {
    key: "guides",
    slug: "guides",
    gameCode: "guides",
    colors: PALETTE.green,
    icon: "G",
    title: "Guides",
    description:
      "Step-by-step tutorials and practical advice for getting the most out of Acme.",
    seoMetaTitle: "Acme Guides and Tutorials",
    seoMetaDescription:
      "Step-by-step tutorials and practical advice to help you get more done with Acme, from first project to advanced workflows.",
  },
];

const TAGS = [
  {
    key: "release",
    slug: "release-notes",
    title: "Release Notes",
    description: "What changed in each Acme release.",
  },
  {
    key: "performance",
    slug: "performance",
    title: "Performance",
    description: "Making Acme faster, and measuring it honestly.",
  },
  {
    key: "a11y",
    slug: "accessibility",
    title: "Accessibility",
    description: "Building interfaces that work for everyone.",
  },
  {
    key: "tutorial",
    slug: "tutorial",
    title: "Tutorial",
    description: "Hands-on, step-by-step walkthroughs.",
  },
  {
    key: "design",
    slug: "design-systems",
    title: "Design Systems",
    description: "Components, tokens and the process behind them.",
  },
];

async function main() {
  await call("GET", "/health");
  const me = await signIn();
  const sites = await call("GET", "/admin/sites");
  const site = sites.find((s) => s.slug === SITE_SLUG);
  if (!site)
    throw new Error(
      `No site with slug "${SITE_SLUG}". Run \`pnpm db:seed\` first.`,
    );
  if (site.defaultLanguage !== "en")
    throw new Error(
      `The demo content is written in English, but ${site.name} defaults to ${site.defaultLanguage}.`,
    );
  const spaces = await call("GET", `/admin/sites/${site.id}/spaces`);
  const space = spaces.find((s) => s.slug === SPACE_SLUG);
  if (!space)
    throw new Error(`Site ${site.slug} has no space "${SPACE_SLUG}".`);
  const spaceId = space.id;

  const existing = await call(
    "GET",
    `/admin/blogs?spaceId=${spaceId}&language=en`,
  );
  const postCount =
    existing.total ?? existing.pagination?.total ?? existing.items?.length ?? 0;
  if (postCount > 0) {
    console.log(
      `${site.name} / ${space.name} already has posts, so nothing was added. Run \`pnpm db:reset\` to start over.`,
    );
    return;
  }
  console.log(
    `Seeding demo content into ${site.name} / ${space.name} as ${me.email}\n`,
  );

  const authors = {};
  for (const a of AUTHORS) {
    const avatar = await upload(
      `${a.key}-avatar.png`,
      squareSvg({
        size: 400,
        from: a.colors[0],
        to: a.colors[1],
        text: a.initials,
      }),
      `Portrait of ${a.name}`,
    );
    const author = await call("POST", "/admin/authors", {
      spaceId,
      name: a.name,
      jobTitle: a.jobTitle,
      bio: a.bio,
      profileImageId: avatar.id,
      socialLinks: [`https://example.com/team/${a.key}`],
    });
    await publish("authors", author.id);
    if (a.es) {
      await call("PUT", `/admin/authors/${author.id}/locales/es`, a.es);
      await publish("authors", author.id, "es");
    }
    authors[a.key] = author;
    console.log(`  author    ${a.name}${a.es ? " (en, es)" : ""}`);
  }

  const categories = {};
  for (const c of CATEGORIES) {
    const featured = await upload(
      `${c.slug}-featured.png`,
      bannerSvg({
        width: 1200,
        height: 630,
        from: c.colors[0],
        to: c.colors[1],
        title: c.title,
        label: "Acme Blog",
      }),
      `${c.title} banner`,
    );
    const icon = await upload(
      `${c.slug}-icon.png`,
      squareSvg({
        size: 256,
        from: c.colors[0],
        to: c.colors[1],
        text: c.icon,
      }),
      `${c.title} icon`,
    );
    const category = await call("POST", "/admin/categories", {
      spaceId,
      slug: c.slug,
      gameCode: c.gameCode,
      title: c.title,
      description: c.description,
      featuredImageId: featured.id,
      featureIconId: icon.id,
    });
    await call("PUT", `/admin/categories/${category.id}/locales/en`, {
      title: c.title,
      description: c.description,
      seoMetaTitle: c.seoMetaTitle,
      seoMetaDescription: c.seoMetaDescription,
    });
    await publish("categories", category.id);
    if (c.es) {
      await call("PUT", `/admin/categories/${category.id}/locales/es`, c.es);
      await publish("categories", category.id, "es");
    }
    categories[c.key] = category;
    console.log(`  category  ${c.title}${c.es ? " (en, es)" : ""}`);
  }

  const tags = {};
  for (const tag of TAGS) {
    const created = await call("POST", "/admin/tags", {
      spaceId,
      slug: tag.slug,
      title: tag.title,
      description: tag.description,
    });
    await publish("tags", created.id);
    tags[tag.key] = created;
  }
  console.log(`  tags      ${TAGS.map((tag) => tag.title).join(", ")}`);

  const ctaImage = await upload(
    "free-trial-cta.png",
    bannerSvg({
      width: 1200,
      height: 630,
      ...{ from: PALETTE.amber[0], to: PALETTE.amber[1] },
      title: "Try Acme free for 14 days",
      label: "No card needed",
    }),
    "Try Acme free for 14 days",
  );
  const trialCta = await call("POST", "/admin/ctas", {
    spaceId,
    url: "/signup",
    cmpid: "blog-free-trial",
    imageId: ctaImage.id,
    title: "Start your free trial",
    description:
      "Try every Acme feature free for 14 days. No credit card required.",
    buttonLabel: "Start free trial",
  });
  await publish("ctas", trialCta.id);
  await call("PUT", `/admin/ctas/${trialCta.id}/locales/es`, {
    title: "Empieza tu prueba gratuita",
    description:
      "Prueba todas las funciones de Acme gratis durante 14 días. Sin tarjeta de crédito.",
    buttonLabel: "Probar gratis",
  });
  await publish("ctas", trialCta.id, "es");
  // A subdomain of the Site's domain: allowed by the CTA url rule
  const docsCta = await call("POST", "/admin/ctas", {
    spaceId,
    url: "https://docs.example.com/getting-started",
    cmpid: "blog-docs",
    title: "Read the documentation",
    description:
      "Guides, API reference and examples for everything Acme can do.",
    buttonLabel: "Open the docs",
  });
  await publish("ctas", docsCta.id);
  console.log(
    "  ctas      Start your free trial (en, es), Read the documentation",
  );

  const covers = {};
  const cover = async (slug, title, label, colors) => {
    covers[slug] = await upload(
      `${slug}.png`,
      bannerSvg({
        width: 1200,
        height: 630,
        from: colors[0],
        to: colors[1],
        title,
        label,
      }),
      title,
    );
    return covers[slug].id;
  };
  const chart = await upload(
    "lcp-before-after.png",
    chartSvg(),
    "Bar chart: p75 LCP fell from 3.4s to 2.0s",
  );

  async function createPost(post) {
    const created = await call("POST", "/admin/blogs", {
      spaceId,
      authorId: post.author.id,
      reviewerId: post.reviewer?.id,
      categoryId: post.category.id,
      tagIds: post.tags.map((tag) => tag.id),
      imageId: await cover(post.slug, post.title, post.label, post.colors),
      title: post.title,
      description: post.description,
      slug: post.slug,
    });
    if (post.body)
      await call("PUT", `/admin/blogs/${created.id}/locales/en`, {
        title: post.title,
        description: post.description,
        slug: post.slug,
        summary: post.summary,
        body: post.body(created.id),
        faq: post.faq ?? [],
      });
    return created;
  }

  // 1. Published, with a Spanish translation
  const launch = await createPost({
    slug: "introducing-acme-studio-2",
    title: "Introducing Acme Studio 2.0",
    label: "Product Updates",
    colors: PALETTE.violet,
    author: authors.maya,
    category: categories.product,
    tags: [tags.release],
    description:
      "Acme Studio 2.0 brings real-time collaboration to every plan, a faster editor and a rebuilt asset library. Here is what changed and how to upgrade.",
    summary:
      "Acme Studio 2.0 is our biggest release yet: real-time collaboration on every plan, an editor that opens large projects up to three times faster, and an asset library rebuilt around search. This post walks through each change and what you need to do to upgrade.",
    body: () =>
      doc(
        p(
          "Today we're releasing ",
          bold("Acme Studio 2.0"),
          ", the result of a year of listening to how teams actually work together. It's available now on every plan, at no extra cost.",
        ),
        h(2, "What's new"),
        ul(
          [
            bold("Real-time collaboration."),
            " See teammates' cursors, edit the same project at once and leave comments right where the work happens.",
          ],
          [
            bold("A faster editor."),
            " Large projects open up to three times faster, and scrolling stays smooth with thousands of layers.",
          ],
          [
            bold("A new asset library."),
            " Search across every image, icon and font in your workspace, with filters for type, owner and date.",
          ],
        ),
        h(2, "Upgrading"),
        p(
          "Existing projects open in 2.0 without any changes. If you use the desktop app, it will update itself the next time you start it. The ",
          link("upgrade notes", "https://docs.example.com/upgrade"),
          " list the few settings that moved.",
        ),
        ctaEmbed(trialCta.id),
        p(
          "We'd love to hear what you think. Reply to the release email or find us in the community forum.",
        ),
      ),
    faq: [
      {
        question: "Is the upgrade free?",
        answer:
          "Yes. Acme Studio 2.0 is included in every plan, including the free plan, at no extra cost.",
      },
      {
        question: "Can I keep using version 1?",
        answer:
          "Version 1 keeps working until the end of next year, but new features will only ship in 2.0.",
      },
    ],
  });
  await publish("blogs", launch.id);
  await call("PUT", `/admin/blogs/${launch.id}/locales/es`, {
    title: "Presentamos Acme Studio 2.0",
    slug: "presentamos-acme-studio-2",
    description:
      "Acme Studio 2.0 trae colaboración en tiempo real a todos los planes, un editor más rápido y una biblioteca de recursos renovada. Esto es lo que cambia y cómo actualizar.",
    summary:
      "Acme Studio 2.0 es nuestra mayor versión hasta la fecha: colaboración en tiempo real en todos los planes, un editor que abre proyectos grandes hasta tres veces más rápido y una biblioteca de recursos reconstruida en torno a la búsqueda. Repasamos cada cambio y lo que necesitas para actualizar.",
    body: doc(
      p(
        "Hoy lanzamos ",
        bold("Acme Studio 2.0"),
        ", el resultado de un año escuchando cómo trabajan juntos los equipos. Ya está disponible en todos los planes, sin coste adicional.",
      ),
      h(2, "Novedades"),
      ul(
        [
          bold("Colaboración en tiempo real."),
          " Ve los cursores de tus compañeros, editad el mismo proyecto a la vez y deja comentarios justo donde ocurre el trabajo.",
        ],
        [
          bold("Un editor más rápido."),
          " Los proyectos grandes se abren hasta tres veces más rápido y el desplazamiento sigue siendo fluido con miles de capas.",
        ],
        [
          bold("Una nueva biblioteca de recursos."),
          " Busca entre todas las imágenes, iconos y fuentes de tu espacio de trabajo, con filtros por tipo, propietario y fecha.",
        ],
      ),
      h(2, "Cómo actualizar"),
      p(
        "Los proyectos existentes se abren en la 2.0 sin cambios. Si usas la aplicación de escritorio, se actualizará sola la próxima vez que la inicies. Las ",
        link("notas de actualización", "https://docs.example.com/upgrade"),
        " enumeran los pocos ajustes que han cambiado de sitio.",
      ),
      ctaEmbed(trialCta.id),
      p(
        "Nos encantaría saber qué te parece. Responde al correo de la versión o búscanos en el foro de la comunidad.",
      ),
    ),
    faq: [
      {
        question: "¿La actualización es gratuita?",
        answer:
          "Sí. Acme Studio 2.0 está incluido en todos los planes, también en el gratuito, sin coste adicional.",
      },
      {
        question: "¿Puedo seguir usando la versión 1?",
        answer:
          "La versión 1 seguirá funcionando hasta finales del año que viene, pero las nuevas funciones solo llegarán a la 2.0.",
      },
    ],
  });
  await publish("blogs", launch.id, "es");
  console.log("  post      Introducing Acme Studio 2.0 — published (en, es)");

  // 2. Published, with a chart, a table and a Spanish translation
  const perf = await createPost({
    slug: "cutting-page-load-times",
    title: "How we cut page load times by 40%",
    label: "Engineering",
    colors: PALETTE.blue,
    author: authors.daniel,
    reviewer: authors.maya,
    category: categories.engineering,
    tags: [tags.performance],
    description:
      "A look at the three changes that took our dashboard's p75 Largest Contentful Paint from 3.4 seconds to 2.0, and the ones that didn't help.",
    summary:
      "Our dashboard felt slow, and the numbers agreed. Over six weeks we took its p75 Largest Contentful Paint from 3.4 seconds to 2.0 by streaming the first screen, deferring third-party scripts and caching at the edge. Here's what worked, what didn't, and how we measured it.",
    body: () =>
      doc(
        p(
          "Six weeks ago our dashboard's p75 ",
          bold("Largest Contentful Paint"),
          " was 3.4 seconds. Customers had started to mention it, which is usually a sign it has been a problem for a while.",
        ),
        h(2, "Where the time went"),
        p(
          "Before changing anything we recorded real-user traces for a week. Three things stood out:",
        ),
        ol(
          "The first screen waited for every widget's data, even the ones below the fold.",
          "Two analytics scripts blocked the main thread for almost 400 ms.",
          [
            "Every request for account settings went all the way to the origin, even though they change ",
            italic("maybe"),
            " once a month.",
          ],
        ),
        mediaEmbed(chart.id),
        h(2, "What we changed"),
        p(
          "We now stream the first screen as soon as its own data arrives, load third-party scripts after the page is interactive, and cache settings at the edge with a short ",
          code("stale-while-revalidate"),
          " window.",
        ),
        table(
          ["Metric (p75)", "Before", "After"],
          [
            ["Largest Contentful Paint", "3.4 s", "2.0 s"],
            ["Interaction to Next Paint", "310 ms", "140 ms"],
            ["Time to First Byte", "820 ms", "190 ms"],
          ],
        ),
        quote(
          "Measure with real users first. Our lab numbers had looked fine all along.",
        ),
        p(
          "The same streaming approach shipped in ",
          entryLink("Acme Studio 2.0", "blog", launch.id),
          ", which is part of why large projects now open so much faster.",
        ),
      ),
    faq: [
      {
        question: "Which tools did you use to measure this?",
        answer:
          "Real-user monitoring for the numbers we report, and browser performance traces to find the causes.",
      },
    ],
  });
  await publish("blogs", perf.id);
  await call("PUT", `/admin/blogs/${perf.id}/locales/es`, {
    title: "Cómo redujimos los tiempos de carga un 40 %",
    slug: "como-redujimos-los-tiempos-de-carga",
    description:
      "Los tres cambios que llevaron el Largest Contentful Paint p75 de nuestro panel de 3,4 a 2,0 segundos, y los que no sirvieron de nada.",
    summary:
      "Nuestro panel se sentía lento y los datos lo confirmaban. En seis semanas bajamos su Largest Contentful Paint p75 de 3,4 a 2,0 segundos transmitiendo primero la pantalla inicial, aplazando los scripts de terceros y cacheando en el edge. Esto es lo que funcionó, lo que no y cómo lo medimos.",
    body: doc(
      p(
        "Hace seis semanas, el ",
        bold("Largest Contentful Paint"),
        " p75 de nuestro panel era de 3,4 segundos. Los clientes habían empezado a mencionarlo, lo que suele indicar que el problema venía de lejos.",
      ),
      h(2, "Dónde se iba el tiempo"),
      p(
        "Antes de cambiar nada, registramos trazas de usuarios reales durante una semana. Destacaron tres cosas:",
      ),
      ol(
        "La primera pantalla esperaba los datos de todos los widgets, incluso los que quedaban fuera de la vista.",
        "Dos scripts de analítica bloqueaban el hilo principal casi 400 ms.",
        "Cada petición de ajustes de la cuenta llegaba hasta el origen, aunque cambian como mucho una vez al mes.",
      ),
      mediaEmbed(chart.id),
      h(2, "Qué cambiamos"),
      p(
        "Ahora enviamos la primera pantalla en cuanto llegan sus propios datos, cargamos los scripts de terceros cuando la página ya es interactiva y cacheamos los ajustes en el edge con una ventana corta de ",
        code("stale-while-revalidate"),
        ".",
      ),
      quote(
        "Mide primero con usuarios reales. Nuestras cifras de laboratorio siempre habían parecido correctas.",
      ),
    ),
    faq: [],
  });
  await publish("blogs", perf.id, "es");
  console.log(
    "  post      How we cut page load times by 40% — published (en, es)",
  );

  // 3. Published, with a French translation
  const forms = await createPost({
    slug: "accessible-forms-guide",
    title: "A practical guide to accessible forms",
    label: "Guides",
    colors: PALETTE.green,
    author: authors.sofia,
    category: categories.guides,
    tags: [tags.a11y, tags.tutorial],
    description:
      "Labels, error messages and keyboard support: the handful of habits that make forms usable for everyone, with examples you can copy.",
    summary:
      "Most form accessibility problems come from a handful of habits: missing labels, errors that only show in red, and fields you can't reach with a keyboard. This guide covers each one with a short example, plus a checklist to run before you ship your next form.",
    body: () =>
      doc(
        p(
          "Forms are where people sign up, pay and ask for help, so a form that doesn't work with a screen reader or keyboard turns people away at the worst moment. The good news: a few habits fix most problems.",
        ),
        h(2, "Label every field"),
        p(
          "Every input needs a visible label tied to it with ",
          code("for"),
          " and ",
          code("id"),
          ". Placeholder text is not a label: it disappears as soon as someone starts typing.",
        ),
        h(2, "Make errors easy to find"),
        ul(
          "Say what went wrong and how to fix it, in words, not only in red.",
          "Move focus to the first field with an error after a failed submit.",
          [
            "Link the message to its field with ",
            code("aria-describedby"),
            " so screen readers announce it.",
          ],
        ),
        h(3, "Before you ship"),
        ul(
          "Can you complete the form using only the keyboard?",
          "Does every field have a visible label?",
          "Are errors announced and described in text?",
        ),
        p(
          "More guides like this live in ",
          entryLink("Guides", "category", categories.guides.id),
          ".",
        ),
        ctaEmbed(docsCta.id),
      ),
    faq: [
      {
        question: "Is a placeholder enough instead of a label?",
        answer:
          "No. Placeholders vanish while typing and are often low contrast. Use a visible label and keep the placeholder for an example value, if at all.",
      },
      {
        question: "How do I test with a screen reader?",
        answer:
          "NVDA on Windows and VoiceOver on macOS are both free. Try filling in your form with your eyes closed, then fix whatever trips you up.",
      },
    ],
  });
  await publish("blogs", forms.id);
  await call("PUT", `/admin/blogs/${forms.id}/locales/fr`, {
    title: "Guide pratique des formulaires accessibles",
    slug: "guide-formulaires-accessibles",
    description:
      "Libellés, messages d'erreur et navigation au clavier : les quelques habitudes qui rendent les formulaires utilisables par tous, avec des exemples à copier.",
    summary:
      "La plupart des problèmes d'accessibilité des formulaires viennent de quelques habitudes : des libellés manquants, des erreurs signalées uniquement en rouge et des champs inaccessibles au clavier. Ce guide les aborde une à une, avec un exemple court et une liste de vérification.",
    body: doc(
      p(
        "C'est dans les formulaires que l'on s'inscrit, que l'on paie et que l'on demande de l'aide : un formulaire inutilisable au lecteur d'écran ou au clavier fait fuir les gens au pire moment.",
      ),
      h(2, "Un libellé pour chaque champ"),
      p(
        "Chaque champ a besoin d'un libellé visible, relié par ",
        code("for"),
        " et ",
        code("id"),
        ". Le texte indicatif n'est pas un libellé : il disparaît dès que l'on commence à écrire.",
      ),
      h(2, "Des erreurs faciles à trouver"),
      ul(
        "Expliquez le problème et la solution avec des mots, pas seulement en rouge.",
        "Placez le focus sur le premier champ en erreur après un envoi raté.",
        ["Reliez le message à son champ avec ", code("aria-describedby"), "."],
      ),
      ctaEmbed(docsCta.id),
    ),
    faq: [],
  });
  await publish("blogs", forms.id, "fr");
  console.log(
    "  post      A practical guide to accessible forms — published (en, fr)",
  );

  // 4. Published, then edited: live, with unpublished changes ("Changed")
  const designPost = {
    slug: "design-system-that-scales",
    title: "Building a design system that scales",
    label: "Engineering",
    colors: PALETTE.slate,
    author: authors.sofia,
    reviewer: authors.daniel,
    category: categories.engineering,
    tags: [tags.design],
    description:
      "What we learned growing Acme's design system from twelve components to a hundred and forty, without slowing down the teams who use it.",
    summary:
      "Acme's design system started as twelve components in a single file. Three years later it has a hundred and forty, used by nine teams. These are the decisions that helped it grow without becoming a bottleneck: tokens first, a small core, and a clear path for contributions.",
    body: () =>
      doc(
        p(
          "A design system is a product whose users are other teams. Treating it that way changed most of our decisions.",
        ),
        h(2, "Tokens first"),
        p(
          "Colour, spacing and type live in design tokens, so a theme change is a data change, not a refactor.",
        ),
        h(2, "A small core"),
        p(
          "The core library only takes components used by at least three teams. Everything else starts life in the team that needs it.",
        ),
        h(2, "A clear path for contributions"),
        p(
          "Anyone can propose a component. A short template asks what problem it solves and who else needs it, and most proposals are reviewed within a week.",
        ),
      ),
  };
  const design = await createPost(designPost);
  await publish("blogs", design.id);
  await call("PUT", `/admin/blogs/${design.id}/locales/en`, {
    title: designPost.title,
    description: designPost.description,
    slug: designPost.slug,
    summary: `${designPost.summary} We also cover what we would do differently next time.`,
    updateNote: "Added a section on what we would do differently.",
    body: doc(
      ...designPost.body().content,
      h(2, "What we'd do differently"),
      p(
        "We'd write usage guidelines alongside the first components, not two years later. Documentation written after the fact describes what people already do, not what they should.",
      ),
    ),
    faq: [],
  });
  console.log(
    "  post      Building a design system that scales — published, then edited (Changed)",
  );

  // 5. Draft: written but never published
  await createPost({
    slug: "getting-started-with-the-acme-api",
    title: "Getting started with the Acme API",
    label: "Guides",
    colors: PALETTE.blue,
    author: authors.daniel,
    category: categories.guides,
    tags: [tags.tutorial],
    description:
      "Create an API key, make your first request and handle pagination, in about ten minutes.",
    summary:
      "The Acme API lets you automate anything you can do in the app. This guide takes you from zero to a working script: creating an API key, making your first authenticated request, paging through results and handling rate limits gracefully.",
    body: () =>
      doc(
        p(
          "This guide assumes you can run a command in a terminal. Everything else we'll set up together.",
        ),
        h(2, "1. Create an API key"),
        p(
          "Open ",
          bold("Settings → API keys"),
          " and create a key. Copy it now: it's only shown once.",
        ),
        h(2, "2. Make your first request"),
        p(
          "Send the key as a bearer token in the ",
          code("Authorization"),
          " header. A successful request returns your workspace's projects as JSON.",
        ),
        h(2, "3. Page through results"),
        p(
          "List endpoints return 50 items at a time. Pass the ",
          code("page"),
          " parameter to fetch the next batch until the response is empty.",
        ),
      ),
  });
  console.log("  post      Getting started with the Acme API — draft");

  // 6. Draft: only a title and description so far
  await createPost({
    slug: "whats-next-on-our-roadmap",
    title: "What's next on our roadmap",
    label: "Product Updates",
    colors: PALETTE.amber,
    author: authors.maya,
    category: categories.product,
    tags: [],
    description:
      "A preview of what we're building over the next two quarters, and how your feedback shaped it.",
  });
  console.log(
    "  post      What's next on our roadmap — draft, not written yet",
  );

  const featured = await call(
    "GET",
    `/admin/spaces/${spaceId}/featured-articles`,
  );
  await call("PUT", `/admin/spaces/${spaceId}/featured-articles/locales/en`, {
    blogIds: [launch.id, perf.id, forms.id],
  });
  await publish("featured-articles", featured.id);
  await call("PUT", `/admin/spaces/${spaceId}/featured-articles/locales/es`, {
    blogIds: [launch.id, perf.id],
  });
  await publish("featured-articles", featured.id, "es");
  console.log("  featured  3 posts (en), 2 posts (es)");

  const retired = await call("POST", "/admin/tags", {
    spaceId,
    slug: "company-news",
    title: "Company News",
    description: "Retired in favour of Product Updates.",
  });
  await call("POST", `/admin/content/tags/${retired.id}/trash`);
  console.log("  trash     tag Company News");

  console.log(`\nDone. Open http://localhost:3000 to see it.`);
}

main().catch((error) => {
  console.error(`\nDemo seed failed: ${error.message}`);
  process.exit(1);
});
