import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function expectBlock(pattern: RegExp, message: string) {
  assert.match(styles, pattern, message);
}

test("desktop large-screen tokens cap and center the workspace shell", () => {
  expectBlock(/--workspace-max-width:\s*1680px;/, "workspace max-width token should exist");
  expectBlock(/\.workspace-page\s*\{[\s\S]*width:\s*min\(var\(--workspace-max-width\),\s*100%\);[\s\S]*margin:\s*0 auto;/, "workspace page should stay centered and width-capped");
  expectBlock(/@media \(min-width:\s*1500px\)\s*\{[\s\S]*\.workspace-page\s*\{[\s\S]*width:\s*min\(1520px,\s*100%\);/, "ultra-wide workspace width cap should be explicit");
});

test("desktop density layout keeps shared two-pane rules across standard and large desktop widths", () => {
  expectBlock(/@media \(min-width:\s*801px\)\s*\{[\s\S]*\.community-grid-layout,\s*[\s\S]*\.list-detail-shell,\s*[\s\S]*\.local-browser,\s*[\s\S]*\.publisher-page-layout,\s*[\s\S]*\.manage-hub-users\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.12fr\)\s+var\(--layout-inspector-width\);/, "desktop two-pane grid should stay shared across primary desktop surfaces before the 1100px fallback");
  expectBlock(/\.manage-pane-grid\.departments-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(var\(--layout-rail-width\),\s*0\.72fr\)\s+minmax\(0,\s*1fr\)\s+var\(--layout-inspector-width\);/, "departments workbench should use explicit large-screen pane hierarchy");
});

test("community browsing uses cards while local browsing keeps dense row container queries", () => {
  expectBlock(/\.market-card-title strong\s*\{[\s\S]*font-size:\s*15px;[\s\S]*line-height:\s*1\.28;/, "community card titles should keep an explicit compact size before container switches");
  expectBlock(/\.market-card-title p\s*\{[\s\S]*font-size:\s*13px;[\s\S]*line-height:\s*1\.5;/, "community card descriptions should stay compact in two-column mode");
  expectBlock(/\.list-row-copy strong\s*\{[\s\S]*font-size:\s*15px;[\s\S]*line-height:\s*1\.28;/, "local row titles should keep an explicit compact size before container switches");
  expectBlock(/\.list-row-copy p\s*\{[\s\S]*font-size:\s*13px;[\s\S]*line-height:\s*1\.5;/, "local row descriptions should stay compact when the pane narrows");
  expectBlock(/\.unified-skill-inspector \.detail-block > p\s*\{[\s\S]*font-size:\s*13px;[\s\S]*line-height:\s*1\.55;/, "inspector descriptions should stay compact instead of inheriting large default copy");
  expectBlock(/\.community-grid-layout\s*>\s*\.stage-panel\s*\{[\s\S]*container-type:\s*inline-size;[\s\S]*container-name:\s*market-pane;/, "community stage panel should expose market-pane container queries");
  expectBlock(/\.local-list-panel\s*\{[\s\S]*container-type:\s*inline-size;[\s\S]*container-name:\s*local-pane;/, "local list panel should expose local-pane container queries");
  expectBlock(/@container market-pane \(min-width:\s*760px\)\s*\{[\s\S]*\.market-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(270px,\s*1fr\)\);[\s\S]*gap:\s*12px;[\s\S]*\.market-card\s*\{[\s\S]*padding:\s*16px;/, "community browse cards should form a responsive grid inside the market container");
  expectBlock(/@container local-pane \(min-width:\s*760px\)\s*\{[\s\S]*\.local-item\s*\{[\s\S]*grid-template-columns:\s*52px\s+minmax\(0,\s*1fr\)\s+auto;[\s\S]*padding:\s*12px\s+14px;[\s\S]*\.unified-skill-row\s*\{[\s\S]*min-height:\s*112px;/, "local Skill browsing should preserve dense row proportions");
});

test("community home keeps leaderboard and entry grids responsive", () => {
  expectBlock(/\.community-landing-page\s*\{[\s\S]*width:\s*min\(var\(--workspace-max-width\),\s*100%\);/, "standalone community home should keep the same centered workspace width cap");
  expectBlock(/\.community-landing-page \.community-home\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*overflow:\s*auto;/, "standalone community home should scroll independently without a sidebar layout");
  expectBlock(/\.community-home-leaderboards\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/, "community home should show three leaderboard cards on desktop");
  expectBlock(/\.community-home-entry-copy strong\s*\{[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/, "community entry card labels should not overflow their card");
  expectBlock(/@media \(max-width:\s*1100px\)\s*\{[\s\S]*\.community-home-leaderboards,\s*[\s\S]*\.community-grid-layout,\s*[\s\S]*\{[\s\S]*grid-template-columns:\s*1fr;/, "community leaderboard cards should collapse before narrow layouts squeeze them");
  expectBlock(/@media \(max-width:\s*800px\)\s*\{[\s\S]*\.community-home-search,\s*[\s\S]*\.community-home-entry-grid,\s*[\s\S]*\{[\s\S]*grid-template-columns:\s*1fr;/, "community home search and entry cards should become single-column on small screens");
});

test("detail and overlay typography stay capped for readability on large screens", () => {
  expectBlock(/\.skill-detail-modal\s*\{[\s\S]*width:\s*min\(1040px,\s*calc\(100vw - 40px\)\);/, "skill detail modal width should be capped");
  expectBlock(/\.review-detail-modal\s*\{[\s\S]*width:\s*min\(1100px,\s*calc\(100vw - 40px\)\);/, "review detail modal width should be capped");
  expectBlock(/\.skill-detail-head-copy p,\s*[\s\S]*\.skill-detail-page p,\s*[\s\S]*\.version-history-row p\s*\{[\s\S]*max-width:\s*72ch;[\s\S]*line-height:\s*1\.6;/, "detail copy should stay within the 72ch readability guardrail");
});

test("fallback breakpoints collapse multi-pane desktop layouts back to one column", () => {
  expectBlock(/@media \(max-width:\s*1100px\)\s*\{[\s\S]*\.home-hero-shell,\s*[\s\S]*\.community-grid-layout,\s*[\s\S]*\.list-detail-shell,\s*[\s\S]*\.manage-pane-grid,\s*[\s\S]*\.publisher-detail-layout,\s*[\s\S]*\.publisher-page-layout,\s*[\s\S]*\.skill-detail-layout,\s*[\s\S]*\.manage-hub-users,\s*[\s\S]*\.overlay-grid\.two-columns\s*\{[\s\S]*grid-template-columns:\s*1fr;/, "1100px fallback should collapse shared multi-pane layouts");
  expectBlock(/@media \(max-width:\s*800px\)\s*\{[\s\S]*\.local-browser\s*\{[\s\S]*grid-template-columns:\s*1fr;/, "small-screen fallback should collapse the local browser layout");
  expectBlock(/\.overlay-panel,\s*[\s\S]*\.overlay-panel\.narrow,\s*[\s\S]*\.overlay-panel\.full\s*\{[\s\S]*width:\s*100%;[\s\S]*max-height:\s*calc\(100vh - 24px\);/, "overlay fallback should preserve full-width, bounded panels on small screens");
});
