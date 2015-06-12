/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

define(function (require, exports, module) {
    "use strict";

    var EditorManager = brackets.getModule("editor/EditorManager"),
        QuickOpen = brackets.getModule("search/QuickOpen"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        StringMatch = brackets.getModule("utils/StringMatch"),
        RustUtils = require("RustUtils");


    // TO-DO  fill below
    function search(query, matcher) {}

    function match(query) {}

    function itemFocus(selectedItem, query, explicit) {}

    function itemSelect(selectedItem, query) {}


    QuickOpen.addQuickOpenPlugin({
        name: "Rust functions",
        languageIds: ["rust"],
        search: search,
        match: match,
        itemFocus: itemFocus,
        itemSelect: itemSelect

    });
});
