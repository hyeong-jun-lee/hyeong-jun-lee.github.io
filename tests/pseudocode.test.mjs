import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { readText } from "./helpers/site-files.mjs";

function setup(blockCount) {
  const events = [];
  const listeners = new Map();
  const parent = { appendChild() {}, removeChild() {} };
  const blocks = Array.from({ length: blockCount }, (_, index) => ({
    textContent: `algorithm ${index}`,
    parentElement: { parentElement: parent },
  }));
  const document = {
    readyState: "loading",
    addEventListener(name, callback) { listeners.set(name, callback); },
    querySelectorAll() { return blocks; },
    createElement() { return { classList: { add() {} }, appendChild() {} }; },
    createTextNode(text) { return { textContent: text }; },
  };
  const window = {};
  vm.runInNewContext(readText("assets/js/pseudocode-setup.js"), {
    window, document,
    pseudocode: { renderElement() { events.push("render"); } },
  });
  window.MathJax.chtmlStylesheet = () => events.push("refresh glyph CSS");
  let finishMath;
  window.MathJax.startup = { promise: new Promise((resolve) => { finishMath = resolve; }) };
  return {
    document, events,
    fire: (name) => listeners.get(name)?.(),
    finishMath: async () => { finishMath(); await window.MathJax.startup.promise; },
  };
}

test("renders pseudocode after DOM and MathJax readiness without waiting for all page resources", async () => {
  const page = setup(2);
  page.document.readyState = "interactive";
  page.fire("DOMContentLoaded");
  assert.deepEqual(page.events, []);
  await page.finishMath();
  assert.deepEqual(page.events, ["render", "render", "refresh glyph CSS"]);
});

test("does not refresh MathJax styles when there is no pseudocode block", async () => {
  const page = setup(0);
  page.document.readyState = "interactive";
  page.fire("DOMContentLoaded");
  await page.finishMath();
  assert.deepEqual(page.events, []);
});

test("the final page load does not render pseudocode a second time", async () => {
  const page = setup(2);
  page.document.readyState = "interactive";
  page.fire("DOMContentLoaded");
  await page.finishMath();
  page.document.readyState = "complete";
  page.fire("readystatechange");
  assert.deepEqual(page.events, ["render", "render", "refresh glyph CSS"]);
});
