import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import test from "node:test";

import { readFrontMatter, readText } from "./helpers/site-files.mjs";

const removedPosts = [
  "_posts/2025-01-06-unified-approach.md",
  "_posts/2026-03-17-num-lin-alg.md",
];

const reviewPosts = new Map([
  ["2026-10-17-imitation-learning-basics-bc-dagger.md", ["imitation and intervention learning", "https://proceedings.mlr.press/v15/ross11a.html"]],
  ["2026-10-18-hg-dagger.md", ["imitation and intervention learning", "https://arxiv.org/abs/1810.02890"]],
  ["2026-10-19-eil.md", ["imitation and intervention learning", "https://roboticsproceedings.org/rss16/p055.html"]],
  ["2026-10-15-mile.md", ["imitation and intervention learning", "https://arxiv.org/abs/2502.13519"]],
  ["2026-10-15-optnet.md", ["optimization", "https://proceedings.mlr.press/v70/amos17a.html"]],
  ["2026-10-15-haco.md", ["imitation and intervention learning", "https://arxiv.org/abs/2202.10341"]],
  ["2026-10-15-pvp.md", ["imitation and intervention learning", "https://papers.neurips.cc/paper_files/paper/2023/hash/f57ffe47d0b528fbb97901d16bd4eba2-Abstract-Conference.html"]],
  ["2026-10-15-supcon.md", ["representation learning", "https://proceedings.neurips.cc/paper/2020/hash/d89a66c7c80a29b1bdbab0f2a1a94af8-Abstract.html"]],
  ["2026-10-15-dann.md", ["generalization", "https://jmlr.org/papers/v17/15-239.html"]],
  ["2026-10-15-a2d.md", ["imitation and intervention learning", "https://proceedings.mlr.press/v139/warrington21a.html"]],
  ["2026-10-15-sitt.md", ["imitation and intervention learning", "https://proceedings.iclr.cc/paper_files/paper/2025/hash/a8223b0ad64007423ffb308b0dd92298-Abstract-Conference.html"]],
  ["2026-10-15-maml.md", ["generalization", "https://proceedings.mlr.press/v70/finn17a.html"]],
  ["2026-10-15-mldg.md", ["generalization", "https://ojs.aaai.org/index.php/AAAI/article/view/11596"]],
  ["2026-10-15-iarl.md", ["imitation and intervention learning", "https://proceedings.mlr.press/v87/wang18a.html"]],
]);

function collectionMarkdown(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .map((name) => `${directory}/${name}`)
    .sort();
}

function primaryCategory(frontMatter) {
  const match = frontMatter.match(/^categories:\s*\[([^\]]+)\]/m);
  return match?.[1].trim().replace(/^['"]|['"]$/g, "");
}

test("removes the abandoned numerical linear algebra and test posts", () => {
  for (const path of removedPosts) assert.equal(existsSync(path), false, `${path} should be removed`);
});

test("every post names at least one external source", () => {
  for (const path of collectionMarkdown("_posts")) {
    const source = readText(path);
    assert.match(source, /^## References\s*$/m, `${path} needs a References section`);
    assert.match(source, /^- \[[^\]]+\]\(https:\/\/[^)]+\)/m, `${path} needs a linked primary source`);
  }
});

test("publishes the requested reviews as ordinary sourced posts", () => {
  for (const [fileName, [category, sourceUrl]] of reviewPosts) {
    const path = `_posts/${fileName}`;
    const source = readText(path);
    const frontMatter = readFrontMatter(path);

    assert.match(frontMatter, /^tags:\s*\[[^\]]*paper review[^\]]*\]/m, `${path} must be discoverable as a paper review`);
    assert.equal(primaryCategory(frontMatter), category, `${path} has the wrong primary category`);
    assert.ok(source.includes(sourceUrl), `${path} must cite ${sourceUrl}`);
    assert.doesNotMatch(frontMatter, /^status:|^plan_order:|^primary_category:/m);
  }
});

test("uses one public post collection without an upcoming queue", () => {
  const config = readText("_config.yml");
  assert.doesNotMatch(config, /^\s{2}planned:/m);
  for (const path of ["_pages/blog.md", "_layouts/post.liquid", "_layouts/archive.liquid", "_includes/blog/topic_panel.liquid"]) {
    assert.doesNotMatch(readText(path), /site\.planned|Writing queue|Planned note|planned_documents|planned_count/);
  }
});
