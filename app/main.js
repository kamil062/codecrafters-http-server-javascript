const net = require("net");
const url = require("url");

const CRLF = "\r\n";

// Uncomment this to pass the first stage
const server = net.createServer((socket) => {
  socket.on("close", () => {
    console.log("Client disconnected");

    socket.end();
  });

  socket.on("data", (data) => {
    const lines = data.toString().split("\r\n");

    lines.forEach((line) => {
      if (line.startsWith("GET")) {
        const [httpMethod, httpPath, httpVersion] = line.split(" ");

        console.log({
          httpMethod,
          httpPath,
          httpVersion,
        });

        if (httpPath?.length) {
          const parsed = new url.URL(httpPath, 'http://localhost:4221');
          const pathParts = parsed.pathname.split("/").filter((e) => e.length);

          if(parsed.pathname == '/') {
            socket.write(`HTTP/1.1 200 OK${CRLF}${CRLF}`)
          } else if (pathParts[0] == "echo") {
            const responseBody = pathParts.slice(1).join('/');
            const contentType = "text/plain";
            const contentLength = responseBody.length;

            const response = [
              "HTTP/1.1 200 OK",
              `Content-Type: ${contentType}`,
              `Content-Length: ${contentLength}`,
              ``,
              `${responseBody}`,
            ].join(CRLF);

            socket.write(response);
          } else socket.write(`HTTP/1.1 404 Not Found${CRLF}${CRLF}`);
        } else socket.write(`HTTP/1.1 404 Not Found${CRLF}${CRLF}`);

        socket.end();
      }
    });
  });

  console.clear();
  console.log("Client connected", {
    address: socket.remoteAddress,
    port: socket.remotePort,
  });
});

console.log("Waiting for connections");
server.listen(4221, "localhost");
