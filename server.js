const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");
const app = express();
const PORT = 5002;

app.use(express.json());
app.use(cors());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    }
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let qrCodeImage = "";
let isConnected = false;
let clientStatus = null;
let clientName = null;
let clientNumber = null;

client.on("qr", (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
        qrCodeImage = url;
        io.emit("qrCode", { connected: false, qrCode: qrCodeImage });
    });
});

client.on("ready", async () => {

    isConnected = true;
    clientStatus = await client.getState();
    clientName = client.info.pushname;
    clientNumber = client.info.wid.user;
    io.emit("connected", {
        isConnected: isConnected,
        clientStatus: clientStatus,
        clientName: clientName,
        clientNumber: clientNumber,
    });
});

client.on("disconnected", async (reason) => {
    console.log("WhatsApp client disconnected! Motivo:", reason);

    isConnected = false;
    clientStatus = null;
    io.emit("disconnected", { connected: false });
});

client.initialize();

app.get("/get-qrcode", async (req, res) => {
    if (!qrCodeImage) {
        res.json({ connected: true, data: {status: clientStatus, name: clientName, number: clientNumber } });
    } else {
        res.json({ connected: false, qrCode: qrCodeImage });
    }
});


app.get("/is-connected", (req, res) => {
    res.json({ status: clientStatus, clientName: clientName, clientNumber: clientNumber, qrCode: qrCodeImage });
});

app.post("/send-message", async (req, res) => {
    const { number, message } = req.body;
    const formattedNumber = number.includes("@") ? number : `55${number}@c.us`;

    try {
        const pdfPath = '/usr/local/var/www/ZapDirect/backend/message.pdf'; 
        const pdfBuffer = await fs.promises.readFile(pdfPath); 
        const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), 'message.pdf');
        await client.sendMessage(formattedNumber, message);
        await client.sendMessage(formattedNumber, "Aqui está seu PDF:", { media });

        res.json({ success: true, message: "Mensagem enviada com sucesso!" });
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        res.status(500).json({ success: false, message: "Erro ao enviar mensagem." });
    }
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

server.listen(5003);