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
  <svg x="1080" y="520" width="60" height="50" viewBox="0 0 109 91" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M54.4141 5V14.3418H95.5234V33.0264H104V86H5V5H54.4141Z" fill="#FFDE46" stroke="black" stroke-width="10"/>
    <rect x="20" y="28" width="89" height="10" fill="black"/>
    <rect x="20" y="38" width="10" height="34" fill="black"/>
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
