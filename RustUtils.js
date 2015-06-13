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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */


// modified from JSUtils.js in https://github.com/adobe/brackets/blob/5ef84133cb8c5acdcb7e80b85bbee86f65c2c9b1/src/language/JSUtils.js


// TO-DO: write unit-test
// see https://github.com/adobe/brackets/blob/5ef84133cb8c5acdcb7e80b85bbee86f65c2c9b1/test/spec/JSUtils-test.js
// and https://github.com/adobe/brackets/wiki/Debugging-Test-Windows-in-Unit-Tests


define(function (require, exports, module) {
    "use strict";

    var _ = brackets.getModule("thirdparty/lodash");
    //console.log(_);


    // Load brackets modules
    var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror"),

        Async = brackets.getModule("utils/Async"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        ChangedDocumentTracker = brackets.getModule("document/ChangedDocumentTracker"),
        FileSystem = brackets.getModule("filesystem/FileSystem"),
        FileUtils = brackets.getModule("file/FileUtils"),
        PerfUtils = brackets.getModule("utils/PerfUtils"),
        StringUtils = brackets.getModule("utils/StringUtils");


    /**
     * Tracks dirty documents between invocations of findMatchingFunctions.
     * @type {ChangedDocumentTracker}
     */
    // does not need now
    //var _changedDocumentTracker = new ChangedDocumentTracker();

    /**
     * Function matching regular expression. Recognizes the forms:
     * "function functionName()", "functionName = function()", and
     * "functionName: function()".
     *
     * Note: JavaScript identifier matching is not strictly to spec. This
     * RegExp matches any sequence of characters that is not whitespace.
     * @type {RegExp}
     */

    var _functionRegExp = /(extern\s+)?("((?:\\.|[^"\\])*)"\s+)?(fn\s+([$_A-Za-z\u007F-\uFFFF][$_A-Za-z0-9\u007F-\uFFFF]*)(<[^>]*>)?\s*(\([^)]*\)))/g;

    /**
     * @private
     * Return an object mapping function name to offset info for all functions in the specified text.
     * Offset info is an array, since multiple functions of the same name can exist.
     * @param {!string} text Document text
     * @return {Object.<string, Array.<{offsetStart: number, offsetEnd: number}>}
     */
    function _findAllFunctionsInText(text) {
        var results = {},
            functionName,
            match;

        PerfUtils.markStart(PerfUtils.RustUTILS_REGEXP);

        while ((match = _functionRegExp.exec(text)) !== null) {
            functionName = (match[2] || match[5]).trim();

            if (!Array.isArray(results[functionName])) {
                results[functionName] = [];
            }

            results[functionName].push({
                offsetStart: match.index
            });
        }

        PerfUtils.addMeasurement(PerfUtils.RustUTILS_REGEXP);

        return results;
    }

    // Given the start offset of a function definition (before the opening brace), find
    // the end offset for the function (the closing "}"). Returns the position one past the
    // close brace. Properly ignores braces inside comments, strings, and regexp literals.
    function _getFunctionEndOffset(text, offsetStart) {
        var mode = CodeMirror.getMode({}, "rust");
        var state = CodeMirror.startState(mode),
            stream, style, token;
        var curOffset = offsetStart,
            length = text.length,
            blockCount = 0,
            lineStart;
        var foundStartBrace = false;

        // Get a stream for the next line, and update curOffset and lineStart to point to the
        // beginning of that next line. Returns false if we're at the end of the text.
        function nextLine() {
            if (stream) {
                curOffset++; // account for \n
                if (curOffset >= length) {
                    return false;
                }
            }
            lineStart = curOffset;
            var lineEnd = text.indexOf("\n", lineStart);
            if (lineEnd === -1) {
                lineEnd = length;
            }
            stream = new CodeMirror.StringStream(text.slice(curOffset, lineEnd));
            return true;
        }

        // Get the next token, updating the style and token to refer to the current
        // token, and updating the curOffset to point to the end of the token (relative
        // to the start of the original text).
        function nextToken() {
            if (curOffset >= length) {
                return false;
            }
            if (stream) {
                // Set the start of the next token to the current stream position.
                stream.start = stream.pos;
            }
            while (!stream || stream.eol()) {
                if (!nextLine()) {
                    return false;
                }
            }
            style = mode.token(stream, state);
            token = stream.current();
            curOffset = lineStart + stream.pos;
            return true;
        }

        while (nextToken()) {
            if (style !== "comment" && style !== "regexp" && style !== "string") {
                if (token === "{") {
                    foundStartBrace = true;
                    blockCount++;
                } else if (token === "}") {
                    blockCount--;
                }
            }

            // blockCount starts at 0, so we don't want to check if it hits 0
            // again until we've actually gone past the start of the function body.
            if (foundStartBrace && blockCount <= 0) {
                return curOffset;
            }
        }

        // Shouldn't get here, but if we do, return the end of the text as the offset.
        return length;
    }


    /**
     * Finds all instances of the specified searchName in "text".
     * Returns an Array of Objects with start and end properties.
     *
     * @param text {!String} Rust text to search
     * @param searchName {!String} function name to search for
     * @return {Array.<{offset:number, functionName:string}>}
     *      Array of objects containing the start offset for each matched function name.
     */
    function findAllMatchingFunctionsInText(text, searchName) {
        var allFunctions = _findAllFunctionsInText(text);
        var result = [];
        var lines = text.split("\n");

        _.forEach(allFunctions, function (functions, functionName) {
            if (functionName === searchName || searchName === "*") {
                functions.forEach(function (funcEntry) {
                    var endOffset = _getFunctionEndOffset(text, funcEntry.offsetStart);
                    result.push({
                        name: functionName,
                        lineStart: StringUtils.offsetToLineNum(lines, funcEntry.offsetStart),
                        lineEnd: StringUtils.offsetToLineNum(lines, endOffset)
                    });
                });
            }
        });

        return result;
    }


    //PerfUtils.createPerfMeasurement("JSUTILS_GET_ALL_FUNCTIONS", "Parallel file search across project");
    PerfUtils.createPerfMeasurement("RustUTILS_REGEXP", "RegExp search for all functions");
    //PerfUtils.createPerfMeasurement("JSUTILS_END_OFFSET", "Find end offset for a single matched function");


    exports.findAllMatchingFunctionsInText = findAllMatchingFunctionsInText;
});
