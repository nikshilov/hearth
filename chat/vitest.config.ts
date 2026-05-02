import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  plugins: [
    {
      name: 'md-as-text',
      transform(code, id) {
        if (!id.endsWith('.md')) return null;
        return {
          code: `export default ${JSON.stringify(code)};`,
          map: null,
        };
      },
    },
  ],
});
