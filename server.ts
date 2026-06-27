import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(express.json());

const PORT = 3000;

// In-memory store
let orders: any[] = [];
let spreadsheetId: string | null = null;
let orderCounter = 1;

// API routes
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

app.post("/api/orders", (req, res) => {
  const newOrder = {
    id: `ORD-${String(orderCounter).padStart(4, '0')}`,
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString(),
    syncedToSheets: false,
  };
  orderCounter++;
  orders.push(newOrder);
  
  // Broadcast to admins
  io.emit("order_added", newOrder);
  
  res.status(201).json(newOrder);
});

app.patch("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  const { status, syncedToSheets } = req.body;
  const order = orders.find(o => o.id === id);
  if (order) {
    if (status !== undefined) order.status = status;
    if (syncedToSheets !== undefined) order.syncedToSheets = syncedToSheets;
    io.emit("order_updated", order);
    res.json(order);
  } else {
    res.status(404).json({ error: "Order not found" });
  }
});

app.get("/api/settings/spreadsheet", (req, res) => {
  res.json({ spreadsheetId });
});

app.post("/api/settings/spreadsheet", (req, res) => {
  spreadsheetId = req.body.spreadsheetId;
  res.json({ spreadsheetId });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  io.on("connection", (socket) => {
    console.log("Client connected", socket.id);
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
