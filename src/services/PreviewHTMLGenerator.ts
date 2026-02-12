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
   *
   * CDN Graceful Degradation:
   * - If GitHub CSS fails to load: Markdown renders unstyled but readable
   * - If Mermaid.js fails to load: Diagrams display as code blocks
   * - Browser handles CDN failures automatically; no server-side error handling needed
   */
  generateHTML(content: string, title: string): string {
    // Parse markdown to HTML using marked
    // GitHub Flavored Markdown with line breaks enabled
    const renderedMarkdown = marked.parse(content, {
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert \n to <br>
    }) as string;

    // Generate complete HTML5 document
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>

  <!-- GitHub Markdown CSS - Light theme -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.7.0/github-markdown-light.min.css" media="(prefers-color-scheme: light)">
  <!-- GitHub Markdown CSS - Dark theme -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.7.0/github-markdown-dark.min.css" media="(prefers-color-scheme: dark)">

  <style>
    /* Light mode (default) */
    :root {
      color-scheme: light dark;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #1f2328;
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
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #0d1117;
        color: #e6edf3;
      }
      .markdown-body {
        background-color: #0d1117;
      }
    }
    /* Mermaid diagram styling */
    pre.mermaid {
      background: transparent !important;
      text-align: center;
    }
    /* Force decimal numbers for all ordered list levels (override GitHub CSS roman numerals) */
    .markdown-body ol,
    .markdown-body ol ol,
    .markdown-body ol ol ol {
      list-style-type: decimal;
    }
  </style>

  <!-- Mermaid.js for diagram rendering -->
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

    // Detect color scheme and set Mermaid theme accordingly
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default'
    });

    // Transform code blocks with language-mermaid to mermaid-compatible format
    // marked outputs: <pre><code class="language-mermaid">...</code></pre>
    // Mermaid expects: <pre class="mermaid">...</pre>
    document.addEventListener('DOMContentLoaded', async () => {
      const mermaidBlocks = document.querySelectorAll('pre > code.language-mermaid');
      for (const codeBlock of mermaidBlocks) {
        const pre = codeBlock.parentElement;
        if (pre) {
          // Get the mermaid content
          const content = codeBlock.textContent || '';
          // Replace the pre element with a mermaid-ready pre
          const newPre = document.createElement('pre');
          newPre.className = 'mermaid';
          newPre.textContent = content;
          pre.replaceWith(newPre);
        }
      }
      // Now run mermaid on all .mermaid elements
      await mermaid.run();
    });
  </script>
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
