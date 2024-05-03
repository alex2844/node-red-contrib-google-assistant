#!/usr/bin/env node

import GoogleAssistantApi from 'google-assistant';
import { OAuth2Client } from 'google-auth-library';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import readline from 'readline';
import open from 'open';

export class GoogleAssistant {
	constructor(config) {
		if (process.platform === 'linux')
			this.app = { name: 'x-www-browser' };
		this.config = config;
		if (!config.credentials || (Object.keys(config.credentials).length === 0)) {
			config.credentials = {};
			if (!config.savedTokensPath)
				config.savedTokensPath = resolve(import.meta.dirname, 'google-assistant-tokens.json');
		}
		if (!config.credentials.client_id || !config.credentials.client_secret || !config.credentials.redirect_url) {
			const keyData = this.parseFile(config.keyFilePath);
			if (!keyData)
				throw new Error('Missing "keyFilePath" from config (should be where your JSON file is)');
			const key = keyData.installed || keyData.web;
			if (!config.credentials.client_id)
				config.credentials.client_id = key.client_id;
			if (!config.credentials.client_secret)
				config.credentials.client_secret = key.client_secret;
			if (!config.redirect_url)
				config.credentials.redirect_url = key.redirect_uris[0];
		}
		config.oauth2Client = new OAuth2Client(config.credentials.client_id, config.credentials.client_secret, config.credentials.redirect_url);
		if (config.savedTokensPath)
			config.oauth2Client.on('tokens', tokens => {
				console.log('### tokens', tokens);
				writeFileSync(this.config.savedTokensPath, JSON.stringify({
					...this.config.oauth2Client.credentials,
					...tokens
				}));
			});
		this.client = new GoogleAssistantApi(config);
		this.client.on('started', conversation => this.startConversation(conversation));
		this.ready = new Promise(res => this.client.on('ready', () => res()));
	};
	startConversation(conversation) {
		conversation
		.on('response', text => {
			if (text)
				this.response.payload = text;
		})
		.on('screen-data', screen => {
			const data = screen.data.toString();
			if (this.format === 'screen')
				this.response.payload = data;
			else{
				const html = this.parseHtml(data);
				if (this.format === 'html')
					this.response.payload = html;
				else{
					if (!this.response.payload)
						this.response.payload = this.parseText(html);
					this.response.request = this.parseRequest(html);
				}
			}
		})
		.on('ended', (error, continueConversation) => {
			if (error) {
				this.response.error = error;
				this.done.reject(error);
			}else
				this.done.resolve(this.response);
		});
	};
	generateAuthUrl() {
		return this.config.oauth2Client.generateAuthUrl({
			prompt: 'consent',
			access_type: 'offline',
			scope: [ 'https://www.googleapis.com/auth/assistant-sdk-prototype' ]
		});
	};
	async auth() {
		if (this.config.savedTokensPath) {
			const tokens = this.parseFile(this.config.savedTokensPath);
			if (tokens) {
				this.config.oauth2Client.setCredentials(tokens);
				return tokens;
			}
		}else if (this.config.credentials.access_token) {
			this.config.oauth2Client.setCredentials(this.config.credentials);
			return this.config.credentials;
		}
		console.log('### auth');
		return new Promise(res => {
			const url = this.generateAuthUrl();
			if (this.config.tokenInput)
				return this.config.tokenInput(url, res);
			else
				return this.tokenInput(url, res);
		}).then(oauthCode => {
			if (!oauthCode)
				return process.exit(-1);
			try {
				oauthCode = new URL(oauthCode).searchParams.get('code');
			} catch (error) {}
			return new Promise((res, rej) => {
				return this.config.oauth2Client.getToken(oauthCode, (error, tokens) => {
					if (error) {
						rej(error);
						console.error('Error getting tokens:', error.response.data);
						return process.exit(-1);
					}else{
						this.config.oauth2Client.setCredentials(tokens);
						res(tokens);
					}
				});
			});
		});
	};
	openBrowser(url) {
		return open(url, {
			app: this.app
		}).then(proc => new Promise((res, rej) => {
			proc.on('exit', code => res({ code, proc })).on('error', err => {
				if (this.app) {
					delete this.app;
					return this.openBrowser(url);
				}
				return rej({ err, proc });
			});
		}));
	};
	tokenInput(url, done) {
		this.openBrowser(url).catch(() => {
			console.log('Failed to automatically open the URL. Copy/paste this in your browser:\n', url);
		});
		process.nextTick(() => {
			const r = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
				terminal: false
			});
			r.question('Paste your code: ', code => {
				r.close();
				return done(code);
			});
		});
	};
	parseFile(path) {
		if (path && existsSync(path))
			try {
				return JSON.parse(readFileSync(path));
			} catch (error) {}
		return null;
	};
	parseHtml(data) {
		return (
			data
			.replace(/ style=".*?"/g, '')
			.replace(/<svg.*?<\/svg>/gs, '')
			.replace(/<img .*?>/gs, '')
			.replace(/<style.*?<\/style>/gsi, '')
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gsi, '')
			.replace(/<div class="scroll-bar">.*?<\/div>/gsi, '')
			.replace(/<div>\s+<\/div>/g, '')
			.replace(/>(\s+)</g, '>\n$1<')
		);
	};
	parseText(html) {
		if (html.indexOf('<div class="popout-content" id="assistant-card-content">') > -1)
			return (
				html
				.split('<div class="popout-content" id="assistant-card-content">')[1]
				.split('<div class="popout-overflow-shadow-down">')[0]
				.replace(/(\<(\/?[^>]+)>)/g, '').trim()
			);
		return null;
	};
	parseRequest(html) {
		if (html.indexOf('<div id="assistant-scroll-bar">') > -1)
			return (
				html
				.split('<div id="assistant-scroll-bar">')[1]
				.split('</div>')[0]
				.replace(/<button.*?>(.*?)<\/button>/g, '$1,').trim().split(',').slice(0, -1)
			);
	};
	async send(request, format = 'text') {
		if (!this.config.oauth2Client.credentials.access_token)
			await this.auth();
		this.format = format;
		this.response = {};
		this.request = request;
		if (!request)
			return Promise.reject({
				message: '"request" is not allowed to be empty',
				code: 404
			});
		return this.ready.then(() => {
			return new Promise((resolve, reject) => {
				this.done = {
					resolve: (...args) => resolve(...args),
					reject: (...args) => reject(...args)
				};
				this.client.start({
					screen: { isOn: true },
					textQuery: request
				});
			});
		});
	};
};

export default GoogleAssistant;
