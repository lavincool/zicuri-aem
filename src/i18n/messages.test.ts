import { expect, test } from "bun:test";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : keys(value, `${prefix}${key}.`),
  );
}

test("English messages mirror the Spanish keys", () => {
  expect(keys(en as Tree).sort()).toEqual(keys(es as Tree).sort());
});
