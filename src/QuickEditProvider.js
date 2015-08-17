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


/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    var EditorManager = brackets.getModule("editor/EditorManager");


    function RustDefinitionProvider(hostEditor, pos){
        console.log("Call find def --> ");
        console.log('hostEditor.getModeForSelection():', hostEditor.getModeForSelection());
        if (hostEditor.getModeForSelection() !== "text/x-rustsrc") {
            return null;
        }

        var sel = hostEditor.getSelection();
        console.dir('sel:', sel);
        if (sel.start.line !== sel.end.line) {
            return null;
        }

        // may change to not use codemirror api
        var txt = hostEditor._codeMirror.getValue();
        console.log('txt:', txt);


        /*
        var functionResult = _getFunctionName(hostEditor, sel.start);
        if (!functionResult.functionName) {
            return functionResult.reason || null;
        }

        return _createInlineEditor(hostEditor, functionResult.functionName);
        */
        console.log('sel.start:', sel.start);
        return null;
    }


    EditorManager.registerInlineEditProvider(RustDefinitionProvider);
});
