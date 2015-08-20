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


/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true */
/*global define, $, brackets */

define(function (require, exports, module) {
    'use strict';

    var MultiRangeInlineEditor = brackets.getModule("editor/MultiRangeInlineEditor").MultiRangeInlineEditor,
        DocumentManager = brackets.getModule("document/DocumentManager"),
        FileSystem = brackets.getModule('filesystem/FileSystem'),
        _ = brackets.getModule("thirdparty/lodash");

    var RacerCli = require('src/RacerCli');
    var vpet = 0;

    function RustHintProvider() {

        var _prefix, _cm, _lastToken,
            _needNewHints = true,
            _cachedHints = null,
            _previousTokenStr = "--dummy--",
            // keywords: https://doc.rust-lang.org/grammar.html#keywords
            _rust_keywords = ["abstract", "alignof", "as", "become", "box", "break",
                         "const", "continue", "crate", "do", "else", "enum",
                         "extern", "false", "final", "fn", "for", "if", "impl",
                         "in", "let", "loop", "macro", "match", "mod", "move",
                         "mut", "offsetof", "override", "priv", "proc", "pub",
                         "pure", "ref", "return", "Self", "self", "sizeof", "static",
                         "struct", "super", "trait", "true", "type", "typeof", "unsafe",
                         "unsized", "use", "virtual", "where", "while", "yield"],
            // std library macros: https://doc.rust-lang.org/nightly/std/index.html#macros
            _std_macros = ["assert!", "assert_eq!", "cfg!", "column!", "concat!",
					  "contat_idents!", "debug_assert!", "debug_assert_eq!",
					  "env!", "file!", "format!", "format_args!", "include!",
					  "include_bytes!", "include_str!", "line!", "module_path!",
					  "option_env!", "panic!", "print!", "println!", "scoped_thread_local!",
					  "select!", "stringify!", "thread_local!", "try!", "unimplemented!",
					  "unreachable!", "vec!", "write!", "writeln!"],
            _end_tokens = [' ', '+', '-', '/', '*', '(', ')', '[', ']', ':', ',', '<', '>', '.', '{', '}'];

        function _extractHints(data) {
            var i, t,
                rs = [],
                ta = data.split('\n');

            _prefix = ta.shift().split(',').pop();
            ta.pop();

            try {
                ta.pop();
                rs = ta.map(function (i) {
                    return RacerCli.resolve(i).name;
                });
            } catch (e) {
                console.error('[RustHintProvider] extractHints: Please notify me if you see this error');
                console.error('error:', e);
            }
            return _.uniq(rs);
        }

        function _validToken(implicitChar) {
            if (implicitChar) {
                var code = implicitChar.charCodeAt(0);
                return (_end_tokens.indexOf(implicitChar) === -1) && (code !== 13) && (code !== 9);
            } else {
                return false;
            }
        }

        function _resolveHint(data, petition) {
            if (petition === vpet) {
                var racerHintsList = _extractHints(data);
                _cachedHints = racerHintsList;
            }
        }

        function _resolveCachedHint(cachedHints, token) {
            _prefix = token.string;

            var hintsList = cachedHints.concat(_rust_keywords, _std_macros);
            var filteredHints = hintsList.filter(function (h) {
                return h.substring(0, _prefix.length) === _prefix;
            }).map(function (h) {
                if (_.contains(_rust_keywords, h)) {
                    return $('<span>').addClass("RustIDE-hints")
                        .addClass("RustIDE-hints-keywords")
                        .text(h);

                } else if (_.contains(_std_macros, h)) {
                    return $('<span>').addClass("RustIDE-hints")
                        .addClass("RustIDE-hints-macros")
                        .text(h);
                } else {
                    return $('<span>').addClass("RustIDE-hints")
                        .addClass("RustIDE-hints-fn")
                        .text(h);
                }
            });

            return {
                hints: filteredHints,
                match: '',
                selectInitial: true,
                handleWideResults: false
            };
        }

        this.hasHints = function (editor, implicitChar) {
            _cm = editor._codeMirror;
            if (_validToken(implicitChar)) {
                return true;
            } else {
                _needNewHints = true;
                _cachedHints = null;
                return false;
            }
        };

        this.getHints = function (implicitChar) {

            var cursor = _cm.getCursor(),
                txt = _cm.getValue();
            _lastToken = _cm.getTokenAt(cursor);

            //implicitChar is null when press Backspace
            if (_validToken(implicitChar) || _validToken(_lastToken.string)) {
                var tokenType = _lastToken.type;
                if (['string', 'comment', 'meta', 'def'].indexOf(tokenType) > -1) {
                    return false;
                } else {
                    if ((_needNewHints) || (_previousTokenStr[0] !== _lastToken.string[0])) {
                        console.info('Asking Hints');
                        _needNewHints = true;
                        _cachedHints = null;
                        _previousTokenStr = _lastToken.string;
                        return RacerCli.getHintsD(txt, cursor, ++vpet);
                    }

                    if (_cachedHints) {
                        return _resolveCachedHint(_cachedHints, _lastToken);

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
                console.info('$hint: ' + $hint.text());
                _cm.replaceSelection($hint.text().substring(_prefix.length));
            }
        };

        $(RacerCli.nodeConnection).on("RacerDomain:hintUpdate", function (evt, data, petition) {
            if (petition === vpet) {
                if (data === 'PANIC PANIC PANIC\n') {
                    data = '';
                }
                console.info('#### On update event, data: ' + data);
                if (data) {
                    _needNewHints = false;
                    _resolveHint(data, petition);
                } else {
                    console.warn("No matching");
                }
            }
        });
    }

    function RustDefinitionProvider() {

        var _$deferred;

        function _resolveDef(data, hostEditor) {
            var defs = data.split('\n'),
                // only resolve the first match for simplicity
                fun_item = RacerCli.resolve(defs[0]),
                path = fun_item.path;

            console.log('path:', path);
            if (!FileSystem.isAbsolutePath(path)) {
                path = path.split('\\').join('/');
            }

            DocumentManager.getDocumentForPath(path).done(function (doc) {

                var lineStart = Number(fun_item.line),
                    lineEnd = lineStart + 10;

                console.log('doc:\n', doc);

                var ranges = [{
                    document: doc,
                    name: name,
                    lineStart: lineStart - 1,
                    lineEnd: lineEnd
                }];
                try {
                    var rustInlineEditor = new MultiRangeInlineEditor(ranges);
                    rustInlineEditor.load(hostEditor);
                    _$deferred.resolve(rustInlineEditor);
                } catch (e) {
                    console.error("[RustDefinitionProvidre] Error of get def", e);
                }
            }).fail(function (e) {
                console.error('[RustDefinitionProvidre] Error of get from path e:', e);
            });
        }

        this.provider = function (hostEditor, pos) {
            if (["text/x-rustsrc", "rust"].indexOf(hostEditor.getModeForSelection()) > -1) {
                return null;
            }
            var sel = hostEditor.getSelection();
            if (sel.start.line !== sel.end.line) {
                return null;
            }
            // may change to not use codemirror api
            var txt = hostEditor._codeMirror.getValue();

            $(RacerCli.nodeConnection).on("RacerDomain:defFound", function (evt, data, petition) {
                if (data === 'PANIC PANIC PANIC\n') {
                    data = '';
                }
                console.info('#### On defFind event, data: ' + data);
                if (data) {
                    _resolveDef(data, hostEditor);
                } else {
                    console.warn("Not Found Definition");
                }
            });
            _$deferred = RacerCli.getDefD(txt, sel.start, ++vpet);
            return _$deferred;
        };
    }

    exports.RustHintProvider = RustHintProvider;
    exports.RustDefinitionProvider = RustDefinitionProvider;

});
