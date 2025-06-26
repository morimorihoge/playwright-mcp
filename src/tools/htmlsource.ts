/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from 'zod';
import { defineTool, type ToolFactory } from './tool.js';

interface HtmlSourceResponse {
  content: string;
  totalLength: number;
  hasMore: boolean;
  actualOffset: number;
  actualLength: number;
}

const getHtmlSource: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',

  schema: {
    name: 'browser_get_html_source',
    title: 'Get HTML source',
    description: 'Get the HTML source of the current page with optional filtering and compression',
    inputSchema: z.object({
      // Compression and optimization options
      compress: z.boolean().optional().describe('Minify HTML by removing whitespace and line breaks'),
      excludeTags: z.array(z.string()).optional().describe('Array of tag names to exclude (e.g., ["script", "style", "noscript"])'),
      includeComments: z.boolean().optional().describe('Include HTML comments (default: false)'),
      prettyPrint: z.boolean().optional().describe('Format output with proper indentation (default: false)'),
      
      // Partial retrieval options
      selector: z.string().optional().describe('CSS selector to get only specific elements'),
      maxLength: z.number().optional().describe('Maximum number of characters to return'),
      offset: z.number().optional().describe('Starting character position for partial retrieval'),
      headOnly: z.boolean().optional().describe('Return only the <head> section'),
      bodyOnly: z.boolean().optional().describe('Return only the <body> section'),
      
      // Preset combinations
      preset: z.enum(['full', 'minimal', 'structure', 'content']).optional().describe('Predefined option combinations'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    // Apply preset configurations
    let finalParams = { ...params };
    if (params.preset) {
      switch (params.preset) {
        case 'minimal':
          finalParams = { ...params, excludeTags: ['script', 'style', 'noscript'], compress: true, includeComments: false };
          break;
        case 'structure':
          finalParams = { ...params, excludeTags: ['script', 'style'], compress: true };
          break;
        case 'content':
          finalParams = { ...params, excludeTags: ['script', 'style', 'meta', 'link'], compress: true };
          break;
        case 'full':
          finalParams = { ...params }; // Explicitly retain original parameters
          break;
        default:
          // Keep original params
          break;
      }
    }

    // Get initial HTML source
    let htmlSource = await tab.page.content();

    // Apply DOM manipulation for excluded tags first (most reliable approach)
    if (finalParams.excludeTags && finalParams.excludeTags.length > 0) {
      for (const tag of finalParams.excludeTags) {
        try {
          // Use a safer approach with limited scope
          const removedCount = await tab.page.$$eval(tag, elements => {
            const count = elements.length;
            elements.forEach(el => el.remove());
            return count;
          });
          // Optional: log for debugging
          // console.log(`Removed ${removedCount} <${tag}> elements`);
        } catch (error) {
          // Ignore errors for non-existent tags - this is expected behavior
        }
      }
      // Get updated content after removing tags
      htmlSource = await tab.page.content();
    }

    // Apply selector filter or head/body extraction using DOM operations when possible
    if (finalParams.selector) {
      try {
        const elements = await tab.page.$$eval(finalParams.selector, (els) => 
          els.map(el => el.outerHTML).join('\n')
        );
        htmlSource = elements || `<!-- Selector "${finalParams.selector}" not found -->`;
      } catch (error) {
        htmlSource = `<!-- Selector "${finalParams.selector}" not found -->`;
      }
    } else if (finalParams.headOnly) {
      try {
        htmlSource = await tab.page.$eval('head', el => el.outerHTML);
      } catch (error) {
        htmlSource = '<!-- No <head> section found -->';
      }
    } else if (finalParams.bodyOnly) {
      try {
        htmlSource = await tab.page.$eval('body', el => el.outerHTML);
      } catch (error) {
        htmlSource = '<!-- No <body> section found -->';
      }
    }

    // Remove comments if not included
    if (!finalParams.includeComments) {
      htmlSource = htmlSource.replace(/<!--[\s\S]*?-->/g, '');
    }

    // Apply compression
    if (finalParams.compress) {
      htmlSource = htmlSource
        .replace(/>\s+</g, '><')  // Remove whitespace between tags
        .replace(/\s+/g, ' ')     // Collapse multiple whitespace to single space
        .trim();
    }

    // Apply pretty printing (only if compression is disabled)
    if (finalParams.prettyPrint && !finalParams.compress) {
      // Simple pretty printing - add newlines after tags
      htmlSource = htmlSource
        .replace(/></g, '>\n<')
        .replace(/^\s+|\s+$/gm, ''); // Trim each line
    }

    const totalLength = htmlSource.length;
    const offset = finalParams.offset || 0;
    const maxLength = finalParams.maxLength;

    let resultContent: string;
    let actualOffset: number;
    let actualLength: number;
    let hasMore: boolean;

    if (maxLength !== undefined) {
      const endPos = Math.min(offset + maxLength, totalLength);
      resultContent = htmlSource.slice(offset, endPos);
      actualOffset = offset;
      actualLength = resultContent.length;
      hasMore = endPos < totalLength;
    } else {
      resultContent = offset > 0 ? htmlSource.slice(offset) : htmlSource;
      actualOffset = offset;
      actualLength = resultContent.length;
      hasMore = false;
    }

    const response: HtmlSourceResponse = {
      content: resultContent,
      totalLength,
      hasMore,
      actualOffset,
      actualLength,
    };

    const code = [
      '// Get HTML source of the current page',
      'await page.content();',
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
      resultOverride: {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      },
    };
  },
});

export default (captureSnapshot: boolean) => [
  getHtmlSource(captureSnapshot),
];