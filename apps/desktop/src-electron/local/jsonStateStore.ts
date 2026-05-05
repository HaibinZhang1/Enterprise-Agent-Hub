import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface JsonStateStoreOptions<T> {
  readonly statePath: string;
  readonly createInitialState: () => T;
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export class JsonStateStore<T> {
  readonly #options: JsonStateStoreOptions<T>;

  constructor(options: JsonStateStoreOptions<T>) {
    this.#options = options;
  }

  async initialize(): Promise<void> {
    await mkdir(path.dirname(this.#options.statePath), { recursive: true });
    if (!(await exists(this.#options.statePath))) {
      await this.save(this.#options.createInitialState());
    }
  }

  async load(): Promise<T> {
    return JSON.parse(await readFile(this.#options.statePath, "utf8")) as T;
  }

  async save(state: T): Promise<void> {
    await mkdir(path.dirname(this.#options.statePath), { recursive: true });
    await writeFile(this.#options.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async mutate<Result>(mutator: (state: T) => Result | Promise<Result>): Promise<Result> {
    const state = await this.load();
    const result = await mutator(state);
    await this.save(state);
    return result;
  }
}
