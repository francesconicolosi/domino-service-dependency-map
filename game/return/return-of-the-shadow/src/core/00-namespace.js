// ============================================================================
//  core/00-namespace.js — shared foundation, loaded FIRST (after love-shim.js)
//
//  The game is split across several plain classic <script> files. Classic
//  scripts loaded into the same page share ONE top-level lexical scope, so a
//  top-level `const`/`let`/`function` declared here (or in any earlier-loaded
//  file) is visible by bare name in every file loaded after it. That is the
//  mechanism the whole split relies on — no bundler, no ES modules.
//
//  Only put things here that the rest of the game references engine-wide.
// ============================================================================
'use strict';

// The single explicit namespace. Kept intentionally small: it holds the level
// registry (level number -> {plats, init, update, draw, ...}) and re-homes the
// read-only verification hooks. Everything else is shared via the top-level
// lexical scope described above, NOT hung off this object.
window.RTS = window.RTS || { levels: {} };

// Graphics shorthand used throughout the codebase (love.graphics is created by
// love-shim.js, which loads before this file). Declared once here and shared
// by name with every later script.
const lg = love.graphics;
