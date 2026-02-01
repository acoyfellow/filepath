<script lang="ts">
  import { dev } from "$app/environment";

  const baseUrl = dev ? "http://localhost:5173" : "https://myfilepath.com";
  const defaultOgImage = `${baseUrl}/og.jpg`;

  // PNG converter URL - Configure this to point to your deployed SVG-to-PNG Cloudflare worker
  // See svg-to-png/+server.ts or og-image-hybrid/+server.ts for worker implementations
  // Leave empty to use the defaultOgImage instead of dynamic OG images
  const pngConverterUrl = ""; // Add your worker URL here when deployed

  function generateOGImageUrl(title: string, description: string): string {
    if (!pngConverterUrl) {
      // Return default OG image if converter URL is not configured
      return defaultOgImage;
    }
    const svgUrl = `${baseUrl}/api/og-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
    return `${pngConverterUrl}/?url=${encodeURIComponent(svgUrl)}`;
  }

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
    ogImage?: string;
    breadcrumbs?: Breadcrumb[];
    noindex?: boolean;
  }

  let {
    title,
    description,
    keywords = "",
    path,
    type = "website",
    ogImage,
    breadcrumbs = [],
    noindex = false,
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
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "myfilepath.com",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/favicon.svg`,
      },
    };
  }

  function safeStringify(obj: any): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      console.error("Failed to stringify schema:", e);
      return "{}";
    }
  }

  let breadcrumbsSchema = $derived(generateBreadcrumbsSchema());
  let organizationSchema = $derived(generateOrganizationSchema());

  let breadcrumbsJson = $derived(
    breadcrumbsSchema ? safeStringify(breadcrumbsSchema) : ""
  );
  let organizationJson = $derived(safeStringify(organizationSchema));

  // Generate OG image URL if not explicitly provided
  let ogImageUrl = $derived(
    ogImage ? ogImage : generateOGImageUrl(title, description)
  );
</script>

<svelte:head>
  <!-- Essential Meta Tags -->
  <title>{title}</title>
  <meta name="description" content={description} />
  {#if keywords}
    <meta name="keywords" content={keywords} />
  {/if}
  <link rel="canonical" href={`${baseUrl}${path}`} />
  
  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {/if}

  <!-- Open Graph -->
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={`${baseUrl}${path}`} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:site_name" content="myfilepath.com" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImageUrl} />

  <!-- Schema.org Markup -->
  <!-- Organization schema - always present -->
  {@html `<script type="application/ld+json">${organizationJson}</script>`}

  <!-- Breadcrumb schema - when breadcrumbs provided -->
  {#if breadcrumbsJson}
    {@html `<script type="application/ld+json">${breadcrumbsJson}</script>`}
  {/if}
</svelte:head>
