import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
process.env.TS_NODE_PROJECT ??= path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../tsconfig.json");
require("ts-node/register/transpile-only");
require("reflect-metadata");

const { INTERCEPTORS_METADATA } = require("@nestjs/common/constants");
const { PublisherController } = require("../src/publishing/publisher.controller.ts");

test("PublisherController preserves uploaded folder paths for skill package submissions", () => {
  const interceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, PublisherController.prototype.submit) ?? [];
  assert.equal(interceptors.length, 1);

  const interceptor = new interceptors[0]({});
  assert.equal(interceptor.multer.preservePath, true);
});
