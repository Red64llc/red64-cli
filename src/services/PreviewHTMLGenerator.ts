/**
 * PreviewHTMLGenerator Service
 * Transforms markdown content to HTML with GitHub styling and Mermaid support
 */

import { marked } from 'marked';

/**
 * PreviewHTMLGeneratorInterface defines the contract for markdown to HTML transformation
 */
export interface PreviewHTMLGeneratorInterface {
  /**
   * Generate complete HTML document from markdown content
   * @param content - Raw markdown string
   * @param title - Artifact name for HTML title
   * @returns Complete HTML document string
   */
  generateHTML(content: string, title: string): string;
}

/**
 * PreviewHTMLGenerator implementation using marked library with GitHub CSS styling
 */
export class PreviewHTMLGenerator implements PreviewHTMLGeneratorInterface {
  /**
   * Generate complete HTML document from markdown content
   * Includes GitHub markdown CSS and Mermaid.js for diagram rendering
   */
  generateHTML(content: string, title: string): string {
    // Parse markdown to HTML using marked
    // Disable HTML sanitization to allow Mermaid diagrams, but escape inline HTML
    const renderedMarkdown = marked.parse(content, {
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert \n to <br>
      mangle: false, // Don't escape email addresses
      headerIds: false, // Don't add IDs to headings
    }) as string;

    // Generate complete HTML5 document
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>

  <!-- GitHub Markdown CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.7.0/github-markdown.min.css">

  <!-- Mermaid.js for diagram rendering -->
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>

  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
    }
    .container {
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
    }
    @media (max-width: 768px) {
      .container {
        padding: 15px;
      }
    }
    /* Ensure markdown-body has proper background */
    .markdown-body {
      box-sizing: border-box;
      min-width: 200px;
      background-color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="container">
    <article class="markdown-body">
${renderedMarkdown}
    </article>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Escape HTML special characters in title to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m] ?? m);
  }
}
