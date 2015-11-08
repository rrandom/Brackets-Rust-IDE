define(function (require, exports, module) {
    "use strict";

    var AppInit = brackets.getModule('utils/AppInit'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        CodeInspection = brackets.getModule('language/CodeInspection'),
        EditorManager = brackets.getModule('editor/EditorManager'),
        Dialogs = brackets.getModule('widgets/Dialogs'),
        NodeConnection = brackets.getModule('utils/NodeConnection'),
        ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        node = new NodeConnection(),
        inspectionErrors = [];

    var domain = '[RustLint]: ';

    if (!node.domains.rustlint) {
        node.connect(true).done(function () {
            var path = ExtensionUtils.getModulePath(module, 'node/LintDomain.js');
            node.loadDomains([path], true).done(function () {
                AppInit.appReady(init);
            });
        });
    } else {
        AppInit.appReady(init);
    }

    function cleanErrorMessages(message) {
        var lines = message.split(/(?:\r\n|\r|\n)/g);

        return lines.map(function (line) {
            if (line.indexOf('^') === -1) {
                if ((line.indexOf('warning:') !== -1) || (line.indexOf('error:') !== -1)) {
                    return line;
                }
                return '';
            }
            return '';
        }).filter(function (message) {
            return message !== '';
        });
    }

    function getLintErrors(filePath, cb) {
        var pattern = /.*:(\d+):(\d+): (\d+):(\d+) (.+)/;

        node.domains.rustlint.commander('rustc -Z no-trans "' + filePath + '"')
            .done(function (data) {
                console.log(domain + 'data:', data);
                var messages = cleanErrorMessages(data);

                inspectionErrors = messages.map(function (message) {
                    var match = pattern.exec(message);
                    if (match) {
                        return {
                            pos: {
                                line: match[1] - 1,
                                ch: match[2]
                            },
                            endPos: {
                                line: match[3] - 1,
                                ch: match[4]
                            },
                            message: match[5]
                        };
                    }
                }).filter(function (message) {
                    return message !== undefined;
                });

                CodeInspection.requestRun();

                cb(inspectionErrors);

            }).fail(function (err) {
                console.error(domain, err);
            });
    }

    function analizeErrors(codeMirror, filePath) {
        getLintErrors(filePath, function (error) {
            if (error) {
                addError(codeMirror, error);
            } else {
                codeMirror.clearGutter("rust-linter-gutter");
            }
        });
    }

    function registerGutter() {

        var currentEditor = EditorManager.getActiveEditor(),
            codeMirror = currentEditor._codeMirror,
            gutters = codeMirror.getOption("gutters").slice(0);
        if (gutters.indexOf('rust-linter-gutter') === -1) {
            gutters.unshift('rust-linter-gutter');
            codeMirror.setOption('gutters', gutters);
        }

        return codeMirror;

    }

    //TO-DO: type is warning or error
    function makeMarker(type){

        return $("<div class='rust-linter-gutter-icon' title='Click for details'>●</div>")[0];

    }

    function addError(cm, error) {
        console.log(domain + 'error:', error);
        for (var i = 0; i < error.length; i++) {

            // TO-DO: makeMaker as a function
            // http://codemirror.net/demo/marker.html

            var marker = makeMarker();

            cm.setGutterMarker(error[i].pos.line, 'rust-linter-gutter', marker);
        }
    }

    function init() {
        if (EditorManager) {
            EditorManager.on('activeEditorChange', function (event, EditorManager) {
                var currentDocument = DocumentManager.getCurrentDocument(),
                    codeMirror;

                if (currentDocument) {
                    if (currentDocument.language._name === 'Rust') {
                        codeMirror = registerGutter();
                        analizeErrors(codeMirror, currentDocument.file._path);

                        DocumentManager.on('documentSaved', function () {
                            analizeErrors(codeMirror, currentDocument.file._path);
                        });
                    } else {
                        DocumentManager.off('documentSaved');
                    }
                }

            });

            CodeInspection.register("rust", {
                name: "rustLint",
                scanFile: function (text, fullPath) {
                    return {
                        errors: inspectionErrors
                    };
                }
            });
        }
    }
});
