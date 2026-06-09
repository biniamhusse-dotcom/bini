// uuid.js

var UUID = {
    _rnds: new Array(16),
    v4: function () {
        var rnds = UUID._rnds;

        for (var i = 0; i < 16; i++) {
            if ((i & 0x03) === 0) {
                var r = Math.random() * 0x100000000;
                rnds[i] = (r >>> ((i & 0x03) << 3)) & 0xff;
            } else {
                rnds[i] = rnds[i & ~0x03 | 0x03];
            }
        }

        rnds[6] = (rnds[6] & 0x0f) | 0x40;
        rnds[8] = (rnds[8] & 0x3f) | 0x80;

        var bth = UUID._byteToHex;
        return (bth[rnds[0]] + bth[rnds[1]] + bth[rnds[2]] + bth[rnds[3]] + '-' +
                bth[rnds[4]] + bth[rnds[5]] + '-' +
                bth[rnds[6]] + bth[rnds[7]] + '-' +
                bth[rnds[8]] + bth[rnds[9]] + '-' +
                bth[rnds[10]] + bth[rnds[11]] + bth[rnds[12]] +
                bth[rnds[13]] + bth[rnds[14]] + bth[rnds[15]]);
    },
    _byteToHex: new Array(256).map(function (value, index) {
        return (index + 0x100).toString(16).substr(1);
    })
};

// Export UUID object for CommonJS environments
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = UUID;
}

// Export UUID object for AMD/CommonJS hybrid environments
if (typeof define === 'function' && define.amd) {
    define([], function () {
        return UUID;
    });
}
