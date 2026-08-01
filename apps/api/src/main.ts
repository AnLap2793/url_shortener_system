import "reflect-metadata";
import { bootstrap } from "./bootstrap.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await bootstrap(config);
await app.listen(config.port);
