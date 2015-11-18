define(function (require, exports, module) {
    "use strict";

    // TO-DO: inlineWidget

    var AppInit = brackets.getModule('utils/AppInit'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        CodeInspection = brackets.getModule('language/CodeInspection'),
        EditorManager = brackets.getModule('editor/EditorManager'),
        NodeConnection = brackets.getModule('utils/NodeConnection'),
        ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        ProjectManager = brackets.getModule('project/ProjectManager'),
        node = new NodeConnection(),
        inspectionErrors = [];

    var domain = '[RustLint]: ';
    var currentProject = {};
    var pattern = /^(.+?):(\d+):(\d+):\s+(\d+):(\d+)\s(error|fatal error|warning):\s+(.+)/;
    var manifest;

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

    // return a promise resolved with true if current project is a crate(with 'Cargo.toml')
    function isCrate() {
        var deferred = new $.Deferred;
        ProjectManager.getAllFiles(ProjectManager.getLanguageFilter('toml')).done(function (files) {
            var names = files.map(function (file) {
                return file._name;
            });
            var ti = names.indexOf('Cargo.toml');

            if (ti > -1) {
                manifest = files[ti]._path;
                deferred.resolve(true);
            }
            deferred.resolve(false);
        });

        return deferred.promise();
    }

    function parserError(data) {
        return data.split(/(?:\r\n|\r|\n)/g)
            .map(function (message) {
                var match = pattern.exec(message);
                if (match) {
                    return {
                        file: match[1],
                        pos: {
                            line: match[2] - 1,
                            ch: match[3]
                        },
                        endPos: {
                            line: match[4] - 1,
                            ch: match[5]
                        },
                        type: match[6] === 'warning' ? 'warning' : 'error',
                        message: match[7]
                    };
                }
            }).filter(function (message) {
                return message !== undefined;
            });
    }

    // TO-DO: `--lib or --bin NAME`
    function getLintErrors(filePath, useCargo, cb) {
        var cmd = useCargo ? 'cargo rustc -Zno-trans ' + filePath + ' --manifest-path ' + manifest : 'rustc -Z no-trans ' + filePath;
        console.log('cmd:', cmd);
        node.domains.rustlint.commander(cmd)
            .done(function (data) {
                console.log('RustLint errors: ', data);
                inspectionErrors = parserError(data);
                CodeInspection.requestRun();
                cb(inspectionErrors);
            }).fail(function (err) {
                console.error(domain, err);
            });
    }

    function analizeErrors(codeMirror, filePath, useCargo) {
        getLintErrors(filePath, useCargo, function (error) {
            if (error.length > 0) {
                addGutters(codeMirror, error);
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

    function addGutters(cm, error) {
        console.log(domain + 'error:', error);
        for (var i = 0; i < error.length; i++) {
            var marker = makeMarker(error[i].type);
            cm.setGutterMarker(error[i].pos.line, 'rust-linter-gutter', marker);
        }
    }

    // TO-DO: rewrite it
    function init() {
        var useCargo = false;

        isCrate().done(function (isCrateFlag) {

            if (EditorManager) {
                EditorManager.on('activeEditorChange', function (event, EditorManager) {
                    var currentDocument = DocumentManager.getCurrentDocument(),
                        codeMirror;

                    if (currentDocument) {
                        if (currentDocument.language._name === 'Rust') {
                            //TO-DO: use cargo to lint if it's a crate and currentDocument in the currentProject's directory;

                            var currentFilePath = currentDocument.file._path;
                            currentProject = ProjectManager.getProjectRoot();

                            console.log('isCrateFlag:', isCrateFlag);
                            console.log('currentFilePath:', currentFilePath);

                            useCargo = isCrateFlag && (currentFilePath.indexOf(currentProject._path) === 0);

                            codeMirror = registerGutter();
                            analizeErrors(codeMirror, currentFilePath, useCargo);

                            DocumentManager.on('documentSaved', function () {
                                analizeErrors(codeMirror, currentFilePath, useCargo);
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
        });
    }
});
