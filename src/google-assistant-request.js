module.exports = RED => {
	function Request(config) {
		RED.nodes.createNode(this, config);
		const settings = RED.nodes.getNode(config.settings);
		this.on('input', msg => {
			const request = RED.util.evaluateNodeProperty(config.request, config.requestType, this, msg);
			const topic = RED.util.evaluateNodeProperty(config.topic, config.topicType, this, msg);
			settings.getClient().then(client => client.send(request))
			.then(({ payload, request }) => this.send({
				...(topic && { topic }),
				...(request && { request }),
				payload
			}))
			.catch(({ message, code }) => this.error(message, { code }));
		});
	}
	RED.nodes.registerType('google-assistant-request', Request);
}
