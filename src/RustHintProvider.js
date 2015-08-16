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

	var _ = brackets.getModule("thirdparty/lodash");

	var ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
		NodeDomain = brackets.getModule('utils/NodeDomain'),
		NodeConnection = brackets.getModule('utils/NodeConnection'),
		PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
		prefs = PreferencesManager.getExtensionPrefs("Rust-IDE");


	var RustHinterDomain;
	var nodeConnection = new NodeConnection();
	var connection = nodeConnection.connect(true);

	connection.done(function () {
		RustHinterDomain = new NodeDomain('RustHinter',
			ExtensionUtils.getModulePath(module, "node/RustHinterDomain"));
	});

	prefs.definePreference("racerPath", "string", "");

	var prefix, cm,
		needNewHints = true,
		cachedHints = null,
		previousTokenStr = "--dummy--",
		lastToken,
		vpet = 0,
		extPath = ExtensionUtils.getModulePath(module);


	var end_tokens = [' ', '+', '-', '/', '*', '(', ')', '[', ']', ':', ',', '<', '>', '.', '{', '}'];

	function validToken(implicitChar) {
		if (implicitChar) {
			var code = implicitChar.charCodeAt(0);
			return (end_tokens.indexOf(implicitChar) === -1) && (code !== 13) && (code !== 9);
		} else {
			return false;
		}
	}

	function getHintsD(txt, cursor) {
		RustHinterDomain.exec("getHint", prefs.get("racerPath"), txt, (cursor.line + 1), cursor.ch, extPath, ++vpet)
			.fail(function (err) {
				console.error('[RustHinterDomain] Fail to get hints: ', err);
			});
	}

	function extractHints(data) {
		var i, t,
			rs = [],
			ta = data.split('\n');

		prefix = ta.shift().split(',').pop();
		ta.pop();

		try {
			ta.pop();
			rs = ta.map(function (i) {
				return (/MATCH ([^,]+),(\d)/.exec(i)[1]);
			});
		} catch (e) {
			console.error('[RustHinterDomain] extractHints: Please notify me if you see this error');
			console.error('error:', e);
		}
		return _.uniq(rs);
	}

	// keywords: https://doc.rust-lang.org/grammar.html#keywords
	var rust_keywords = ["abstract", "alignof", "as", "become", "box", "break",
                         "const", "continue", "crate", "do", "else", "enum",
                         "extern", "false", "final", "fn", "for", "if", "impl",
                         "in", "let", "loop", "macro", "match", "mod", "move",
                         "mut", "offsetof", "override", "priv", "proc", "pub",
                         "pure", "ref", "return", "Self", "self", "sizeof", "static",
                         "struct", "super", "trait", "true", "type", "typeof", "unsafe",
                         "unsized", "use", "virtual", "where", "while", "yield"];

	// std library macros: https://doc.rust-lang.org/nightly/std/index.html#macros
	var std_macros = ["assert!", "assert_eq!", "cfg!", "column!", "concat!",
					  "contat_idents!", "debug_assert!", "debug_assert_eq!",
					  "env!", "file!", "format!", "format_args!", "include!",
					  "include_bytes!", "include_str!", "line!", "module_path!",
					  "option_env!", "panic!", "print!", "println!", "scoped_thread_local!",
					  "select!", "stringify!", "thread_local!", "try!", "unimplemented!",
					  "unreachable!", "vec!", "write!", "writeln!"];

	function RustHintProvider() {

		function resolveHint(data, petition) {
			if (petition === vpet) {
				var racerHintsList = extractHints(data);
				cachedHints = racerHintsList;
			}
		}

		function resolveCachedHint(cachedHints, token) {
			prefix = token.string;

			var hintsList = cachedHints.concat(rust_keywords, std_macros);
			var filteredHints = hintsList.filter(function (h) {
				return h.substring(0, prefix.length) === prefix;
			}).map(function (h) {
				if (_.contains(rust_keywords, h)) {
					return $('<span>').addClass("RustIDE-hints")
						.addClass("RustIDE-hints-keywords")
						.text(h);

				} else if (_.contains(std_macros, h)) {
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

			var cursor = cm.getCursor(),
				txt = cm.getValue();
			lastToken = cm.getTokenAt(cursor);

			//implicitChar is null when press Backspace
			if (validToken(implicitChar) || validToken(lastToken.string)) {
				var tokenType = lastToken.type;
				if (['string', 'comment', 'meta', 'def'].indexOf(tokenType) > -1) {
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
				console.info('$hint: ' + $hint.text());
				cm.replaceSelection($hint.text().substring(prefix.length));
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
