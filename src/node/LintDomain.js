/**
 *
 * Licensed under MIT
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50,node: true */

(function () {
    "use strict";

    var child_process = require("child_process");

    function _cmdGetLint(exec, cb) {
        child_process.exec(exec, function (err, stdout, stderr) {
            cb(null, stderr + stdout);
        });
    }

    function init(manager) {
        if (!manager.hasDomain("rustLint")) {
            manager.registerDomain("rustLint", {
                major: 1,
                minor: 0
            });
        }

        manager.registerCommand(
            "rustLint",
            "getLint",
            _cmdGetLint,
            true // true then `cb()`, false then `return`
        );
    }

    exports.init = init;

}());
