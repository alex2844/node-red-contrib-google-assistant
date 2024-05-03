import App from './App.vue';
import { createApp } from 'vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

const vuetify = createVuetify({
	components, directives,
	theme: {
		defaultTheme: 'dark'
	}
});

const app = createApp(App);
app.use(vuetify);
app.mount('#app');
