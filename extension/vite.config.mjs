import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	build: {
		emptyOutDir: true,
		outDir: '../dist/extension/',
		rollupOptions: {
			output: {
				globals: {
					vue: 'Vue',
					vuex: 'vuex'
				}
			}
		}
	},
	plugins: [
		vue(),
		viteStaticCopy({
			targets: [{
				src: resolve(__dirname, 'manifest.json'),
				dest: './'
			}, {
				src: resolve(__dirname, 'background.js'),
				dest: './'
			}, {
				src: resolve(__dirname, '../nodes/icons/google-assistant.png'),
				dest: './'
			}]
		})
	]
});
