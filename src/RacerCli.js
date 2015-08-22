/**
 *
 * Licensed under MIT
 *
 * Modified from https://github.com/David5i6/Brackets-Go-IDE
 *
 *
 *  https://codemirror.net/doc/manual.html
 *  https://github.com/adobe/brackets/wiki/Brackets-Node-Process:-Overview-for-Developers
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true */
/*global define, $, brackets */


define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        NodeDomain = brackets.getModule('utils/NodeDomain'),
        NodeConnection = brackets.getModule('utils/NodeConnection'),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    var RacerDomain,
        nodeConnection = new NodeConnection(),
        connection = nodeConnection.connect(true),
        extPath = ExtensionUtils.getModulePath(module),
        prefs = PreferencesManager.getExtensionPrefs("Rust-IDE");


    connection.done(function () {
        RacerDomain = new NodeDomain('RacerDomain',
            ExtensionUtils.getModulePath(module,
                "node/RacerDomain"));
    });


    function getHintsD(txt, pos, vpet) {
        var args = {
            txt: txt,
            line: pos.line + 1,
            char: pos.ch,
            path: extPath
        };
        console.log('prefs.get():', prefs.get("racerPath"));
        console.log('args:', args);
        console.log('vpet:', vpet);
        RacerDomain.exec("getHint", prefs.get("racerPath"), args, vpet).fail(function (err) {
            console.error('[RacerDomain] Fail to get hints: ', err);
        });
    }

    function getDefD(txt, pos, vpet) {
        var args = {
            txt: txt,
            line: pos.line + 1,
            char: pos.ch,
            path: extPath
        };
        var $deferred = new $.Deferred();
        RacerDomain.exec("findDef", prefs.get("racerPath"), args, vpet).fail(function (err) {
            console.error('[RacerDomain] Fail to get Def: ', err);
        });
        return $deferred;
    }


    function parse(str) {
        var result;
        try {
            var tmp = str.split(',');
            result = {
                name: tmp[0].split(' ')[1],
                line: tmp[1],
                char: tmp[2],
                path: tmp[3],
                type: tmp[4],
                first_line: tmp[5]
            };
        } catch (e) {
            console.error("[RacerDomain] Error when parse: ", e);
        }
        return result;

    }


    exports.nodeConnection = nodeConnection;
    exports.getHintsD = getHintsD;
    exports.getDefD = getDefD;
    exports.parse = parse;
});
