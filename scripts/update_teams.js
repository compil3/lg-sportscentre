const fs = require('fs');
const request = require('request');
const url = require('url');

const dir = __dirname.replace(/\/scripts\/?$/, '');
const leagues = require(`${dir}/data/leagues.json`);
const path = `${dir}/data/teams.json`;
let ids = Object.keys(leagues), size = Math.ceil(ids.length / 2), teams = {};

function updateTeams() {
	Promise.all(
		ids.splice(0, size).map(id => {
			return new Promise(resolve => {
				let league = leagues[id];
				let regex0 = new RegExp(`<div(?:[^>]+)?class="team_box_icon"(?:[^>]+)?>.*?<a(?:[^>]+)?page=team_page&(?:amp;)?teamid=(\\d+)&(?:amp;)?leagueid=${league.id}&(?:amp;)?seasonid=${league.season}(?:[^>]+)?>(.*?)</a></div>`, 'ig');
				let regex1 = new RegExp(`<td(?:[^>]+)?><img(?:[^>]+)?/team\\d+.png(?:[^>]+)?> \\d+\\) <a(?:[^>]+)?page=team_page&(?:amp;)?teamid=(\\d+)&(?:amp;)?leagueid=${league.id}&(?:amp;)?seasonid=${league.season}(?:[^>]+)?>(.*?)</a></td>`, 'ig');
	
				request(`http://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=standing&leagueid=${id}&seasonid=${league.season}`, (err, res, html) => {
					if (!err) {
						if (res.statusCode != 200)
							err = new Error(`Failed to fetch team list for ${league.name} (status=${res.statusCode})`);
						else if (!/^text\/html/.test(res.headers['content-type']))
							err = new Error(`Failed to fetch team list for ${league.name} (content-type=${res.headers['content-type']})`);
					}
	
					if (err) {
						console.error(err.message);
						return resolve();
					}
	
					html = html.replace(/>\s+</g, '><');
					let data;
	
					if (data = html.match(regex0)) {
						for (let i = 0, end = data.length; i < end; i++) {
							let [a, link, name] = data[i].match(/<a(?:[^>]+)?href="(.*?)"(?:[^>]+)?>(.*?)<\/a>/);
							link = url.parse(link, true).query;
	
							let id = parseInt(link.teamid);
							teams[id] = teams[id] || {id: id, leagues: [], name: name.trim(), shortname: null};
							teams[id].leagues.push(parseInt(link.leagueid));
						}
	
						if (data = html.match(regex1)) {
							for (let i = 0, end = data.length; i < end; i++) {
								let [a, link, name] = data[i].match(/<a(?:[^>]+)?href="(.*?)"(?:[^>]+)?>(.*?)<\/a>/);
								link = url.parse(link, true).query;
		
								let id = parseInt(link.teamid);
		
								if (teams[id]) {
									teams[id].shortname = teams[id].shortname || name.trim();
									teams[id].leagues.push(parseInt(link.leagueid));
								}
							}
						}
					}
	
					resolve();
				});
			});
		})
	).then(() => {
		if (ids.length)
			return updateTeams();

		fs.readFile(path, 'utf8', (err, json) => {
			if (err) {
				console.error(err.message);
				process.exit();
			}

			Object.keys(teams).forEach(id => {
				teams[id].leagues = teams[id].leagues.filter((v, i, a) => {return a.indexOf(v)==i}).sort();
			});

			var data = JSON.stringify(teams);

			if (json == data)
				process.exit();

			fs.writeFile(path, data, err => {
				if (err)
					console.error(err.message);

				process.exit();
			});
		});
	});
}

fs.stat(path, err => {
	if (err)
		fs.writeFile(path, '{}', updateTeams);
	else
		updateTeams();
});