import { expect, it } from "vitest";
import zhCN from "./locales/zh-CN.json";
import enUS from "./locales/en-US.json";

function keys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix + key;
    return typeof entry === "object" && entry !== null ? keys(entry as Record<string, unknown>, `${path}.`) : [path];
  }).sort();
}

it("provides matching Chinese and English translation keys", () => {
  expect(keys(enUS)).toEqual(keys(zhCN));
});
