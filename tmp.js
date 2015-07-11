var hints = ["BufReader", "BufWriter", "BufStream", "BufRead", "Broadcast", "Bytes"];

var pf = "Buf";

hints.filter(function (h) {

    return h.substring(0, pf.length) === pf;
})
