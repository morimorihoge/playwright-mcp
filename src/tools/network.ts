/**
 * Copyright (c) Microsoft Corporation.
 *
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
import { defineTool } from './tool.js';

import type * as playwright from 'playwright';

const requests = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async context => {
    const requests = context.currentTabOrDie().requests();
    const log = [...requests.entries()].map(([request, response]) => renderRequest(request, response)).join('\n');
    return {
      code: [`// <internal code to list network requests>`],
      action: async () => {
        return {
          content: [{ type: 'text', text: log }]
        };
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

function renderRequest(request: playwright.Request, response: playwright.Response | null) {
  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response)
    result.push(`=> [${response.status()}] ${response.statusText()}`);
  return result.join(' ');
}

const getRequestInfo = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_get_request_info',
    title: 'Get request info for current page',
    description: 'Returns HTTP request information needed to recreate the current page request with curl',
    inputSchema: z.object({
      reload: z.boolean().optional().describe('Reload the page before getting request info'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    const page = tab.page;
    
    let requestInfo: any = {};
    
    // Set up request listener
    const captureRequest = (request: playwright.Request) => {
      // Only capture main document requests
      if (request.resourceType() === 'document') {
        requestInfo = {
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData() || null,
        };
      }
    };
    
    // Start listening for requests
    page.on('request', captureRequest);
    
    try {
      if (params.reload) {
        // Reload the page to capture fresh request info
        await page.reload({ waitUntil: 'domcontentloaded' });
      } else {
        // Get current page info without reload
        requestInfo = {
          url: page.url(),
          method: 'GET', // Default for navigated pages
          headers: {},
          postData: null,
        };
      }
      
      // Get cookies
      const cookies = await page.context().cookies();
      const cookiesForCurrentPage = cookies.filter(cookie => {
        const url = new URL(requestInfo.url || page.url());
        const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
        return url.hostname.endsWith(cookieDomain.slice(1)) || url.hostname === cookie.domain;
      });
      
      // Build response
      const response: any = {
        url: requestInfo.url || page.url(),
        method: requestInfo.method || 'GET',
        headers: requestInfo.headers || {},
        cookies: cookiesForCurrentPage.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
        })),
        timestamp: new Date().toISOString(),
      };
      
      // Add cookie header if not present
      if (cookiesForCurrentPage.length > 0 && !response.headers['cookie']) {
        response.headers['Cookie'] = cookiesForCurrentPage
          .map(c => `${c.name}=${c.value}`)
          .join('; ');
      }
      
      // Add POST data if present
      if (requestInfo.postData) {
        response.postData = {
          contentType: requestInfo.headers['content-type'] || 'application/x-www-form-urlencoded',
          params: parsePostData(requestInfo.postData, requestInfo.headers['content-type']),
        };
      }
      
      // Generate curl command
      response.curlCommand = generateCurlCommand(response);
      
      return {
        code: [`// <internal code to get request info>`],
        action: async () => {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify(response, null, 2)
            }]
          };
        },
        captureSnapshot: false,
        waitForNetwork: false,
      };
    } finally {
      // Clean up listener
      page.off('request', captureRequest);
    }
  },
});

function parsePostData(postData: string, contentType?: string): Array<{name: string, value: string}> {
  if (!contentType || contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(postData);
    return Array.from(params.entries()).map(([name, value]) => ({ name, value }));
  }
  // For other content types, return raw data
  return [{ name: 'raw', value: postData }];
}

function generateCurlCommand(info: any): string {
  const parts = ['curl'];
  
  // Method
  if (info.method !== 'GET') {
    parts.push('-X', info.method);
  }
  
  // URL
  parts.push(`'${info.url}'`);
  
  // Headers
  const skipHeaders = ['cookie', 'content-length'];
  Object.entries(info.headers).forEach(([key, value]) => {
    if (!skipHeaders.includes(key.toLowerCase())) {
      parts.push('-H', `'${key}: ${value}'`);
    }
  });
  
  // Cookies
  if (info.cookies.length > 0) {
    const cookieString = info.cookies
      .map((c: any) => `${c.name}=${c.value}`)
      .join('; ');
    parts.push('-H', `'Cookie: ${cookieString}'`);
  }
  
  // POST data
  if (info.postData) {
    if (info.postData.params[0].name === 'raw') {
      parts.push('-d', `'${info.postData.params[0].value}'`);
    } else {
      const dataString = info.postData.params
        .map((p: any) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value)}`)
        .join('&');
      parts.push('-d', `'${dataString}'`);
    }
  }
  
  return parts.join(' ');
}

export default [
  requests,
  getRequestInfo,
];
