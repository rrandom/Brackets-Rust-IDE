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
        node = new NodeConnection();

    var pattern = /^(.+?):(\d+):(\d+):\s+(\d+):(\d+)\s(error|fatal error|warning):\s+(.+)/;

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


    function normalizePath(path) {
        return path.replace(/[\/\\]/g, "/");
    }

    function parserError(data, lintFile) {
        return data.split(/(?:\r\n|\r|\n)/g)
            .map(function (message) {
                var match = pattern.exec(message);
                if (match) {
                    return {
                        file: normalizePath(match[1]),
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
            }).filter(function (error) {
                return (error !== undefined) && (error.file === lintFile);
            });
    }

    // TO-DO: `--lib or --bin NAME`
    /**
     * return a promise resolved with parsed errors
     */
    function getLintErrors(filePath, useCargo, manifest) {
        var errors,
            deferred = new $.Deferred(),
            cmd = useCargo ? 'cargo rustc -Zno-trans --manifest-path ' + manifest : 'rustc -Z no-trans ' + filePath;

        node.domains.rustlint.commander(cmd)
            .done(function (data) {
                errors = parserError(data, filePath);
                deferred.resolve(errors);
            }).fail(function (err) {
                console.error('RustLint: ', err);
                deferred.reject(null);
            });

        return deferred.promise();
    }

    function registerGutter() {
        var currentEditor = EditorManager.getActiveEditor(),
            cm = currentEditor._codeMirror,
            gutters = cm.getOption("gutters").slice(0);
        if (gutters.indexOf('rust-linter-gutter') === -1) {
            gutters.unshift('rust-linter-gutter');
            cm.setOption('gutters', gutters);
        }
        return cm;
    }

    function makeMarker(type) {
        var lint_type = (type === 'error') ? 'rust-linter-gutter-error' : 'rust-linter-gutter-warning',
            marker = $("<div class='rust-linter-gutter-icon' title='Click for details'>●</div>");
        marker.addClass(lint_type);
        return marker[0];
    }

    function addMarkers(cm, errors) {
        for (var i = 0; i < errors.length; i++) {
            var marker = makeMarker(errors[i].type);
            cm.setGutterMarker(errors[i].pos.line, 'rust-linter-gutter', marker);
        }
    }

    function updateMarkers(errors, cm) {
        cm.clearGutter("rust-linter-gutter");
        if (errors.length > 0) {
            addMarkers(cm, errors);
        }
    }

    var useCargo,
        codeMirror,
        manifestPath,
        isCarte = null;

    function fileInDirectory(filePath, directoryPath) {
        return filePath.indexOf(directoryPath) === 0;
    }

    // return a promise resolved with manifest-path if current project is a crate(with 'Cargo.toml')
    function locateManifest() {
        var names, ti,
            deferred = new $.Deferred();

        ProjectManager.getAllFiles(ProjectManager.getLanguageFilter('toml')).done(function (files) {
            names = files.map(function (file) {
                return file._name;
            });
            ti = names.indexOf('Cargo.toml');
            if (ti > -1) {
                deferred.resolve({
                    isCarte: true,
                    manifestPath: files[ti]._path
                });
            } else {
                deferred.resolve({
                    isCarte: false,
                    manifestPath: null
                });
            }
        });
        return deferred.promise();
    }

    function activeEditorChangeHandler() {
        var currentProject, currentFilePath,
            currentDocument = DocumentManager.getCurrentDocument();
        if (currentDocument) {
            if (currentDocument.language._name === 'Rust') {
                currentFilePath = currentDocument.file._path;
                codeMirror = registerGutter();
                currentProject = ProjectManager.getProjectRoot();
                if (isCarte === null) {
                    locateManifest().done(function (result) {
                        isCarte = result.isCarte;
                        manifestPath = result.manifestPath;

                        useCargo = isCarte && fileInDirectory(currentFilePath, currentProject._path);
                        CodeInspection.requestRun();
                    });
                } else {
                    useCargo = isCarte && fileInDirectory(currentFilePath, currentProject._path);
                    CodeInspection.requestRun();
                }
            }
        }

    }

    function projectOpenHandler() {
        isCarte = null;
    }

    function linter(text, fullPath) {
        var deferred = new $.Deferred();
        getLintErrors(fullPath, useCargo, manifestPath).done(function (errors) {
            updateMarkers(errors, codeMirror);
            deferred.resolve({
                errors: errors
            });
        });

        return deferred.promise();
    }

    function init() {
        CodeInspection.register("rust", {
            name: "rustLint",
            scanFileAsync: linter
        });

        ProjectManager.on('projectOpen', projectOpenHandler);
        EditorManager.on('activeEditorChange', activeEditorChangeHandler);
    }
});
