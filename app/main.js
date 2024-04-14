const { createReadStream, statSync, existsSync, writeFileSync } = require("fs");
const net = require("net");
const { join } = require("path");
const url = require("url");

const CRLF = "\r\n";

const HttpMethod = {
  GET: 1,
  HEAD: 2,
  POST: 3,
  PUT: 4,
  DELETE: 5,
  CONNECT: 6,
  OPTIONS: 7,
  TRACE: 8,
  PATCH: 9,
};

const StatusText = {
  200: "OK",
  201: "Created",
  404: "Not Found",
};

const parseRequest = (data) => {
  const [requestLine, ...lines] = data.toString().split(CRLF);

  const headersEnd = lines.findIndex((line) => line.length === 0);
  const [headers, body] = [
    lines
      .slice(0, headersEnd)
      .map((header) => header.split(": "))
      .reduce((prev, curr) => ({ ...prev, [curr[0]]: curr[1] }), {}),
    lines.slice(headersEnd + 1).join(CRLF),
  ];

  const [method, target, httpVersion] = requestLine.split(" ");

  if (HttpMethod[method] === undefined) {
    throw "Unnown method";
  }

  return {
    url: new url.URL(target, "http://localhost:4221"),
    method,
    httpVersion,
    headers,
    body,
  };
};

const handlePath = (path, pathToTest, callback) => {
  const urlMatcher = `^(${path}){1}((\/){1}(\\S)+)*$`;
  const regexp = new RegExp(urlMatcher);

  const foundMatch = regexp.test(pathToTest);

  if (foundMatch) {
    callback(pathToTest);
  }

  return foundMatch;
};

const getResponse = (status, headers, responseBody) => {
  const response = [
    `HTTP/1.1 ${status} ${StatusText[status]}`,
    ...Object.keys(headers).map((key) => `${key}: ${headers[key]}`),
    ``,
  ];

  if (responseBody !== undefined) {
    response.push(responseBody);
  }

  return response.join(CRLF);
};

const sendResponse = (socket, response, noEnd) => {
  if (socket.readyState == "open") {
    socket.write(response);
    if (!noEnd) socket.end();
  }
};

// Uncomment this to pass the first stage
const server = net.createServer((socket) => {
  socket.on("close", () => {
    console.log("Client disconnected");

    socket.end();
  });

  socket.on("data", (data) => {
    const request = parseRequest(data);
    let anyPathHandled = false;

    switch (HttpMethod[request.method]) {
      case HttpMethod.GET:
        anyPathHandled = handlePath("/", request.url.pathname, () => {
          sendResponse(socket, `HTTP/1.1 200 OK${CRLF}${CRLF}test`);
        });

        anyPathHandled = handlePath("/echo", request.url.pathname, (path) => {
          const responseBody = path.split("/").slice(2).join("/");
          const response = getResponse(
            200,
            {
              "Content-Type": "text/plain",
              "Content-Length": responseBody.length,
            },
            responseBody
          );

          sendResponse(socket, response);
        });

        anyPathHandled = handlePath("/user-agent", request.url.pathname, () => {
          const response = getResponse(
            200,
            {
              "Content-Type": "text/plain",
              "Content-Length": request.headers["User-Agent"].length,
            },
            request.headers["User-Agent"]
          );

          sendResponse(socket, response);
        });

        anyPathHandled = handlePath("/files", request.url.pathname, (path) => {
          const filename = path.split("/").slice(2)[0];
          const directory =
            process.argv[process.argv.indexOf("--directory") + 1];
          const filePath = join(directory, filename);

          if (!existsSync(filePath)) {
            sendResponse(socket, getResponse(404, {}, ""));
            return;
          }

          const response = getResponse(
            200,
            {
              "Content-Type": "application/octet-stream",
              "Content-Length": statSync(filePath).size,
            },
            ""
          );

          sendResponse(socket, response, true);
          if (socket.readyState == "open") {
            createReadStream(join(directory, filename)).pipe(socket);
          }
        });

        break;
      case HttpMethod.POST:
        anyPathHandled = handlePath("/files", request.url.pathname, (path) => {
          const filename = path.split("/").slice(2)[0];
          const directory =
            process.argv[process.argv.indexOf("--directory") + 1];
          const filePath = join(directory, filename);

          writeFileSync(filePath, request.body, {
            encoding: "utf8",
          });

          sendResponse(socket, getResponse(201, {}, ""));
        });
        break;
      default:
        sendResponse(socket, getResponse(404, {}, ""));
        anyPathHandled = true;
    }

    if (!anyPathHandled) {
      sendResponse(socket, getResponse(404, {}, ""));
    }
  });

  console.clear();
  console.log("Client connected", {
    address: socket.remoteAddress,
    port: socket.remotePort,
  });
});

console.log("Waiting for connections");
server.listen(4221, "localhost");
