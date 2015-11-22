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
        CodeMirror = brackets.getModule("thirdparty/CodeMirror/lib/codemirror"),
        _ = brackets.getModule("thirdparty/lodash");

    var RacerCli = require('src/RacerCli');

    var vpet = 0;

    // TO-DO: css style for different hint type
    function RustHintProvider() {

        var _prefix, _cm, _lastToken,
            _needNewHints = true,
            _cachedHints = null,
            _previousTokenStr = "--dummy--",
            // keywords: https://doc.rust-lang.org/grammar.html#keywords
            _rustKeywords = ["abstract", "alignof", "as", "become", "box", "break",
                         "const", "continue", "crate", "do", "else", "enum",
                         "extern", "false", "final", "fn", "for", "if", "impl",
                         "in", "let", "loop", "macro", "match", "mod", "move",
                         "mut", "offsetof", "override", "priv", "proc", "pub",
                         "pure", "ref", "return", "Self", "self", "sizeof", "static",
                         "struct", "super", "trait", "true", "type", "typeof", "unsafe",
                         "unsized", "use", "virtual", "where", "while", "yield"],
            // std library macros: https://doc.rust-lang.org/nightly/std/index.html#macros
            _stdMacros = ["assert!", "assert_eq!", "cfg!", "column!", "concat!",
					  "contat_idents!", "debug_assert!", "debug_assert_eq!",
					  "env!", "file!", "format!", "format_args!", "include!",
					  "include_bytes!", "include_str!", "line!", "module_path!",
					  "option_env!", "panic!", "print!", "println!", "scoped_thread_local!",
					  "select!", "stringify!", "thread_local!", "try!", "unimplemented!",
					  "unreachable!", "vec!", "write!", "writeln!"],
            _endTokens = [' ', '+', '-', '/', '*', '(', ')', '[', ']', ',', '<', '>', '.', '{', '}'];

        var auxiliaryHints = _rustKeywords.map(function (s) {
            return {
                str: s,
                type: 'Keyword'
            };
        }).concat(_stdMacros.map(function (s) {
            return {
                str: s,
                type: 'Macro'
            };
        }));

        function _extractHints(data) {
            var rs = [],
                ta = data.split(/(?:\r\n|\r|\n)/g);

            _prefix = ta.shift().split(',').pop();
            ta.pop();

            try {
                ta.pop();
                rs = ta.map(function (i) {
                    return RacerCli.parse(i);
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
                return (_endTokens.indexOf(implicitChar) === -1) && (code !== 13) && (code !== 9);
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
            var hintsList = cachedHints.concat(auxiliaryHints),
                results = [];

            for (var i = 0; i < hintsList.length; i++) {
                if (_.startsWith(hintsList[i].str, _prefix)) {
                    results.push($('<span>').addClass('RustIDE-hints')
                        .addClass('RustIDE-hints-' + hintsList[i].type)
                        .text(hintsList[i].str));
                }
            }
            return {
                hints: results,
                match: '',
                selectInitial: true,
                handleWideResults: false
            };
        }

        this.hasHints = function (editor, implicitChar) {
            _cm = editor._codeMirror;
            if (_validToken(implicitChar)) {
                console.log('hasHints');
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
                console.log('_lastToken:', _lastToken);
                if (['string', 'comment', 'meta', 'def'].indexOf(tokenType) > -1) {
                    return false;
                } else {
                    console.log('_needNewHints:', _needNewHints);
                    if ((_needNewHints) || (_previousTokenStr[0] !== _lastToken.string[0]) || implicitChar === ':') {
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

        RacerCli.nodeConnection.on("RacerDomain:hintUpdate", function (evt, data, petition) {
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

        // FIX-ME: use CodeMirror findMatchingBracket method to find end line.
        // have bug
        // CodeMirror' line and ch both start from 0, but brackets' start from 1, so is racer's
        function _getDefEndLine(txt, startLine, ch) {
            var result,
                tmpCm = CodeMirror($('<tmpdiv>')[0], {
                    value: txt,
                    mode: 'rust'
                });

            var pos = CodeMirror.Pos(startLine-1, ch-1);
            console.log('pos:', pos);

            console.log('Token:', tmpCm.getTokenAt(pos));

            result = tmpCm.findMatchingBracket(pos, false);

            console.log('result', result);

            if (result) {
                return result.to.line + 1;
            } else {
                console.log('error when _getDefEndLine');
                var lines = txt.split('\n'),
                    firstLine = lines[startLine - 1],
                    i = 0,
                    l = 0;
                for (i = 0; i < firstLine.length; i++) {
                    if ([' ', '\t'].indexOf(firstLine[i]) < 0) {
                        break;
                    }
                }

                for (l = startLine; l < lines.length; l++) {
                    if (lines[l][i] === '}') {
                        break;
                    }
                }

                return l;
            }
        }

        function _resolveDef(data, hostEditor) {
            var defs = data.split('\n'),
                fun_item,
                path;

            // Don't provide def when racer returns END
            if (defs[0] === 'END') {
                _$deferred.reject();
                return null;
            } else {

                // only use the first match for simplicity
                fun_item = RacerCli.parse(defs[0]);
                path = fun_item.path;
                // Don't provide def when its a module
                if (fun_item.type === 'Module') {
                    _$deferred.reject();
                }

                // TO-DO: consider use FileUtils.convertWindowsPathToUnixPath();
                if (!FileSystem.isAbsolutePath(path)) {
                    path = path.split('\\').join('/');
                }

                DocumentManager.getDocumentForPath(path).done(function (doc) {
                    var lineStart = Number(fun_item.line),
                        // doc._text might be null
                        lineEnd = _getDefEndLine(doc._text || doc.file._contents, lineStart, fun_item.firstLine.length);

                    var ranges = [
                        {
                            document: doc,
                            name: name,
                            lineStart: lineStart - 1,
                            lineEnd: lineEnd
                        }
                    ];
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
        }

        this.provider = function (hostEditor, pos) {
            if (["text/x-rustsrc", "rust"].indexOf(hostEditor.getModeForSelection()) < 0) {
                return null;
            }
            var sel = hostEditor.getSelection();
            if (sel.start.line !== sel.end.line) {
                return null;
            }
            var fpath = hostEditor.document.file.fullPath;

            RacerCli.nodeConnection.on("RacerDomain:defFound", function (evt, data, petition) {
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
            _$deferred = RacerCli.getDefD('', sel.start, ++vpet, fpath);
            return _$deferred;
        };
    }

    exports.RustHintProvider = RustHintProvider;
    exports.RustDefinitionProvider = RustDefinitionProvider;

});
