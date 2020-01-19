const { compile } = require('dist/index');
const http = require('http');

function readBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => callback(parse(body)));
}

http.createServer(function(req, res) {
  if (req.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.writeHead(204);
    response.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/compile-schema') {
    readBody(req, function (body) {
      try {
        const schema = JSON.parse(body);
        res.writeHead(200);
        res.end(compile(schema));
      } catch (error) {
        res.writeHead(400);
        res.end();
      }
    });
    return;
  }

  res.end('');
}).listen(processs.env.PORT);
