<template>
	<v-app>
		<v-main class="overflow-hidden">
			<v-dialog v-model="config.isShow" :persistent="!config.url">
				<template v-slot:activator="{ props: activatorProps }">
					<v-fab icon="mdi-cog" location="top end" absolute app appear v-bind="activatorProps" :active="!config.isShow"></v-fab>
				</template>
				<v-confirm-edit cancel-text="close" ok-text="save" v-model="config" @cancel="config.isShow = false" @save="settingsSave">
					<template v-slot:default="{ model, actions }">
						<v-card prepend-icon="mdi-cog" title="Настройки">
							<template v-slot:text>
								<v-list-subheader>API</v-list-subheader>
								<v-text-field v-model="model.value.url" :rules="rules.url" label="Url"></v-text-field>
								<v-text-field v-model="model.value.arg" label="Argument"></v-text-field>
								<v-list-subheader>API Authentication</v-list-subheader>
								<v-text-field
									v-model="model.value.username"
									:error="!model.value.username !== !model.value.password"
									label="Username"
								></v-text-field>
								<v-text-field
									v-model="model.value.password"
									:error="!model.value.username !== !model.value.password"
									type="password"
									label="Password"
								></v-text-field>
							</template>
							<template v-slot:actions>
								<v-spacer></v-spacer>
								<v-btn
									v-for="({ props }) in actions.children"
									v-bind="props"
									:disabled="isPristine({ props, model, rules, persistent: !config.url })"
								/>
							</template>
						</v-card>
					</template>
				</v-confirm-edit>
			</v-dialog>
			<v-dialog v-model="assistant.isLoading" max-width="32" persistent>
				<v-progress-circular indeterminate></v-progress-circular>
			</v-dialog>
			<iframe
				ref="google_assistant"
				v-if="assistant.url"
				:src="assistant.url"
				:style="{ visibility: assistant.isLoading ? 'hidden' : 'visible' }"
				width="100%"
				height="100%"
				frameborder="0"
				@load="handleIframeLoad"
				@error="handleIframeLoad"
			></iframe>
			<v-form v-if="config.url" @submit.prevent="submitCommand" class="position-fixed v-form w-100" style="bottom:0">
				<v-text-field
					ref="assistant"
					v-model="assistant.query"
					variant="underlined"
					clearable
					@click:append="submitCommand"
					:append-icon="assistant.query ? 'mdi-send' : 'mdi-microphone'"
					:class="[ 'ml-6', 'mr-4', { 'text-green-accent-3': assistant.mic } ]"
					autofocus
				>
				</v-text-field>
			</v-form>
		</v-main>
	</v-app>
</template>
<script>
import { VFab } from 'vuetify/labs/VFab';
import { VConfirmEdit } from 'vuetify/labs/VConfirmEdit';
export default {
	components: { VFab, VConfirmEdit },
	data() {
		return {
			assistant: {
				isLoading: false,
				mic: null,
				query: null,
				url: null,
			},
			config: {
				isShow: false,
				url: '',
				arg: 'request',
				username: '',
				password: ''
			},
			rules: {
				url: [
					v => !!v || 'URL API обязателен к заполнению',
					v => {
						try {
							const url = new URL(v);
							if (url.href === v)
								return true;
						} catch (error) {}
						return 'Неверный формат URL';
					}
				]
			}
		}
	},
	mounted() {
		window.addEventListener('message', this.handleMessageFromIframe);
		chrome.storage.local.get([ 'url', 'arg', 'username', 'password' ], ({ url, arg, username, password }) => {
			this.config.url = url || '';
			this.config.arg = arg || '';
			this.config.username = username || '';
			this.config.password = password || '';
			if (!this.config.url)
				this.config.isShow = true;
		});
	},
	unmounted() {
		window.removeEventListener('message', this.handleMessageFromIframe);
	},
	methods: {
		isValid(value, rules) {
			return rules.every(rule => rule(value) === true);
		},
		isPristine({ props, model, rules, persistent }) {
			if (props.text === 'close')
				return persistent === true;
			if (props.disabled)
				return true;
			if (model && rules)
				return Object.entries(rules).every(([ key, rules ]) => {
					return (this.isValid((model.value?.[key] || model[key]), rules) === false);
				});
			return false;
		},
		testVoices() {
			return chrome.tts.getVoices(voices => {
				const voicesLang = voices.filter(voice => voice.lang.includes(navigator.language));
				(function loop(i) {
					const voice = voicesLang[i];
					if (voice)
						chrome.tts.speak('Привет, как дела? что нового?', {
							voiceName: voice.voiceName,
							onEvent: function(event) {
								if (event.type === 'start')
									console.log(i, voicesLang.length, voice.voiceName);
								if (event.type === 'end')
									loop(++i);
							}
						});
				})(0);
			});
		},
		settingsSave() {
			chrome.runtime.sendMessage({
				...this.config,
				action: 'save'
			}, () => {
				this.assistant.url = null;
				this.config.isShow = false;
			});
		},
		submitCommand() {
			if (this.assistant.query) {
				const url = new URL(this.config.url);
				url.searchParams.set('format', 'screen');
				url.searchParams.set('extensionId', chrome.runtime.id);
				url.searchParams.set(this.config.arg, this.assistant.query);
				this.assistant.url = url.toString();
				this.assistant.query = null;
				this.assistant.isLoading = true;
			}else{
				// return this.testVoices();
				if (this.assistant.mic)
					this.assistant.mic.stop();
				else{
					this.assistant.mic = new webkitSpeechRecognition() || new SpeechRecognition();
					this.assistant.mic.lang = navigator.language;
					this.assistant.mic.onresult = event => {
						this.assistant.query = event.results[0][0].transcript;
						this.submitCommand();
					}
					this.assistant.mic.onend = event => {
						this.assistant.mic = null;
					}
					this.assistant.mic.start();
				}
			}
		},
		handleIframeLoad(event) {
			this.assistant.isLoading = false;
		},
		handleMessageFromIframe(event) {
			if (event.source === this.$refs.google_assistant.contentWindow) {
				const msg = event.data;
				if (msg.query) {
					this.assistant.query = msg.query.queryText;
					this.submitCommand();
				}else if (msg.event?.cardHide)
					window.close();
			}
		}
	}
}
</script>
