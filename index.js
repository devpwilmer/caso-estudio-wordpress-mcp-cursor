import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const WP_BASE_URL = process.env.WP_BASE_URL;
const WP_USERNAME = process.env.WP_USERNAME;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

if (!WP_BASE_URL || !WP_USERNAME || !WP_APP_PASSWORD) {
  console.error("Missing env vars: WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD");
  process.exit(1);
}

const authHeader =
  "Basic " + Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString("base64");

async function wpFetch(path, options = {}) {
  const url = `${WP_BASE_URL.replace(/\/$/, "")}/wp-json/wp/v2${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const raw = await response.text();
  let json = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { raw };
  }

  if (!response.ok) {
    throw new Error(`WordPress API ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

const server = new Server(
  { name: "wordpress-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_posts",
        description: "List recent WordPress posts",
        inputSchema: {
          type: "object",
          properties: {
            per_page: { type: "number", default: 5 }
          },
          additionalProperties: false
        }
      },
      {
        name: "create_post",
        description: "Create a WordPress post",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            status: { type: "string", enum: ["draft", "publish"], default: "draft" }
          },
          required: ["title", "content"],
          additionalProperties: false
        }
      },
      {
        name: "delete_post",
        description: "Delete a WordPress post (trash by default)",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number" },
            force: { type: "boolean", default: false }
          },
          required: ["id"],
          additionalProperties: false
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === "list_posts") {
    const perPage = Number(args.per_page ?? 5);
    const posts = await wpFetch(
      `/posts?per_page=${Math.max(1, Math.min(100, perPage))}&_fields=id,date,title,status`
    );
    return {
      content: [{ type: "text", text: JSON.stringify(posts, null, 2) }]
    };
  }

  if (name === "create_post") {
    const body = {
      title: args.title,
      content: args.content,
      status: args.status || "draft"
    };
    const post = await wpFetch("/posts", {
      method: "POST",
      body: JSON.stringify(body)
    });
    return {
      content: [{ type: "text", text: JSON.stringify(post, null, 2) }]
    };
  }

  if (name === "delete_post") {
    const force = args.force === true;
    const result = await wpFetch(`/posts/${args.id}?force=${force}`, {
      method: "DELETE"
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
