/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

define(function (require, exports, module) {
    'use strict';

    console.log("entering rusthintprovider");


    function RustHintProvider() {
        this.hasHints = function (editor, implicitChar) {};
        this.getHints = function (implicitChar) {};
        this.insertHint = function (hint) {};
    }

    return RustHintProvider;

});
