import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	root: 'src/extension',
	build: {
		emptyOutDir: true,
		outDir: '../../dist/',
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
				src: resolve(__dirname, 'src/extension/manifest.json'),
				dest: './'
			}, {
				src: resolve(__dirname, 'src/extension/background.js'),
				dest: './'
			}, {
				src: resolve(__dirname, 'src/nodes/icons/google-assistant.png'),
				dest: './'
			}]
		})
	]
});
