/**
 *
 * Licensed under MIT
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true */
/*global define, $, brackets, Mustache */

define(function (require, exports, module) {
    'use strict';
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        Dialogs = brackets.getModule("widgets/Dialogs"),
        CommandManager = brackets.getModule("command/CommandManager"),
        Menus = brackets.getModule("command/Menus"),
        Commands = brackets.getModule("command/Commands");

    var prefs = PreferencesManager.getExtensionPrefs("Rust-IDE");

    // this function copied and modifitied from zaggino.brackets-git
    function showRustIDEDialog() {
        var questionDialogTemplate = require("text!src/dialogs/templates/rust-ide-settings.html");
        var compiledTemplate = Mustache.render(questionDialogTemplate, {
            title: "Rust-IDE Settings",
            question: "Set your racer bin file path, like '..\\racer\\target\\release\\racer.exe'",
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

    exports.show = showRustIDEDialog;

});
