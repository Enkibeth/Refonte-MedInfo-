import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Expo 56 declares Zod 3, but its two DevTools consumers use APIs shared with
// Zod 4. Exercise those actual consumers before allowing the security override.
const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve('expo/package.json'));
const cliPackage = expoRequire.resolve('@expo/cli/package.json');
const cliRequire = createRequire(cliPackage);
const serverDir = path.join(path.dirname(cliPackage), 'build/src/start/server');
const { PluginSchema, DevToolsPluginOutputSchema } = require(path.join(serverDir, 'DevToolsPlugin.schema.js'));
const { createMCPDevToolsExtensionSchema } = require(path.join(serverDir, 'createMCPDevToolsExtensionSchema.js'));

const plugin = {
  packageName: 'medinfo-test-plugin',
  packageRoot: '/tmp/medinfo-test-plugin',
  cliExtensions: {
    description: 'Compatibility fixture',
    entryPoint: 'cli.js',
    commands: [{
      name: 'inspect', title: 'Inspect', environments: ['cli', 'mcp'],
      parameters: [
        { name: 'query', type: 'text' },
        { name: 'count', type: 'number' },
        { name: 'confirm', type: 'confirm' },
      ],
    }],
  },
};

describe('Expo CLI with patched Zod', () => {
  it('uses the application Zod and preserves plugin descriptor validation', () => {
    expect(cliRequire('zod')).toBe(require('zod'));
    expect(PluginSchema.safeParse(plugin).success).toBe(true);
    expect(PluginSchema.safeParse({ ...plugin, packageName: '' }).success).toBe(false);
    expect(PluginSchema.safeParse({ ...plugin, cliExtensions: { ...plugin.cliExtensions, commands: [] } }).success).toBe(false);
  });

  it('builds an MCP schema that validates commands, parameters and JSON schema output', () => {
    const schema = createMCPDevToolsExtensionSchema(plugin);
    expect(schema.safeParse({ command: 'inspect', query: 'heart', count: 2, confirm: true }).success).toBe(true);
    for (const input of [
      { command: 'unknown' }, { command: 'inspect', count: '2' },
      { command: 'inspect', confirm: 'yes' }, { command: 'inspect', extra: true },
    ]) expect(schema.safeParse(input).success).toBe(false);
    expect(z.toJSONSchema(schema)).toMatchObject({ type: 'object', additionalProperties: false, required: ['command'] });
  });

  it('accepts supported DevTools outputs and rejects malformed output', () => {
    expect(DevToolsPluginOutputSchema.safeParse([
      { type: 'text', text: 'ok', level: 'info' },
      { type: 'image', url: 'https://example.com/image.png' },
      { type: 'audio', url: 'https://example.com/audio.mp3' },
    ]).success).toBe(true);
    expect(DevToolsPluginOutputSchema.safeParse([{ type: 'text', text: 'ok', level: 'unknown' }]).success).toBe(false);
    expect(DevToolsPluginOutputSchema.safeParse([{ type: 'image', url: 'invalid' }]).success).toBe(false);
  });
});
