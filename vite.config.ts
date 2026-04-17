import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// 创建 Vite 插件，拦截并处理本地文件读写（如：埋点日志、对话JSON自动保存等）
const localDevPlugin = () => {
  return {
    name: "local-dev-plugin",
    configureServer(server: {
      middlewares: {
        use: (arg0: (req: any, res: any, next: any) => void) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        // 1. 拦截 /api/log 请求 (原本的 tracker 功能)
        if (req.url === "/api/log" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: { toString: () => string }) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            try {
              const logData = JSON.parse(body);
              const logLine = JSON.stringify(logData) + "\n";

              const logDir = path.resolve(__dirname, "logs");
              if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir);
              }

              const dateStr = new Date().toISOString().split("T")[0];
              const userId = logData.userId || "anonymous";
              
              fs.appendFileSync(
                path.resolve(logDir, `track_log_${dateStr}_${userId}.jsonl`),
                logLine,
              );

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to write log" }));
            }
          });
        } 
        // 2. 拦截 /api/saveContext 请求，自动直接写入 public/jsons
        else if (req.url === "/api/saveContext" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: { toString: () => string }) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            try {
              const { userId, data } = JSON.parse(body);
              
              const jsonsDir = path.resolve(__dirname, "public/jsons");
              if (!fs.existsSync(jsonsDir)) {
                fs.mkdirSync(jsonsDir, { recursive: true });
              }

              const fileName = `ai_chat_context_${userId || "default"}.json`;
              fs.writeFileSync(
                path.resolve(jsonsDir, fileName),
                JSON.stringify(data, null, 2),
                "utf-8"
              );

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to write context" }));
            }
          });
        }
        else {
          next();
        }
      });
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localDevPlugin()],
});
