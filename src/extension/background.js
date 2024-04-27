let tabId = null;

function main() {
	if (tabId)
		chrome.tabs.remove(tabId, () => {
			tabId = null;
			main();
		});
	else
		chrome.tabs.create({
			url: chrome.runtime.getURL('index.html')
		}).then(({ id }) => tabId = id);
}

chrome.commands.onCommand.addListener(command => {
	if (command === 'open_extension_window')
		main();
});

chrome.action.onClicked.addListener(tab => main());

chrome.tabs.onRemoved.addListener((id, removeInfo) => {
	if (tabId === id)
		tabId = null;
});

chrome.runtime.onMessage.addListener((msg, sender, send) => {
	if (msg.action === 'save') {
		const { url, arg, username, password } = msg;
		chrome.storage.local.set({ url, arg, username, password }, () => {
			chrome.declarativeNetRequest.getDynamicRules(null, rules => {
				chrome.declarativeNetRequest.updateDynamicRules({
					removeRuleIds: rules.map(rule => rule.id)
				}, () => {
					if (!username || !password)
						send(msg);
					else
						chrome.declarativeNetRequest.updateDynamicRules({
							addRules: [{
								id: 1,
								priority: 1,
								action: {
									type: 'modifyHeaders',
									requestHeaders: [{
										header: 'Authorization',
										operation: 'set',
										value: 'Basic '+btoa(username+':'+password)
									}]
								},
								condition: {
									urlFilter: `${url}*extensionId=${chrome.runtime.id}*`,
									resourceTypes: [ 'main_frame', 'sub_frame' ]
								}
							}]
						}, () => send(msg));
				});
			});
		});
		return true;
	}
});
