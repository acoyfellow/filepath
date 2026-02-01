import type { RequestHandler } from './$types';

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function generateOGImageSVG(title: string, description: string): string {
  const titleLines = wrapText(title, 30).slice(0, 3);
  const descLines = description ? wrapText(description, 50).slice(0, 2) : [];

  const titleText = titleLines
    .map((line, i) => `<text x="60" y="${260 + i * 70}" font-family="system-ui, sans-serif" font-size="58" font-weight="700" fill="#FAFAFA">${escapeXml(line)}</text>`)
    .join('\n');

  const descText = descLines
    .map((line, i) => `<text x="60" y="${260 + titleLines.length * 70 + 30 + i * 32}" font-family="system-ui, sans-serif" font-size="24" fill="rgba(250,250,250,0.8)">${escapeXml(line)}</text>`)
    .join('\n');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0A0A0A"/>
  <rect x="40" y="40" width="1120" height="550" rx="8" fill="#171717" stroke="#262626" stroke-width="2"/>
  <text x="60" y="100" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="#737373">myfilepath.com</text>
  ${titleText}
  ${descText}
  <text x="60" y="570" font-family="system-ui, sans-serif" font-size="16" font-weight="400" fill="#525252">A home directory for autonomous work</text>
  <svg x="1080" y="520" width="60" height="60" viewBox="0 0 339 339" fill="none">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="#FAFAFA"/>
  </svg>
</svg>`;
}

export const GET: RequestHandler = async ({ url }) => {
  const title = url.searchParams.get('title') || 'myfilepath.com';
  const description = url.searchParams.get('description') || 'A home directory for autonomous work';

  const svg = generateOGImageSVG(title, description);

  return new Response(svg, {
    headers: { 
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
