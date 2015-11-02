define(function (require, exports, module) {
    "use strict";

    //TO-DO: 'utils/NodeDomain'? 'utils/NodeConnection'?

    // FIXME: not accurate
    function cleanErrorMessage(message) {
        var lines = message.split(/(?:\r\n|\r|\n)/g);

        var cleanMessages = lines.map(function (line) {
            if (line.indexOf('^') === -1) {
                if ((line.indexOf('warning:') !== -1) || (line.indexOf('error:') !== -1)) {
                    return line;
                }
                return "";
            }
            return "";
        });

        return cleanMessages;
    }


    //FIXME: callback maybe a better choice
    function getLintErrors(text, filePath) {
        var error = false,
            pattern = /.*:(\d+):(\d+): (\d+):(\d+) (.+)/,
            results = [];

        node.domains.RustLintDomain.lint('rustc -Z no-trans "' + filePath + '"').done(function (data) {
            var messages = cleanErrorMessage(data);
            results = messages.map(function (message) {
                var match = pattern.exec(message);
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
            });
        });

        return results;
    }

    exports.getLintErrors = getLintErrors;

});
