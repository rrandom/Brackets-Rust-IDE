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
/*global define, $, brackets */

define(function (require, exports, module) {
    'use strict';

    var ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        NodeDomain = brackets.getModule('utils/NodeDomain'),
        NodeConnection = brackets.getModule('utils/NodeConnection');

    var RustHinterDomain;
    var nodeConnection = new NodeConnection();
    var connection = nodeConnection.connect(true);

    connection.done(function () {
        RustHinterDomain = new NodeDomain('RustHinter',
            ExtensionUtils.getModulePath(module, "node/RustHinterDomain"));
    });

    //
    var $deferred, cm, vpet = 0;

    // TO-DO
    function validToken(implicitChar) {
        return false;
    }

    // TO-DO
    function getLastToken() {
        return 'i';
    }

    function getHintsD(txt, cursor) {
        $deferred = new $.Deferred();
        console.info('Call RustHinterDomain');
        // TO-DO: cursor -> linenum, charnum
        RustHinterDomain.exec("getHint", txt, cursor, ++vpet)
            .fail(function (err) {
                console.error('[RustHinterDomain] Fail to get hints: ', err);
            });
        return $deferred;

    }

    // TO-DO
    function formatHints(data) {
        return data;
    }


    function RustHintProvider() {



        function resolveHint(data, petition) {
            if (petition === vpet) {
                $deferred.resolve({
                    hints: formatHints(data),
                    match: '',
                    selectInitial: true,
                    handleWideResults: false
                });
            }
        }



        this.hasHints = function (editor, implicitChar) {
            cm = editor._codeMirror;
            return validToken(implicitChar);
        };

        this.getHints = function (implicitChar) {
            console.info('Asking Hints');

            if (validToken(implicitChar)) {
                // cursor: {line, ch}
                var cursor = cm.getCursor(),
                    txt = cm.getValue();
                return getHintsD(txt, cursor);
            } else {
                return false;
            }

        };

        this.insertHint = function ($hint) {
            if (!$hint) {
                throw new TypeError("Must provide valid hint and hints object as they are returned by calling getHints");
            } else {
                // TO-DO: Consider these two lines, maybe don't need it
                var lasttoken = getLastToken();
                cm.replaceSelection($hint.data('token').substring(lasttoken.length));
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
                resolveHint(data, petition);
            }
        });
    }

    return RustHintProvider;

});