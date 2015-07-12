/**
 *
 * Licensed under MIT
 *
 * Modified from https://github.com/David5i6/Brackets-Go-IDE
 *
 * Docs to finish this file:
 *  https://codemirror.net/doc/manual.html
 *  https://github.com/adobe/brackets/wiki/Brackets-Node-Process:-Overview-for-Developers
 *
 */


/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, Mustache */

define(function (require, exports, module) {
    'use strict';

    var _ = brackets.getModule("thirdparty/lodash");

    var ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        NodeDomain = brackets.getModule('utils/NodeDomain'),
        NodeConnection = brackets.getModule('utils/NodeConnection'),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        prefs = PreferencesManager.getExtensionPrefs("Rust-IDE"),
        CommandManager = brackets.getModule("command/CommandManager"),
        Menus = brackets.getModule("command/Menus"),
        Commands = brackets.getModule("command/Commands"),
        Dialogs = brackets.getModule("widgets/Dialogs");

    var RustHinterDomain;
    var nodeConnection = new NodeConnection();
    var connection = nodeConnection.connect(true);

    connection.done(function () {
        RustHinterDomain = new NodeDomain('RustHinter',
            ExtensionUtils.getModulePath(module, "node/RustHinterDomain"));
    });

    prefs.definePreference("racerPath", "string", "");

    // this function copied and modifitied from zaggino.brackets-git
    function showRustIDEDialog() {
        var questionDialogTemplate = require("text!templates/rust-ide-settings.html");
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: "Rust-IDE Settings",
            question: "Set your racer path",
            defaultValue: prefs.get("racerPath"),
            BUTTON_CANCEL: "Cancel",
            BUTTON_OK: "OK"
        });
        var dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate);
        dialog.done(function (buttonId) {
            if (buttonId === "ok") {
                console.info("you click ok");
                var $dialog = dialog.getElement();
                $("*[settingsProperty]", $dialog).each(function () {
                    var $this = $(this);
                    prefs.set("racerPath", $this.val().trim());
                });
            }
        });
        prefs.save();
    }


    // First, register a command - a UI-less object associating an id to a handler
    var RUST_IDE_SETTINGS = "rustide.settings"; // package-style naming to avoid collisions
    CommandManager.register("Rust-IDE Settings", RUST_IDE_SETTINGS, showRustIDEDialog);

    // Then create a menu item bound to the command
    // The label of the menu item is the name we gave the command (see above)
    var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
    menu.addMenuItem(RUST_IDE_SETTINGS, "", Menus.AFTER, Commands.FILE_PROJECT_SETTINGS);

    //
    var prefix, $deferred, cm,
        needNewHints = true,
        cachedHints = null,
        previousTokenStr = "--dummy--",
        lastToken,
        vpet = 0,
        extPath = ExtensionUtils.getModulePath(module);

    var endtokens = [' ', '+', '-', '/', '*', '(', ')', '[', ']', ':', ',', '<', '>', '.', '{', '}'];

    function validToken(implicitChar) {
        if (implicitChar) {
            var code = implicitChar.charCodeAt(0);
            return (endtokens.indexOf(implicitChar) === -1) && (code !== 13) && (code !== 9);
        } else {
            return false;
        }
    }

    function getHintsD(txt, cursor) {
        $deferred = new $.Deferred();
        RustHinterDomain.exec("getHint", prefs.get("racerPath"), txt, (cursor.line + 1), cursor.ch, extPath, ++vpet)
            .fail(function (err) {
                console.error('[RustHinterDomain] Fail to get hints: ', err);
            });
        return $deferred;
    }

    function formatHints(data) {
        var i, t,
            rs = [],
            ta = data.split('\n');

        prefix = ta.shift().split(',').pop();
        ta.pop();

        rs = ta.map(function (i) {
            return (/MATCH ([^,]+),(\d)/.exec(i)[1]);
        });
        return _.uniq(rs);
    }


    function RustHintProvider() {

        function resolveHint(data, petition) {
            if (petition === vpet) {
                var formatedHints = formatHints(data);
                cachedHints = formatedHints;
                $deferred.resolve({
                    hints: formatedHints,
                    match: '',
                    selectInitial: true,
                    handleWideResults: false
                });
            }
        }

        //
        function resolveCachedHint(cachedHints, token) {
            prefix = token.string;
            var filteredHints = cachedHints.filter(function (h) {
                return h.substring(0, prefix.length) === prefix;
            });
            return {
                hints: filteredHints,
                match: '',
                selectInitial: true,
                handleWideResults: false
            };
        }


        this.hasHints = function (editor, implicitChar) {
            cm = editor._codeMirror;
            if (validToken(implicitChar)) {
                return true;
            } else {
                needNewHints = true;
                cachedHints = null;
                return false;
            }
        };

        this.getHints = function (implicitChar) {
            if (validToken(implicitChar)) {
                var cursor = cm.getCursor(),
                    txt = cm.getValue();

                lastToken = cm.getTokenAt(cursor);
                var tokenType = lastToken.type;

                if ((tokenType === 'string') || (tokenType === 'comment')) {
                    return false;
                } else {
                    if ((needNewHints) || (previousTokenStr[0] !== lastToken.string[0])) {
                        console.info('Asking Hints');
                        needNewHints = true;
                        cachedHints = null;
                        previousTokenStr = lastToken.string;
                        return getHintsD(txt, cursor);
                    }

                    if (cachedHints) {
                        return resolveCachedHint(cachedHints, lastToken);

                    }
                    return false;
                }
            } else {
                return false;
            }

        };

        this.insertHint = function ($hint) {
            if (!$hint) {
                throw new TypeError("Must provide valid hint and hints object as they are returned by calling getHints");
            } else {
                console.info('$hint: ' + $hint);
                cm.replaceSelection($hint.substring(prefix.length));
            }
        };


        /**
         * When domain send the update event (and only if there're no multiple version events...
         * Format the response and resolve the promise.
         */
        $(nodeConnection).on("RustHinter:update", function (evt, data, petition) {
            if (petition === vpet) {
                if (data === 'PANIC PANIC PANIC\n') {
                    data = '';
                }
                console.info('#### On update event, data: ' + data);
                if (data) {
                    needNewHints = false;
                    resolveHint(data, petition);
                } else {
                    console.warn("No matching");
                }
            }
        });
    }

    return RustHintProvider;

});
