#!/usr/bin/env node

import GoogleAssistantApi from 'google-assistant';

export class GoogleAssistant {
	constructor(credentials) {
		this.client = new GoogleAssistantApi(credentials);
		this.ready = new Promise(res => this.client.on('ready', () => res()));
		this.client.on('started', conversation => {
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
		});
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
	send(request, format = 'text') {
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
}

export default GoogleAssistant;
