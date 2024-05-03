module.exports = async function(RED) {
	let nodeId;
	const { GoogleAssistant } = await import('../index.mjs');
	function Config(config) {
		RED.nodes.createNode(this, config);
		this.getClient = async function() {
			const client = new GoogleAssistant({
				credentials: this.credentials
			});
			client.config.oauth2Client.on('tokens', tokens => {
				console.log('on:tokens', {
					...this.config.oauth2Client.credentials,
					...tokens
				});
				RED.nodes.addCredentials(this.id, {
					...this.config.oauth2Client.credentials,
					...tokens
				});
			});
			return client;
		}
		console.log('config', config, this.credentials);
	}
	RED.nodes.registerType('google-assistant-config', Config, {
		credentials: {
			client_id: { type: 'text' },
			client_secret: { type: 'password' },
			redirect_url: { type: 'text' },
			refresh_token: { type: 'password' },
			access_token: { type: 'password' },
			expiry_date: { type: 'text' }
		}
	});
	RED.httpAdmin.get('/google-assistant/auth', function(req, res) {
		if (!req.query.id || !req.query.client_id || !req.query.client_secret || !req.query.redirect_url)
			return res.status(400).send({
				code: 'GoogleAssistant.error.noparams',
				message: 'missing parameters'
			});
		nodeId = req.query.id;
		const credentials = {
			client_id: req.query.client_id,
			client_secret: req.query.client_secret,
			redirect_url: req.query.redirect_url
		};
		const client = new GoogleAssistant({ credentials });
		RED.nodes.addCredentials(nodeId, credentials);
		res.redirect(client.generateAuthUrl());
	});
	RED.httpAdmin.get('/google-assistant/callback', function(req, res) {
		if (!nodeId || !req.query.code)
			return res.status(401).send({
				code: 'GoogleAssistant.error.noparams',
				message: 'missing parameters'
			});
		const credentials = RED.nodes.getCredentials(nodeId);
		if (!credentials || !credentials.client_id || !credentials.client_secret)
			return res.status(401).send({
				code: 'GoogleAssistant.error.no-credentials',
				message: 'The node is not retreivable or there is no credentials for it'
			});
		const client = new GoogleAssistant({ credentials });
		client.config.oauth2Client.getToken(req.query.code, (error, tokens) => {
			if (error) {
				nodeId = null;
				return res.status(401).send({
					code: 'GoogleAssistant.error.api-error',
					message: error.response.data
				});
			}else{
				if (tokens.refresh_token)
					credentials.refresh_token = tokens.refresh_token;
				if (tokens.access_token)
					credentials.access_token = tokens.access_token;
				if (tokens.expiry_date)
					credentials.expiry_date = tokens.expiry_date;
				RED.nodes.addCredentials(nodeId, credentials);
				client.config.oauth2Client.setCredentials(tokens);
				nodeId = null;
				res.send('<script>window.setTimeout(window.close,5000);</script> Authorized ! The page will automatically close in 5s.');
			}
		});
	});
}
