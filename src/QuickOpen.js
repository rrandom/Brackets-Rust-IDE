/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true */
/*global define, $, brackets */

define(function (require, exports, module) {
	"use strict";
	var EditorManager = brackets.getModule("editor/EditorManager"),
		QuickOpen = brackets.getModule("search/QuickOpen"),
		DocumentManager = brackets.getModule("document/DocumentManager"),
		StringMatch = brackets.getModule("utils/StringMatch");

	var RustUtils = require("src/RustUtils");


	/**
	 * FileLocation class
	 * @constructor
	 * @param {string} fullPath
	 * @param {number} line
	 * @param {number} chFrom column start position
	 * @param {number} chTo column end position
	 * @param {string} functionName
	 */
	function FileLocation(fullPath, line, chFrom, chTo, functionName) {
		this.fullPath = fullPath;
		this.line = line;
		this.chFrom = chFrom;
		this.chTo = chTo;
		this.functionName = functionName;
	}


	/**
	 * Contains a list of information about functions for a single document.
	 *
	 * @return {?Array.<FileLocation>}
	 */
	function createFunctionList() {
		var doc = DocumentManager.getCurrentDocument();
		if (!doc) {
			return;
		}

		var functionList = [];
		var docText = doc.getText();
		var lines = docText.split("\n");
		var functions = RustUtils.findAllMatchingFunctionsInText(docText, "*");
		functions.forEach(function (funcEntry) {
			var chFrom = lines[funcEntry.lineStart].indexOf(funcEntry.name);
			var chTo = chFrom + funcEntry.name.length;
			functionList.push(new FileLocation(null, funcEntry.lineStart, chFrom, chTo, funcEntry.name));
		});
		return functionList;
	}

	/**
	 * @param {string} query what the user is searching for
	 * @param {StringMatch.StringMatcher} matcher object that caches search-in-progress data
	 * @return {Array.<SearchResult>} sorted and filtered results that match the query
	 */
	function search(query, matcher) {
		var functionList = matcher.functionList;
		if (!functionList) {
			functionList = createFunctionList();
			matcher.functionList = functionList;
		}
		query = query.slice(query.indexOf("@") + 1, query.length);

		// Filter and rank how good each match is
		var filteredList = $.map(functionList, function (fileLocation) {
			var searchResult = matcher.match(fileLocation.functionName, query);
			if (searchResult) {
				searchResult.fileLocation = fileLocation;
			}
			return searchResult;
		});

		// Sort based on ranking & basic alphabetical order
		StringMatch.basicMatchSort(filteredList);

		return filteredList;
	}

	/**
	 * @param {string} query what the user is searching for
	 * @param {boolean} returns true if this plug-in wants to provide results for this query
	 */
	function match(query) {
		// only match @ at beginning of query for now
		return (query[0] === "@");
	}

	/**
	 * Scroll to the selected item in the current document (unless no query string entered yet,
	 * in which case the topmost list item is irrelevant)
	 * @param {?SearchResult} selectedItem
	 * @param {string} query
	 * @param {boolean} explicit False if this is only highlighted due to being at top of list after search()
	 */
	function itemFocus(selectedItem, query, explicit) {
		if (!selectedItem || (query.length < 2 && !explicit)) {
			return;
		}
		var fileLocation = selectedItem.fileLocation;

		var from = {
			line: fileLocation.line,
			ch: fileLocation.chFrom
		};
		var to = {
			line: fileLocation.line,
			ch: fileLocation.chTo
		};
		EditorManager.getCurrentFullEditor().setSelection(from, to, true);

	}

	function itemSelect(selectedItem, query) {
		itemFocus(selectedItem, query, true);

	}


	QuickOpen.addQuickOpenPlugin({
		name: "Rust functions",
		languageIds: ["rust"],
		search: search,
		match: match,
		itemFocus: itemFocus,
		itemSelect: itemSelect

	});
});
