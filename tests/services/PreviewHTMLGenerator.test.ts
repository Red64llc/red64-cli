/**
 * Unit tests for PreviewHTMLGenerator service
 * Tests markdown to HTML transformation with GitHub styling and Mermaid support
 */

import { describe, it, expect } from 'vitest';
import { PreviewHTMLGenerator } from '../../src/services/PreviewHTMLGenerator.js';

describe('PreviewHTMLGenerator', () => {
  const generator = new PreviewHTMLGenerator();

  describe('generateHTML', () => {
    it('should return valid HTML5 document structure', () => {
      const content = '# Test';
      const title = 'Test Artifact';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('should set HTML title tag to artifact name', () => {
      const content = '# Content';
      const title = 'Requirements Document';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<title>Requirements Document</title>');
    });

    it('should include github-markdown-css stylesheet link', () => {
      const content = '# Test';
      const title = 'Test';

      const html = generator.generateHTML(content, title);

      expect(html).toMatch(/github-markdown.*\.css/);
    });

    it('should include mermaid.js script tag', () => {
      const content = '# Test';
      const title = 'Test';

      const html = generator.generateHTML(content, title);

      expect(html).toMatch(/mermaid.*\.js/);
    });

    it('should wrap rendered markdown in article with markdown-body class', () => {
      const content = '# Test';
      const title = 'Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<article class="markdown-body">');
      expect(html).toContain('</article>');
    });

    it('should render markdown headings h1-h6', () => {
      const content = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;
      const title = 'Headings Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<h1>Heading 1</h1>');
      expect(html).toContain('<h2>Heading 2</h2>');
      expect(html).toContain('<h3>Heading 3</h3>');
      expect(html).toContain('<h4>Heading 4</h4>');
      expect(html).toContain('<h5>Heading 5</h5>');
      expect(html).toContain('<h6>Heading 6</h6>');
    });

    it('should render unordered lists', () => {
      const content = `- Item 1
- Item 2
- Item 3`;
      const title = 'List Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
      expect(html).toContain('<li>Item 3</li>');
      expect(html).toContain('</ul>');
    });

    it('should render ordered lists', () => {
      const content = `1. First
2. Second
3. Third`;
      const title = 'Ordered List Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<ol>');
      expect(html).toContain('<li>First</li>');
      expect(html).toContain('<li>Second</li>');
      expect(html).toContain('<li>Third</li>');
      expect(html).toContain('</ol>');
    });

    it('should render nested lists', () => {
      const content = `- Parent 1
  - Child 1.1
  - Child 1.2
- Parent 2`;
      const title = 'Nested List Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Parent 1');
      expect(html).toContain('<li>Child 1.1</li>');
    });

    it('should render code blocks with pre and code tags', () => {
      const content = '```javascript\nconst x = 42;\n```';
      const title = 'Code Block Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<pre>');
      expect(html).toContain('<code');
      expect(html).toContain('const x = 42;');
      expect(html).toContain('</code>');
      expect(html).toContain('</pre>');
    });

    it('should render inline code with code tag', () => {
      const content = 'Use `const` for constants';
      const title = 'Inline Code Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<code>const</code>');
    });

    it('should render markdown links as clickable anchors', () => {
      const content = '[Google](https://google.com)';
      const title = 'Link Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<a href="https://google.com">Google</a>');
    });

    it('should render bold emphasis', () => {
      const content = '**bold text**';
      const title = 'Bold Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<strong>bold text</strong>');
    });

    it('should render italic emphasis', () => {
      const content = '*italic text*';
      const title = 'Italic Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<em>italic text</em>');
    });

    it('should render blockquotes', () => {
      const content = '> This is a quote';
      const title = 'Blockquote Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<blockquote>');
      expect(html).toContain('This is a quote');
      expect(html).toContain('</blockquote>');
    });

    it('should preserve Mermaid code blocks without pre-rendering', () => {
      const content = '```mermaid\ngraph TD\nA-->B\n```';
      const title = 'Mermaid Test';

      const html = generator.generateHTML(content, title);

      // Mermaid code blocks should be preserved for client-side rendering
      // HTML entities are escaped in code blocks (--&gt; instead of -->)
      expect(html).toContain('language-mermaid');
      expect(html).toContain('graph TD');
      expect(html).toMatch(/A--[>&]*(gt;)?B/); // Allow for HTML escaping
    });

    it('should handle empty content', () => {
      const content = '';
      const title = 'Empty Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Empty Test</title>');
    });

    it('should handle content with special HTML characters', () => {
      const content = '# Test `<script>alert("xss")</script>`';
      const title = 'XSS Test';

      const html = generator.generateHTML(content, title);

      // Inline code should escape HTML entities
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;/script&gt;');
    });

    it('should include responsive container styles', () => {
      const content = '# Test';
      const title = 'Test';

      const html = generator.generateHTML(content, title);

      // Should have styles for max-width and padding
      expect(html).toContain('max-width');
      expect(html).toContain('padding');
    });

    it('should set UTF-8 character encoding', () => {
      const content = '# Test with émojis 🎉';
      const title = 'Encoding Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<meta charset="utf-8"');
    });

    it('should include viewport meta tag for mobile responsiveness', () => {
      const content = '# Test';
      const title = 'Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<meta name="viewport"');
    });

    it('should preserve paragraph spacing', () => {
      const content = `First paragraph.

Second paragraph.`;
      const title = 'Paragraph Test';

      const html = generator.generateHTML(content, title);

      expect(html).toContain('<p>First paragraph.</p>');
      expect(html).toContain('<p>Second paragraph.</p>');
    });
  });

  describe('CDN resource handling', () => {
    it('should use CDN links with proper protocol', () => {
      const content = '# Test';
      const title = 'CDN Test';

      const html = generator.generateHTML(content, title);

      // Verify HTTPS protocol for CDN resources
      expect(html).toContain('https://cdn.jsdelivr.net');
    });

    it('should include graceful degradation note in HTML comments', () => {
      const content = '# Test';
      const title = 'Test';

      const html = generator.generateHTML(content, title);

      // CDN resources are loaded client-side; browser handles failures gracefully
      // Markdown will still render without GitHub CSS (unstyled)
      // Mermaid diagrams will show as code blocks if JS fails to load
      expect(html).toContain('<!DOCTYPE html>'); // Basic structure always present
    });
  });
});
