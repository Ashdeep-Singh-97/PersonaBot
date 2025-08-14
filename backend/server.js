import 'dotenv/config';
import express from 'express';
import { OpenAI } from 'openai';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // In production, set this to your frontend domain
    }
});
// CORS options
const corsOptions = {
    origin: "http://localhost:5173", // No trailing slash
    methods: ["GET", "POST"],
    credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.use(express.json());

// Gemini client
const gemini = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

// System prompt
const SYSTEM_PROMPT = `
Namaste! Tumhara dost Hitesh Choudhary bol raha hu - chai lover aur tech educator.
Tum ek AI ho jo Hitesh ke style me baat karta hai: friendly, Hindi-English mixed, energetic, coding-focused.

Steps:
1. understand - hanji, kya sawaal hai?
2. explore - topic ki knowledge samajhna
3. compute - logic ya calculation apply karna
4. crosscheck - hanji, validate karna jo result aaya
5. wrap_up - friendly summary dena, jaise class khatam hone wali ho

Rules:
- Saare steps ek hi request me do.
- Output **strict JSON array** format me ho, jaise:
  [
    { "step": "understand", "content": "..." },
    { "step": "explore", "content": "..." },
    ...
  ]
- Output me koi extra text ya explanation nahi.
- Agar zarurat na ho toh tum kuch steps skip bhi kar saqte ho, jaise normal hi hello messages me in
  sab steps ki zarurat nhi.
- Ye rules sirf tabhi follow honge agar hum kuch computation kar rhe hai maths ya coding ki,
  varna remove extra steps and keep it simple like a human.
- Agar hum log maths ya coding ya computation kar rahe hai sirf tabhi in steps ko use karna ,
varna keep it causal as Hitesh Sir is super cool.
- Har reply me chai ka zikar zarur karna
- Use only hinglish
- every response is supposed to be started with "Hanji"
`;

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);
    });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ error: "Message is required" });
    }

    // Broadcast user message instantly
    io.emit("chat message", { sender: "user", text: userMessage });

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
    ];

    try {
        const response = await gemini.chat.completions.create({
            model: 'gemini-2.0-flash',
            messages: messages,
        });

        let raw = response.choices[0].message.content.trim();

        // Remove code block markers if any
        raw = raw.replace(/```json\s*/i, '').replace(/```$/, '').trim();

        let steps;
        try {
            steps = JSON.parse(raw);
        } catch {
            return res.status(500).json({
                error: "Invalid JSON from model",
                raw: raw
            });
        }

        // Combine step content into one message
        const combinedText = steps.map(s => s.content).join(" ");
        // console.log(combinedText);
        // Broadcast bot response
        io.emit("chat message", { sender: "bot", text: combinedText });

        // Send JSON steps to client (in case frontend needs structured data)
        res.json({ steps });

    } catch (err) {
        console.error("❌ API Error:", err);
        res.status(500).json({ error: err.message });
    }
});

const port = process.env.PORT || 5000;
server.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
