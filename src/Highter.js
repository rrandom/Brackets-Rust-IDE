/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true */
/*global define, $, brackets */

define(function (require, exports, module) {
	"use strict";

	// Since brackets 1.4 will enable defineSimpleMode of CodeMirror, and the CodeMirror
	// rust.js is old, I write a new rust.js with defineSimpleMode, this line will be deleted
	// when the new version of brackets or the new version of codemirror release.
	require("src/CodeMirror/rust");

	var LanguageManager = brackets.getModule('language/LanguageManager');

	LanguageManager.defineLanguage('rust', {
		name: 'Rust',
		mode: ["rust", "text/x-rustsrc"],
		fileExtensions: ['rs'],
		blockComment: ['/*', '*/'],
		lineComment: ['//']
	});

	LanguageManager.defineLanguage('toml', {
		name: 'toml',
		mode: ["toml", "text/x-toml"],
		fileExtensions: ['toml'],
		lineComment: ['#']
	});
});
