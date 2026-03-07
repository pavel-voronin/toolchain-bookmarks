import { startServer } from "./server/index";

startServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
