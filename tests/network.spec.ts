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

import { test, expect } from './fixtures.js';

test('browser_network_requests', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/json')">Click me</button>
  `, 'text/html');

  server.setContent('/json', JSON.stringify({ name: 'John Doe' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me button',
      ref: 'e2',
    },
  });

  await expect.poll(() => client.callTool({
    name: 'browser_network_requests',
  })).toHaveTextContent(`[GET] ${`${server.PREFIX}`} => [200] OK
[GET] ${`${server.PREFIX}json`} => [200] OK`);
});

test('browser_get_request_info - GET request', async ({ client, server }) => {
  server.setContent('/', `
    <h1>Test Page</h1>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  const response = await client.callTool({
    name: 'browser_get_request_info',
    arguments: {},
  });


  const result = JSON.parse(response.content[0].text);
  expect(result.url).toBe(server.PREFIX);
  expect(result.method).toBe('GET');
  expect(result.timestamp).toBeTruthy();
  expect(result.curlCommand).toContain('curl');
  expect(result.curlCommand).toContain(server.PREFIX);
});

test('browser_get_request_info - with cookies', async ({ client, server }) => {
  // First navigate to set domain
  server.setContent('/', `<h1>Test Page</h1>`, 'text/html');
  
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Now set cookies via JavaScript
  server.setContent('/set-cookies', `
    <h1>Cookie Test</h1>
    <script>
      document.cookie = "session_id=abc123; path=/";
      document.cookie = "user_pref=dark; path=/";
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `${server.PREFIX}set-cookies`,
    },
  });

  // Wait for cookies to be set reliably
  await expect.poll(async () => {
    const response = await client.callTool({
      name: 'browser_get_request_info',
      arguments: {},
    });
    const result = JSON.parse(response.content[0].text);
    return result.cookies.length > 0;
  }).toBe(true);

  const response = await client.callTool({
    name: 'browser_get_request_info',
    arguments: {},
  });

  const result = JSON.parse(response.content[0].text);
  expect(result.cookies.length).toBeGreaterThan(0);
  expect(result.curlCommand).toContain('-H \'Cookie:');
  expect(result.curlCommand).toContain('session_id=abc123');
});

test('browser_get_request_info - reload option', async ({ client, server }) => {
  server.setContent('/', `
    <h1>Test Page</h1>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  const response = await client.callTool({
    name: 'browser_get_request_info',
    arguments: {
      reload: true,
    },
  });

  const result = JSON.parse(response.content[0].text);
  expect(result.url).toBe(server.PREFIX);
  expect(result.method).toBe('GET');
  expect(result.headers).toBeDefined();
});
