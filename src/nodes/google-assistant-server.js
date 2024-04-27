module.exports = function(RED) {
	function Server(config) {
		RED.nodes.createNode(this, config);
		const settings = RED.nodes.getNode(config.settings);
		this.isAuth = function(auth) {
			if (!this.credentials.username || !this.credentials.password)
				return true;
			if (!auth || auth.indexOf('Basic ') !== 0)
				return false;
			const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString('utf-8');
			const [ username, password ] = credentials.split(':');
			return (username === this.credentials.username && password === this.credentials.password);
		}
		this.on('close', async (removed, done) => {
            RED.httpAdmin._router.stack.forEach((layer, i, stack) => {
                if (layer?.route?.path === config.url)
                    stack.splice(i, 1);
            });
			done();
		});
		RED.httpAdmin.get(config.url, (req, res) => {
			if (!this.isAuth(req.headers['authorization'])) {
				res.set('WWW-Authenticate', 'Basic realm="restricted"');
				return res.status(401).end();
			}
			const host = req.get('host') || req.hostname;
			const msg = {
				ip: req.ip,
				url: `${req.protocol}://${host}${req.originalUrl}`,
				request: req.query[config.arg],
				format: req.query.format || 'text'
			};
			settings.getClient().then(client => client.send(msg.request, msg.format))
			.then(({ payload, request }) => {
				msg.result = { request, payload };
			})
			.catch(({ message, code }) => {
				msg.error = { message, code };
			})
			.then(() => {
				this.send(msg);
				if (msg.format === 'json')
					res.send({
						result: msg.result,
						error: msg.error
					});
				else
					res.send(msg.result?.payload || msg.error?.message);
			});
		});
	}
	RED.nodes.registerType('google-assistant-server', Server, {
		credentials: {
			username: { type: 'text' },
			password: { type: 'password' }
		}
	});
}

