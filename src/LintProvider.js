define(function (require, exports, module) {

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


    function getLintErrors(filePath, cb) {
        var error = false,
            pattern = /.*:(\d+):(\d+): (\d+):(\d+) (.+)/;


    }
})
