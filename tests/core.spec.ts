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

test('browser_navigate', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Navigate to ${server.HELLO_WORLD}
await page.goto('${server.HELLO_WORLD}');
\`\`\`

- Page URL: ${server.HELLO_WORLD}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- generic [ref=e1]: Hello, world!
\`\`\`
`
  );
});

test('browser_click', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <button>Submit</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Click Submit button
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- button "Submit" [ref=e2]
\`\`\`
`);
});

test('browser_select_option', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <select>
      <option value="foo">Foo</option>
      <option value="bar">Bar</option>
    </select>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      ref: 'e2',
      values: ['bar'],
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Select options [bar] in Select
await page.getByRole('combobox').selectOption(['bar']);
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- combobox [ref=e2]:
  - option "Foo"
  - option "Bar" [selected]
\`\`\`
`);
});

test('browser_select_option (multiple)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <select multiple>
      <option value="foo">Foo</option>
      <option value="bar">Bar</option>
      <option value="baz">Baz</option>
    </select>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      ref: 'e2',
      values: ['bar', 'baz'],
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Select options [bar, baz] in Select
await page.getByRole('listbox').selectOption(['bar', 'baz']);
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- listbox [ref=e2]:
  - option "Foo" [ref=e3]
  - option "Bar" [selected] [ref=e4]
  - option "Baz" [selected] [ref=e5]
\`\`\`
`);
});

test('browser_type', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <input type='keypress' onkeypress="console.log('Key pressed:', event.key, ', Text:', event.target.value)"></input>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });
  await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'Hi!',
      submit: true,
    },
  });
  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveTextContent('[LOG] Key pressed: Enter , Text: Hi!');
});

test('browser_type (slowly)', async ({ client, server }) => {
  server.setContent('/', `
    <input type='text' onkeydown="console.log('Key pressed:', event.key, 'Text:', event.target.value)"></input>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });
  await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'Hi!',
      submit: true,
      slowly: true,
    },
  });
  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveTextContent([
    '[LOG] Key pressed: H Text: ',
    '[LOG] Key pressed: i Text: H',
    '[LOG] Key pressed: ! Text: Hi',
    '[LOG] Key pressed: Enter Text: Hi!',
  ].join('\n'));
});

test('browser_resize', async ({ client, server }) => {
  server.setContent('/', `
    <title>Resize Test</title>
    <body>
      <div id="size">Waiting for resize...</div>
      <script>new ResizeObserver(() => { document.getElementById("size").textContent = \`Window size: \${window.innerWidth}x\${window.innerHeight}\`; }).observe(document.body);
      </script>
    </body>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_resize',
    arguments: {
      width: 390,
      height: 780,
    },
  });
  expect(response).toContainTextContent(`- Ran Playwright code:
\`\`\`js
// Resize browser window to 390x780
await page.setViewportSize({ width: 390, height: 780 });
\`\`\``);
  await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toContainTextContent('Window size: 390x780');
});

test('old locator error message', async ({ client, server }) => {
  server.setContent('/', `
    <button>Button 1</button>
    <button>Button 2</button>
    <script>
      document.querySelector('button').addEventListener('click', () => {
        document.querySelectorAll('button')[1].remove();
      });
    </script>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toContainTextContent(`
  - button "Button 1" [ref=e2]
  - button "Button 2" [ref=e3]
  `.trim());

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button 1',
      ref: 'e2',
    },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button 2',
      ref: 'e3',
    },
  })).toContainTextContent('Ref not found');
});

test('browser_get_html_source', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head><title>Test Page</title></head>
      <body>
        <h1>Test Heading</h1>
        <p>Test paragraph</p>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_html_source',
    arguments: {},
  });

  expect(result).toContainTextContent('Test Heading');
  expect(result).toContainTextContent('Test paragraph');
  expect(result).toContainTextContent('<title>Test Page</title>');
  expect(result).toContainTextContent('"totalLength"');
  expect(result).toContainTextContent('"hasMore"');
});

test('browser_get_html_source with compression', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <h1>Test Heading</h1>
        <p>Test paragraph</p>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_html_source',
    arguments: { compress: true },
  });

  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed.content).not.toContain('\n');
  expect(parsed.content).toContain('Test Heading');
});

test('browser_get_html_source with excludeTags', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <title>Test Page</title>
        <script>console.log('test');</script>
      </head>
      <body>
        <h1>Test Heading</h1>
        <script>alert('popup');</script>
        <p>Test paragraph</p>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_html_source',
    arguments: { excludeTags: ['script'] },
  });

  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed.content).not.toContain('console.log');
  expect(parsed.content).not.toContain('alert');
  expect(parsed.content).toContain('Test Heading');
});

test('browser_get_html_source with maxLength and offset', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head><title>Test Page</title></head>
      <body>
        <h1>This is a very long content that should be split into chunks</h1>
        <p>More content here to make it longer</p>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result1 = await client.callTool({
    name: 'browser_get_html_source',
    arguments: { maxLength: 50 },
  });

  const parsed1 = JSON.parse((result1.content as any)[0].text);
  expect(parsed1.actualLength).toBe(50);
  expect(parsed1.hasMore).toBe(true);
  expect(parsed1.actualOffset).toBe(0);

  const result2 = await client.callTool({
    name: 'browser_get_html_source',
    arguments: { offset: 50, maxLength: 50 },
  });

  const parsed2 = JSON.parse((result2.content as any)[0].text);
  expect(parsed2.actualOffset).toBe(50);
  expect(parsed2.actualLength).toBe(50);
});

test('browser_get_html_source with preset minimal', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <title>Test Page</title>
        <script>console.log('test');</script>
        <style>body { color: red; }</style>
      </head>
      <body>
        <h1>Test Heading</h1>
        <p>Test paragraph</p>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_html_source',
    arguments: { preset: 'minimal' },
  });

  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed.content).not.toContain('console.log');
  expect(parsed.content).not.toContain('color: red');
  expect(parsed.content).not.toContain('\n');
  expect(parsed.content).toContain('Test Heading');
});

test('browser_get_html_source with headOnly', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head><title>Test Page</title></head>
      <body>
        <h1>Test Heading</h1>
        <p>Test paragraph</p>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_html_source',
    arguments: { headOnly: true },
  });

  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed.content).toContain('<title>Test Page</title>');
  expect(parsed.content).not.toContain('Test Heading');
  expect(parsed.content).not.toContain('Test paragraph');
});

test('browser_get_html_source with selector', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head><title>Test Page</title></head>
      <body>
        <h1 class="main-title">Test Heading</h1>
        <p>Test paragraph</p>
        <div class="content">Target content</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_html_source',
    arguments: { selector: '.content' },
  });

  const parsed = JSON.parse((result.content as any)[0].text);
  expect(parsed.content).toContain('Target content');
  expect(parsed.content).not.toContain('Test Heading');
  expect(parsed.content).not.toContain('Test paragraph');
});
