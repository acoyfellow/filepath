<script lang="ts">
  import { dev } from "$app/environment";
  import { PLATFORM_NAME, PLATFORM_URL } from "$lib/config";

  const baseUrl = dev ? "http://localhost:5173" : PLATFORM_URL;
  const defaultOgImage = `${baseUrl}/og.jpg`;

  interface Breadcrumb {
    name: string;
    item: string;
  }

  interface ArticleSchema {
    "@context": "https://schema.org";
    "@type": "Article";
    headline: string;
    description: string;
    image: string;
    wordCount: number;
    author: {
      "@type": "Organization";
      name: string;
    };
    publisher: {
      "@type": "Organization";
      name: string;
      logo: {
        "@type": "ImageObject";
        url: string;
      };
    };
    datePublished: string;
    dateModified: string;
    mainEntityOfPage: {
      "@type": "WebPage";
      "@id": string;
    };
  }

  interface BreadcrumbSchema {
    "@context": "https://schema.org";
    "@type": "BreadcrumbList";
    itemListElement: Array<{
      "@type": "ListItem";
      position: number;
      name: string;
      item: string;
    }>;
  }

  interface OrganizationSchema {
    "@context": "https://schema.org";
    "@type": "Organization";
    name: string;
    url: string;
    logo: {
      "@type": "ImageObject";
      url: string;
    };
    sameAs?: string[];
  }

  interface Props {
    title: string;
    description: string;
    keywords?: string;
    path: string;
    type?: "article" | "website";
    section?: string;
    tags?: string;
    publishedTime?: string;
    modifiedTime?: string;
    ogImage?: string;
    readingTime?: string;
    wordCount?: number;
    author?: string;
    breadcrumbs?: Breadcrumb[];
    noindex?: boolean;
    sameAs?: string[];
  }

  let {
    title,
    description,
    keywords = "",
    path,
    type = "website",
    section = "",
    tags = "",
    publishedTime = "2026-03-14",
    modifiedTime = "2026-03-14",
    ogImage,
    readingTime = "",
    wordCount = 0,
    author = PLATFORM_NAME,
    breadcrumbs = [],
    noindex = false,
    sameAs = [
      "https://github.com/acoyfellow/filepath",
      "https://x.com/acoyfellow",
    ],
  }: Props = $props();

  function generateBreadcrumbsSchema(): BreadcrumbSchema | null {
    if (!breadcrumbs.length) return null;

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem" as const,
          position: 1,
          name: "Home",
          item: baseUrl,
        },
        ...breadcrumbs.map((crumb, index) => ({
          "@type": "ListItem" as const,
          position: index + 2,
          name: crumb.name,
          item: `${baseUrl}${crumb.item}`,
        })),
      ],
    };
  }

  function generateOrganizationSchema(): OrganizationSchema {
    const logoUrl = `${baseUrl}/logo.svg`;

    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: PLATFORM_NAME,
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: logoUrl,
      },
      sameAs,
    };
  }

  function generateArticleSchema(): ArticleSchema | null {
    if (type !== "article") return null;

    const logoUrl = `${baseUrl}/logo.svg`;

    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      image: ogImageUrl,
      wordCount,
      author: {
        "@type": "Organization",
        name: author,
      },
      publisher: {
        "@type": "Organization",
        name: PLATFORM_NAME,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
      },
      datePublished: publishedTime,
      dateModified: modifiedTime,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${baseUrl}${path}`,
      },
    };
  }

  function safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      console.error("Failed to stringify SEO schema", error);
      return "{}";
    }
  }

  const ogImageUrl = $derived(ogImage ?? defaultOgImage);
  const canonicalUrl = $derived(`${baseUrl}${path}`);
  const organizationSchema = $derived(generateOrganizationSchema());
  const breadcrumbsSchema = $derived(generateBreadcrumbsSchema());
  const articleSchema = $derived(generateArticleSchema());
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  {#if keywords}
    <meta name="keywords" content={keywords} />
  {/if}
  <link rel="canonical" href={canonicalUrl} />

  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {/if}

  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:site_name" content={PLATFORM_NAME} />
  {#if section}
    <meta property="article:section" content={section} />
  {/if}
  {#if tags}
    <meta property="article:tag" content={tags} />
  {/if}
  {#if type === "article"}
    <meta property="article:published_time" content={publishedTime} />
    <meta property="article:modified_time" content={modifiedTime} />
  {/if}
  {#if readingTime}
    <meta name="twitter:label1" content="Reading time" />
    <meta name="twitter:data1" content={readingTime} />
  {/if}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImageUrl} />

  {@html `<script type="application/ld+json">${safeStringify(organizationSchema)}</script>`}
  {#if breadcrumbsSchema}
    {@html `<script type="application/ld+json">${safeStringify(breadcrumbsSchema)}</script>`}
  {/if}
  {#if articleSchema}
    {@html `<script type="application/ld+json">${safeStringify(articleSchema)}</script>`}
  {/if}
</svelte:head>
