(function () {
    "use strict";

    var Child_process = require('child_process');


    function cmdLint(exec, cb){
        Child_process.exec(exec, function(err, stdout, stderr) {
            cb(null, stderr + stdout);
        });
    }

    function init(domainManager) {
        if (!domainManager.hasDomain('RustLintDomain')) {
            domainManager.registerDomain('RustLintDomain', {
                major: 0,
                minor: 1
            });
        }

        domainManager.registerCommand('RustLintDomain', 'lint', cmdLint, true);

    }

    exports.init = init;
})
