const fs = require('fs');
const widgetrc = JSON.parse(fs.readFileSync('.widgetrc'));
const request = require('request');

var makeRequest = function (data) {
  request.post(widgetrc.widgetOptions.baseUrl + '/api/v1/authn/factors', {
    json: {
      stateToken: data.stateToken,
      factorType: 'device_posture',
      provider: 'OKTA',
      profile: {
        devicePostureJwt : data.devicePostureJwt
      }
    }
  });
};

var randomTimeout = function () {
  var min=4;
  var max=8;
  return Math.floor(Math.random() * (+max - +min)) + +min;
};

module.exports = {
  path: '/asyncLink/factorEnrollment',
  proxy: false,
  method: 'POST',
  status: (req, res, next) => {
    var nonce = req.body.nonce;
    var stateToken = req.body.stateToken;
    var devicePostureJwt = widgetrc.widgetOptions.mockDeviceFactorEnrollmentResponseJwt;
    setTimeout(makeRequest, randomTimeout(), {
      stateToken: stateToken,
      devicePostureJwt: devicePostureJwt
    });
    next();
  },
};
