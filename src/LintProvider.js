define(function (require, exports, module) {
    "use strict";

    // TO-DO: inlineWidget

    var AppInit = brackets.getModule('utils/AppInit'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        CodeInspection = brackets.getModule('language/CodeInspection'),
        EditorManager = brackets.getModule('editor/EditorManager'),
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

    // TO-DO: add lint error type
    function getLintErrors(filePath, cb) {
        var pattern = /^(.+?):(\d+):(\d+):\s+(\d+):(\d+)\s(error|fatal error|warning):\s+(.+)/;

        node.domains.rustlint.commander('rustc -Z no-trans "' + filePath + '"')
            .done(function (data) {
                console.log(domain + 'data:', data);

                inspectionErrors = data.split(/(?:\r\n|\r|\n)/g)
                    .map(function (message) {
                        var match = pattern.exec(message);
                        if (match) {
                            return {
                                pos: {
                                    line: match[2] - 1,
                                    ch: match[3]
                                },
                                endPos: {
                                    line: match[4] - 1,
                                    ch: match[5]
                                },
                                message: match[7]
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
            if (error.length > 0) {
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

    function makeMarker(type) {

        var lint_type = (type === 'error') ? 'rust-linter-gutter-error' : 'rust-linter-gutter-warning',
            marker = $("<div class='rust-linter-gutter-icon' title='Click for details'>●</div>");

        marker.addClass(lint_type);

        return marker[0];
    }

    function addError(cm, error) {
        console.log(domain + 'error:', error);
        for (var i = 0; i < error.length; i++) {
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
