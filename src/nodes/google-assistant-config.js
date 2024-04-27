module.exports = async function(RED) {
	const { GoogleAssistant } = await import('../index.mjs');
	function Config(config) {
		RED.nodes.createNode(this, config);
		this.getClient = async function() {
			return new GoogleAssistant(this.credentials);
		}
	}
	RED.nodes.registerType('google-assistant-config', Config, {
		credentials: {
			keyFilePath: { type: 'text' },
			savedTokensPath: { type: 'text' }
		}
	});
}
