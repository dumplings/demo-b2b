import assert from "node:assert/strict";
import { test } from "node:test";
import { renderMarkdown } from "../src/lib/markdown/render.ts";

test("Markdown produces semantic headings, paragraphs, emphasis, lists and code", () => {
  const html = renderMarkdown(
    "## Heading\n\nA **strong** paragraph.\n\n- One\n- Two\n\n`code`\n",
  );
  for (const tag of ["h2", "p", "strong", "ul", "li", "code"])
    assert.match(html, new RegExp(`<${tag}(?:>| )`));
});

test("raw HTML and dangerous URL protocols cannot produce executable elements", () => {
  const html = renderMarkdown(
    '<script>globalThis.__markdownAttack=true</script>\n\n<img src=x onerror="alert(1)">\n\n<svg onload="alert(2)"></svg>\n\n[bad](javascript:alert(1))\n\n[entity](jav&#x61;script:alert(1))\n\n[bad](data:text/html,attack)\n\n![bad](javascript:alert(1))',
  );
  assert.doesNotMatch(
    html,
    /<(?:script|img|svg|iframe)\b|href=["'](?:javascript|data|vbscript):/iu,
  );
  assert.match(html, /&lt;script&gt;/u);
  assert.match(
    renderMarkdown("[safe](https://example.com/)"),
    /href="https:\/\/example.com\/"/u,
  );
});

import { parseHomeResponse } from "../src/lib/cms/schemas.ts";
import { resolveHome } from "../src/lib/i18n/fallback.ts";
import { createTranslationReport } from "../src/lib/i18n/report.ts";
const english = {
  headline: "English",
  description: "Description",
  bodyMarkdown: "## English body",
};
const found = (locale, content) => ({ status: "found", locale, content });

test("Adapter accepts absent/null Markdown, preserves valid source and rejects invalid types", () => {
  for (const bodyMarkdown of [null, "", "  ", "## Markdown"])
    assert.equal(
      parseHomeResponse(
        { data: { ...english, locale: "en", bodyMarkdown } },
        "en",
      ).bodyMarkdown,
      bodyMarkdown,
    );
  const { bodyMarkdown: omitted, ...legacy } = english;
  assert.ok(omitted);
  assert.equal(
    parseHomeResponse({ data: { ...legacy, locale: "en" } }, "en").bodyMarkdown,
    undefined,
  );
  for (const bodyMarkdown of [3, true, {}, []])
    assert.throws(
      () =>
        parseHomeResponse(
          { data: { ...english, locale: "en", bodyMarkdown } },
          "en",
        ),
      /bodyMarkdown/u,
    );
});

test("Markdown follows field/entry fallback, with local and unavailable cases kept distinct", () => {
  for (const bodyMarkdown of [undefined, null, "", " "]) {
    const r = resolveHome(
      english,
      "de",
      found("de", { headline: "Deutsch", description: "Text", bodyMarkdown }),
    );
    assert.deepEqual(r.fields.bodyMarkdown, {
      value: english.bodyMarkdown,
      sourceLocale: "en",
      fallback: true,
      reason: "missing-field",
    });
    assert.equal(r.mixedLanguage, true);
  }
  const missing = resolveHome(english, "fr", {
    status: "missing",
    locale: "fr",
  });
  assert.equal(missing.fields.bodyMarkdown.reason, "missing-entry");
  assert.equal(missing.fallbackKind, "entry");
  const local = resolveHome(
    english,
    "de",
    found("de", { ...english, bodyMarkdown: "## Deutsch" }),
  );
  assert.equal(local.fields.bodyMarkdown.sourceLocale, "de");
  assert.equal(local.fields.bodyMarkdown.fallback, false);
  const empty = { ...english, bodyMarkdown: null };
  const neither = resolveHome(empty, "de", found("de", empty));
  assert.deepEqual(neither.fields.bodyMarkdown, {
    value: null,
    sourceLocale: null,
    fallback: false,
    reason: "unavailable-optional",
  });
});

test("English Markdown adds four eligible fields: 6/12, while absent English stays excluded", () => {
  const languages = ["en", "ar", "de", "fr", "zh-CN"].map((strapiLocale) => ({
    strapiLocale,
    urlSegment: strapiLocale === "zh-CN" ? "zh" : strapiLocale,
    direction: strapiLocale === "ar" ? "rtl" : "ltr",
    isDefault: strapiLocale === "en",
  }));
  const manifest = {
    siteId: "demo-b2b",
    languages,
    defaultLanguage: languages[0],
  };
  const homes = languages.map((l) =>
    resolveHome(
      english,
      l.strapiLocale,
      l.strapiLocale === "fr"
        ? { status: "missing", locale: "fr" }
        : found(l.strapiLocale, {
            ...english,
            bodyMarkdown: l.strapiLocale === "en" ? english.bodyMarkdown : null,
          }),
    ),
  );
  const report = createTranslationReport(manifest, "b2b-home", english, homes);
  assert.deepEqual(report.totals, {
    eligibleFields: 12,
    translatedFields: 6,
    fallbackFields: 6,
    ratio: 0.5,
  });
  assert.ok(
    report.warnings.some(
      (w) => w.targetLocale === "fr" && w.code === "entry-fallback",
    ),
  );
  const noEnglish = { ...english, bodyMarkdown: null };
  const optional = languages.map((l) =>
    resolveHome(
      noEnglish,
      l.strapiLocale,
      found(l.strapiLocale, {
        ...english,
        bodyMarkdown: l.strapiLocale === "de" ? "## Extra German" : null,
      }),
    ),
  );
  const excluded = createTranslationReport(
    manifest,
    "b2b-home",
    noEnglish,
    optional,
  );
  assert.equal(excluded.totals.eligibleFields, 8);
  const field = excluded.languages
    .find((l) => l.targetLocale === "de")
    .fields.find((f) => f.field === "bodyMarkdown");
  assert.equal(field.exclusionReason, "english-optional-unavailable");
  assert.equal(field.counted, false);
  assert.equal(field.displayed, true);
});
