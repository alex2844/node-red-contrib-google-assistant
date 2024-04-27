module.exports = function(RED) {
	function Request(config) {
		RED.nodes.createNode(this, config);
		const settings = RED.nodes.getNode(config.settings);
		this.on('input', msg => {
			const request = RED.util.evaluateNodeProperty(config.request, config.requestType, this, msg);
			const topic = RED.util.evaluateNodeProperty(config.topic, config.topicType, this, msg);
			const format = RED.util.evaluateNodeProperty(config.format, config.formatType, this, msg);
			settings.getClient().then(client => client.send(request, format))
			.then(({ payload, request }) => {
				msg.topic = topic;
				msg.request = request;
				if (format === 'json')
					msg.payload = { topic, request, payload };
				else
					msg.payload = payload;
				this.send(msg);
			})
			.catch(({ message, code }) => {
				msg.code = code;
				if (format === 'json')
					msg.payload = {
						error: { message, code }
					};
				else
					msg.payload = message;
				this.error(message, msg);
			});
		});
	}
	RED.nodes.registerType('google-assistant-request', Request);
}
