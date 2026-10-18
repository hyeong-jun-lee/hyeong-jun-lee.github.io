window.MathJax = {
  tex: {
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"],
    ],
    processEscapes: true,
    processEnvironments: true,
  },
};

// Wait for the math engine, not unrelated images or embedded comments.
document.addEventListener("DOMContentLoaded", () => {
  window.MathJax.startup.promise.then(() => {
    const blocks = document.querySelectorAll("pre>code.language-pseudocode");
    if (!blocks.length) return;
    blocks.forEach((elem) => {
      const texData = elem.textContent;
      const parent = elem.parentElement.parentElement;
      /* create pseudocode node */
      let pseudoCodeElement = document.createElement("pre");
      pseudoCodeElement.classList.add("pseudocode");
      const text = document.createTextNode(texData);
      pseudoCodeElement.appendChild(text);
      /* add pseudocode node and remove the original code block */
      parent.appendChild(pseudoCodeElement);
      parent.removeChild(elem.parentElement);
      /* embed the visualization in the container */
      pseudocode.renderElement(pseudoCodeElement);
    });
    // pseudocode.js converts math after initial typesetting; include its new glyphs.
    window.MathJax.chtmlStylesheet?.();
  });
}, { once: true });
