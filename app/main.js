const net = require("net");

// Uncomment this to pass the first stage
const server = net.createServer((socket) => {
  let messageBuffer = Buffer.from([]);

  socket.on("close", () => {
    console.log("Client disconnected");

    socket.end();
  });

  socket.on("data", (data) => {
    const lines = data.toString().split("\r\n");

    lines.forEach(line => {
        if(line.startsWith("GET")) {
            const [method, path, version] = line.split(" ");

            if(path == '/') socket.write("HTTP/1.1 200 OK\r\n\r\n");
            else socket.write("HTTP/1.1 404 Not Found\r\n\r\n");

            socket.end();

            console.log({
                method, path, version
            })
        }
    })
  });

  console.log("Client connected", {
    address: socket.remoteAddress,
    port: socket.remotePort,
  });
});

console.log("Waiting for connections");
server.listen(4221, "localhost");
