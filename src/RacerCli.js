/**
 *
 * Licensed under MIT
 *
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true */
/*global define, $, brackets */


define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        NodeDomain = brackets.getModule("utils/NodeDomain"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    var RacerDomain,
        extPath = ExtensionUtils.getModulePath(module),
        prefs = PreferencesManager.getExtensionPrefs("Rust-IDE");


    RacerDomain = new NodeDomain("RacerDomain",
        ExtensionUtils.getModulePath(module,
            "node/RacerDomain"));


    function getHintsD(txt, pos, vpet) {
        var args = {
            txt: txt,
            line: pos.line + 1,
            char: pos.ch,
            path: extPath,
            isPathTmp: true
        };
        var $deferred = new $.Deferred();
        RacerDomain.exec("getHint", prefs.get("racerPath"), args, vpet).done(function (data) {
            $deferred.resolve(data);
        }).fail(function (err) {
            console.error("[RacerDomain] Fail to get hints: ", err);
        });
        return $deferred.promise();
    }

    function getDefD(txt, pos, vpet, path) {
        var args = {
            txt: txt,
            line: pos.line,
            char: pos.ch,
            path: path,
            isPathTmp: false
        };
        var $deferred = new $.Deferred();
        RacerDomain.exec("findDef", prefs.get("racerPath"), args, vpet).done(function (data) {
            $deferred.resolve(data);
        }).fail(function (err) {
            console.error("[RacerDomain] Fail to get Def: ", err);
        });
        return $deferred.promise();
    }


    function parse(str) {
        var result;
        try {
            var tmp = str.split(",");
            result = {
                str: tmp[0].split(" ")[1],
                line: tmp[1],
                char: tmp[2],
                path: tmp[3],
                type: tmp[4],
                firstLine: tmp[5]
            };
        } catch (e) {
            console.error("[RacerDomain] Error when parse: ", e);
        }
        return result;

    }

    exports.getHintsD = getHintsD;
    exports.getDefD = getDefD;
    exports.parse = parse;
});
