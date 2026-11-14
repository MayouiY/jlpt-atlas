import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 静态站点：数据库文件 data/jlpt-atlas.db 作为资源被前端用 sql.js 直接加载。
export default defineConfig({
  base: './',
  plugins: [react()],
  assetsInclude: ['**/*.db'],
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
