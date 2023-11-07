const { req } = require('./httpPromise.js');
// Wrap request
const Fetch = async (url, config) => {
    config = config || {}
    console.warn({url, config});
    const response = await fetch(url, config);
    return { status: response.status, text: () => response.text() };
};

const serverAddr = { protocol: 'http:', host: 'localhost', port: 3000 };
const server = serverAddr.protocol + '//' + serverAddr.host + ':' + serverAddr.port;

Fetch(server + '/boards', { method: 'GET' })
  .then((res) => res.text()).then ((text) => { console.log(text); return JSON.parse(text) })
  .catch((err) => { console.log("oh no: " + err)});

let boardId;
Fetch(server + '/boards/xyz/state', { method: 'GET' })
.then((res) => res.text()).then ((text) => { console.log(text); return JSON.parse(text) })
.then((_text) => Fetch(server + '/boards', { method: 'POST', body: JSON.stringify({ boardSize: 64 }) }))
.then((res) => res.status===200 && res.text()).then((text) => { console.log(text); return JSON.parse(text) })
.then((body) => { boardId = body.id; return Fetch(server + '/boards/'+boardId+'/state', { method: 'GET' }) })
.then((res) => res.text()).then ((text) => { console.log(text); return JSON.parse(text) })
.then((_text) => Fetch(server + '/boards/'+boardId, { method: 'DELETE' }))
.then((res) => res.text()).then ((text) => { console.log(text); return JSON.parse(text) })
.then((_text) => Fetch(server + '/boards/'+boardId+'/state', { method: 'GET' }))
.then((res) => res.text()).then ((text) => { console.log(text); return JSON.parse(text) })
.catch((err) => { console.log("oh no: " + err)});
