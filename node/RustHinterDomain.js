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


/*
 * Docs to finish this file:
 * https://github.com/adobe/brackets/wiki/Brackets-Node-Process:-Overview-for-Developers
 * https://nodejs.org/api/child_process.html
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50,node: true */
/*global define, $, brackets */

(function () {
    "use strict";


    var _domainManager,
        spawn = require('child_process').spawn,
        exec = require('child_process').exec,
        extName = '[rust-ide]',
        racerPath = 'D:\\tmp\\emacs\\racer\\target\\release\\racer.exe';


    // TO-DO: hints cache
    // TO-DO: call racer correctly
    /**
     * @private
     * call outside racer
     * @param txt {string} current edit buffer/
     * @param linenum {number}
     * @param charnum {number}
     * @param petition {number}
     */
    function cmdGetHint(txt, linenum, charnum, petition) {
        console.info('cmdGetHint --> ');
        try {
            var racer = spawn(racerPath, ['complete',
                                          linenum,
                                         charnum,
                                          //TO-DO
                                         'tmp.racertmp']);
            var tmp = '';

            racer.stdin.write(txt);
            racer.stdin.end();

            racer.stdout.on('data', function (data) {
                tmp += data.toString();
            });

            racer.stderr.on('data', function (data) {
                console.info(extName + 'stderr: ' + data);
            });

            racer.on('close', function (code) {
                _domainManager.emitEvent('RustHinter', 'update', [tmp, petition]);
            });

            racer.unref();


        } catch (e) {
            console.error(extName + e);
        }
    }

    /**
     * Initializes the domain.
     * @param {DomainManager} domainManager The DomainManager for the server
     */
    function init(domainManager) {
        console.info('Rust NodeDomain init');
        if (!domainManager.hasDomain("RustHinter")) {
            domainManager.registerDomain("RustHinter", {
                major: 0,
                minor: 1
            });
        }

        //TO-DO
        domainManager.registerCommand(
            "RustHinter",
            "getHint",
            cmdGetHint,
            false,
            "Return Rust Hints", [], []
        );

        //TO-DO
        domainManager.registerEvent(
            "RustHinter",
            "update", []
        );

        _domainManager = domainManager;

    }

    exports.init = init;

}());