import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const mile = readFileSync(new URL("../_posts/2026-10-19-mile.md", import.meta.url), "utf8");
const eil = readFileSync(new URL("../_posts/2026-10-19-eil.md", import.meta.url), "utf8");

test("MILE keeps its public URL and publishes a sourced, typeset review", () => {
  assert.match(mile, /^title: "MILE: Model-based Intervention Learning"$/m);
  assert.match(mile, /^permalink: \/blog\/2026\/mile\/$/m);
  assert.match(mile, /^pseudocode: true$/m);
  assert.equal((mile.match(/```pseudocode/g) || []).length, 1);
  assert.match(mile, /https:\/\/arxiv\.org\/pdf\/2502\.13519v1#page=8/);
  for (const name of ["2026-10-17-imitation-learning-basics-bc-dagger", "2026-10-18-hg-dagger", "2026-10-19-eil"]) {
    assert.ok(mile.includes(`{% post_url ${name} %}`));
  }
});

test("MILE figures have local assets, dimensions, alternatives and fixed sources", () => {
  const figures = [...mile.matchAll(/{% include figure\.liquid[\s\S]*?%}/g)].map((match) => match[0]);
  assert.equal(figures.length, 6);
  for (const figure of figures) {
    const path = figure.match(/path="([^"]+)"/)[1];
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
    assert.match(figure, /width="\d+" height="\d+"/);
    assert.match(figure, /alt="[^"]{10,}"/);
    assert.match(figure, /https:\/\/arxiv\.org\/pdf\/2502\.13519v1#page=\d/);
    assert.match(figure, /zoomable=true avoid_scaling=true/);
    assert.doesNotMatch(figure, /z-depth|shadow|caption="Fig\./);
  }
});

test("review videos are user-controlled, attributed and have fallback links", () => {
  const video = mile.match(/<video\b[\s\S]*?<\/video>/)[0];
  assert.match(video, /controls playsinline preload="metadata"/);
  assert.match(video, /aria-label="[^"]+"/);
  assert.match(video, /https:\/\/liralab\.usc\.edu\/mile\/static\/videos\/eval1\.mp4/);
  assert.match(video, /<a href=/);
  assert.doesNotMatch(video, /\bautoplay\b/);
  const iframe = eil.match(/<iframe\b[^>]*><\/iframe>/)[0];
  assert.match(iframe, /youtube-nocookie\.com\/embed\/NjkcgB-yy0w/);
  assert.match(iframe, /loading="lazy"/);
  assert.match(iframe, /title="[^"]+"/);
  assert.match(iframe, /referrerpolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(iframe, /autoplay|clipboard-write/);
  assert.match(eil, /https:\/\/www\.youtube\.com\/watch\?v=NjkcgB-yy0w/);
});
