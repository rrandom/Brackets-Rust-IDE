/**
 *
 * Licensed under MIT
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */


define(function (require, exports, module) {
    "use strict";

    // TO-DO: inlineWidget

    var DocumentManager = brackets.getModule("document/DocumentManager"),
        CodeInspection = brackets.getModule("language/CodeInspection"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        NodeDomain = brackets.getModule("utils/NodeDomain"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        ProjectManager = brackets.getModule("project/ProjectManager");

    var pattern = /^(.+?):(\d+):(\d+):\s+(\d+):(\d+)\s(error|fatal error|warning):\s+(.+)/;

    var _domainPath = ExtensionUtils.getModulePath(module, "node/LintDomain");

    var _nodeDomain = new NodeDomain("rustLint", _domainPath);

    // TO-DO: `--lib or --bin NAME`
    function getLintErrors(filePath, useCargo, manifest) {
        var errors,
            deferred = new $.Deferred(),
            cmd = useCargo ? "cargo rustc -Zno-trans --manifest-path " + manifest : "rustc -Z no-trans " + filePath;

        _nodeDomain.exec("getLint", cmd)
            .done(function (data) {
                console.log("[RustLint]:\n", data);
                errors = parserError(data, filePath);
                deferred.resolve(errors);
            }).fail(function (err) {
                console.error("RustLint: ", err);
                deferred.reject(null);
            });

        return deferred.promise();
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
                        type: match[6] === "warning" ? "warning" : "error",
                        message: match[7]
                    };
                }
            }).filter(function (error) {
                return (error !== undefined) && (error.file === lintFile);
            });
    }

    // ------ gutter ---

    function registerGutter() {
        var currentEditor = EditorManager.getActiveEditor(),
            cm = currentEditor._codeMirror,
            gutters = cm.getOption("gutters").slice(0);
        if (gutters.indexOf("rust-linter-gutter") === -1) {
            gutters.unshift("rust-linter-gutter");
            cm.setOption("gutters", gutters);
        }
        return cm;
    }

    function makeMarker(type) {
        var lintType = (type === "error") ? "rust-linter-gutter-error" : "rust-linter-gutter-warning",
            marker = $("<div class='rust-linter-gutter-icon' title='Click for details'>●</div>");
        marker.addClass(lintType);
        return marker[0];
    }

    function addMarkers(cm, errors) {
        for (var i = 0; i < errors.length; i++) {
            var marker = makeMarker(errors[i].type);
            cm.setGutterMarker(errors[i].pos.line, "rust-linter-gutter", marker);
        }
    }

    function updateMarkers(errors, cm) {
        cm.clearGutter("rust-linter-gutter");
        if (errors.length > 0) {
            addMarkers(cm, errors);
        }
    }

    // ---- end gutter ----

    var useCargo,
        codeMirror,
        manifestPath,
        isCrate = null;

    function fileInDirectory(filePath, directoryPath) {
        return filePath.indexOf(directoryPath) === 0;
    }

    // return a promise resolved with manifest-path if current project is a crate(with `Cargo.toml`)
    function locateManifest() {
        var names, ti,
            deferred = new $.Deferred();

        ProjectManager.getAllFiles(ProjectManager.getLanguageFilter("toml")).done(function (files) {
            names = files.map(function (file) {
                return file._name;
            });
            ti = names.indexOf("Cargo.toml");
            if (ti > -1) {
                deferred.resolve({
                    isCrate: true,
                    manifestPath: files[ti]._path
                });
            } else {
                deferred.resolve({
                    isCrate: false,
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
            if (currentDocument.language._name === "Rust") {
                currentFilePath = currentDocument.file._path;
                codeMirror = registerGutter();
                currentProject = ProjectManager.getProjectRoot();
                if (isCrate === null) {
                    locateManifest().done(function (result) {
                        isCrate = result.isCrate;
                        manifestPath = result.manifestPath;

                        useCargo = isCrate && fileInDirectory(currentFilePath, currentProject._path);
                        CodeInspection.requestRun();
                    });
                } else {
                    useCargo = isCrate && fileInDirectory(currentFilePath, currentProject._path);
                    CodeInspection.requestRun();
                }
            }
        }

    }

    function projectOpenHandler() {
        isCrate = null;
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

        ProjectManager.on("projectOpen", projectOpenHandler);
        EditorManager.on("activeEditorChange", activeEditorChangeHandler);
    }

    exports.init = init;
});
