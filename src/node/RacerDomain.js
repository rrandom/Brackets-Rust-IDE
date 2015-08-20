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
 * https://github.com/adobe/brackets/wiki/Brackets-Node-Process:-Overview-for-Developers
 * https://nodejs.org/api/child_process.html
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50,node: true */
/*global define, $, brackets */


(function () {
    "use strict";

    var _domainManager,
        Child_process = require('child_process'),
        fs = require('fs'),
        domainName = 'RacerDomain',
        extName = '[rust-ide]';


    // args: {txt, line, char, path, command, event}
    function racerCli(racerPath, args, petition) {
        try {
            var tmpFile = args.path + 'tmp.racertmp',
                output = '';
            fs.writeFileSync(tmpFile, args.txt);

            var racer = Child_process.spawn(
                racerPath, [args.command, args.line, args.char, tmpFile]
            );

            racer.stdout.on('data', function (data) {
                output += data.toString();
            });

            racer.stderr.on('data', function (e) {
                console.info(extName + 'stderr: ' + e);
            });

            racer.on('close', function (code) {
                _domainManager.emitEvent(domainName, args.event, [output, petition]);
            });

            racer.unref();
        } catch (e) {
            console.error(extName + e);
        }
    }

    // args: {txt, line, char, path}
    function cmdGetHint(racerPath, args, petition) {
        args.command = 'complete';
        args.event = 'hintUpdate';
        racerCli(racerPath, args, petition);
    }

    function cmdFindDefinition(racerPath, args, petition) {
        args.command = 'find-definition';
        args.event = 'defFound';
        racerCli(racerPath, args, petition);
    }

    function init(domainManager) {
        console.info('Rust NodeDomain init');
        if (!domainManager.hasDomain(domainName)) {
            domainManager.registerDomain(domainName, {
                major: 0,
                minor: 1
            });
        }

        domainManager.registerCommand(
            domainName, // domain name
            "getHint", // command name
            cmdGetHint, // command handler function
            false, // asynchronous
            "Return Rust Hints", [
                {
                    name: "racerPath",
                    type: "string",
                    description: "absolute path to racer"
                },
                {
                    name: "args",
                    type: "object",
                    description: "{txt, line, char, path}"
                },
                {
                    name: "petition",
                    type: "number",
                    description: "petition number"
                }
            ], []
        );

        domainManager.registerCommand(
            domainName,
            "findDef",
            cmdFindDefinition,
            false,
            "Return found definitions", [
                {
                    name: "racerPath",
                    type: "string",
                    description: "absolute path to racer"
                },
                {
                    name: "args",
                    type: "object",
                    description: "{txt, line, char, path}"
                },
                {
                    name: "petition",
                    type: "number",
                    description: "petition number"
                }
            ], []
        );

        domainManager.registerEvent(
            domainName,
            "defFound", [{
                name: "data",
                type: "string"
            }, {
                name: "petition",
                type: "number"
            }]
        );
        domainManager.registerEvent(
            domainName,
            "hintUpdate", [{
                name: "data",
                type: "string"
            }, {
                name: "petition",
                type: "number"
            }]
        );

        _domainManager = domainManager;

    }

    exports.init = init;

}());
