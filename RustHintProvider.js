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
			question: "Set your racer bin file path, like '..\racer\target\release\racer.exe'",
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

		rs = ta.map(function (i) {
			return (/MATCH ([^,]+),(\d)/.exec(i)[1]);
		});
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
					return $('<span>')
						.addClass("RustIDE-hints-keywords")
						.text(h);

				} else if (_.contains(std_macros, h)) {
					return $('<span>')
						.addClass("RustIDE-hints-macros")
						.text(h);
				} else {
					return $('<span>')
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
