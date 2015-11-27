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


/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50,node: true */


(function () {
    "use strict";

    var _domainManager,
        child_process = require("child_process"),
        fs = require("fs"),
        domainName = "RacerDomain",
        extName = "[rust-ide]";


    // args: {txt, line, char, path, isPathTmp, command, event}
    function racerCli(racerPath, args, petition, cb) {
        try {
            var fname = args.path,
                output = "",
                err = "";

            // use tmp file or not
            if (args.isPathTmp) {
                fname = fname + "tmp.racertmp";
                fs.writeFileSync(fname, args.txt);
            }

            var racer = child_process.spawn(
                racerPath, [args.command, args.line, args.char, fname]
            );

            racer.stdout.on("data", function (data) {
                output += data.toString();
            });

            racer.stderr.on("data", function (data) {
                err += data.toString();
            });

            racer.on("close", function (code) {
                cb(err, output);
            });

            racer.unref();

        } catch (e) {
            console.error(extName + e);
        }
    }

    // args: {txt, line, char, path}
    function cmdGetHint(racerPath, args, petition, cb) {
        args.command = "complete";
        racerCli(racerPath, args, petition, cb);
    }

    function cmdFindDefinition(racerPath, args, petition, cb) {
        args.command = "find-definition";
        racerCli(racerPath, args, petition, cb);
    }

    function init(domainManager) {
        console.info("Rust NodeDomain init");
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
            true, // asynchronous
            "Return Rust Hints", [
                {
                    name: "racerPath",
                    type: "string",
                    description: "absolute path to racer"
                },
                {
                    name: "args",
                    type: "object",
                    description: "{txt, line, char, path, isPathTmp}"
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
            true,
            "Return found definitions", [
                {
                    name: "racerPath",
                    type: "string",
                    description: "absolute path to racer"
                },
                {
                    name: "args",
                    type: "object",
                    description: "{txt, line, char, path, isPathTmp}"
                },
                {
                    name: "petition",
                    type: "number",
                    description: "petition number"
                }
            ], []
        );

        _domainManager = domainManager;

    }

    exports.init = init;

}());
