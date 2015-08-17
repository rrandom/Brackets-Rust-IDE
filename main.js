/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true */
/*global define, $, brackets */

define(function (require, exports, module) {
	"use strict";

	var AppInit = brackets.getModule("utils/AppInit");

	var CodeHintManager = brackets.getModule("editor/CodeHintManager"),
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		QuickOpen = brackets.getModule("search/QuickOpen"),
		LanguageManager = brackets.getModule('language/LanguageManager');

	var RacerSettings = require("src/dialogs/RacerSettings"),
		RustHintProvider = require("src/RustHintProvider"),
		QuickOpenPlugin = require("src/QuickOpenPlugin"),
		SyntaxColoring = require("src/SyntaxColoring");

	function startup() {
		try {
			QuickOpen.addQuickOpenPlugin({
				name: "Rust functions",
				languageIds: ["rust"],
				search: QuickOpenPlugin.search,
				match: QuickOpenPlugin.match,
				itemFocus: QuickOpenPlugin.itemFocus,
				itemSelect: QuickOpenPlugin.itemSelect
			});

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

			ExtensionUtils.loadStyleSheet(module, "styles/main.css");
			var rustHintProvider = new RustHintProvider();
			console.info('Registering Rust Hint Provider');
			CodeHintManager.registerHintProvider(rustHintProvider, ["rust"], 10);
			console.info('Registered Rust Hint Provider');
		} catch (e) {
			console.error("Error starting up Rust hint provider", e);
			setTimeout(startup, 10000);
		}
	}

	AppInit.appReady(function () {

		startup();

	});

});
