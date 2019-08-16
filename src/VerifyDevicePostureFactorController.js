/*!
 * Copyright (c) 2015-2016, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

define([
  'okta',
  'util/FormController',
  'models/BaseLoginModel',
], function (Okta, FormController, BaseLoginModel) {

  const $ = Okta.$;
  const _ = Okta._;

  var getUserAgentName = function () {
    return navigator.userAgent;
  };
  var userAgentContainsSafari = function () {
    return /safari/i.test(getUserAgentName());
  };
  var isIOS = function () {
    return /(iPad|iPhone|iPod)/i.test(getUserAgentName());
  };
  var isIOSWebView = function () {
    return isIOS() && !userAgentContainsSafari();
  };

  return FormController.extend({
    className: 'device-posture',

    Model: {
      url: '',
      props: {
        stateToken: 'string',
      },
    },

    Form: {
      noButtonBar: true,
    },

    initialize: function () {
      var response = this.options.appState.get('lastAuthResponse');
      var status = response.status;
      var that = this;

      this.model.set('stateToken', response.stateToken);
      if (status === 'FACTOR_REQUIRED') {
        this.model.url = response._embedded.factors[0]._links.verify.href;
        this.model.save()
          .done(data => {
            that.options.appState.setAuthResponse(data);
            var response = that.options.appState.get('lastAuthResponse');

            // If extension is being used
            if (response._links.extension) {
              // Figure out if browser indicates xhr call, if so the extension will not pick it up and we need to do regular browser request
              if (!isIOSWebView()) {
                if (this.settings.get('useMock')) {
                  window.location.href = response._links.extension.href.replace('/api/v1', '') + '&OktaAuthorizationProviderExtension=' + that.settings.get('mockDeviceFactorChallengeResponseJwt');
                } else {
                  window.location.href = response._links.extension.href.replace('/api/v1', '');
                }
                return;
              }
              let headers;
              if (this.settings.get('useMock')) {
                headers = {'Authorization': 'OktaAuthorizationProviderExtension ' + that.settings.get('mockDeviceFactorChallengeResponseJwt')};
              } else {
                headers = {'Authorization': 'OktaAuthorizationProviderExtension <valueToBeReplacedByExtension>'};
              }
              // Let the call be intercepted, populated and returned back
              $.get({
                url: response._links.extension.href,
                headers: headers // Included to trigger CORS acceptance for the actual request that's being modified
              }).done(data => {
                var Model = BaseLoginModel.extend(_.extend({
                  parse: function (attributes) {
                    this.settings = attributes.settings;
                    this.appState = attributes.appState;
                    return _.omit(attributes, ['settings', 'appState']);
                  }
                }, _.result(this, 'Model')));
                that.model = new Model({
                  settings: that.settings,
                  appState: that.options.appState
                }, { parse: true });
                var response = that.options.appState.get('lastAuthResponse');
                that.model.url = response._links.next.href;
                that.model.set('devicePostureJwt', data.devicePostureJwt);
                that.model.set('stateToken', response.stateToken);
                that.model.save()
                  .done(data => {
                    that.options.appState.trigger('change:transaction', that.options.appState, {data});
                  });
              });
              return;
            }

            that.model.url = response._links.next.href;
            var nonce = response._embedded.factor._embedded.challenge.nonce;

            if (that.settings.get('useMock')) {
              this.mockLoopback(that, nonce);
              return;
            }

            that.doLoopback('http://localhost:', '41236', nonce)
              .done(data => {
                var Model = BaseLoginModel.extend(_.extend({
                  parse: function (attributes) {
                    this.settings = attributes.settings;
                    this.appState = attributes.appState;
                    return _.omit(attributes, ['settings', 'appState']);
                  }
                }, _.result(this, 'Model')));
                that.model = new Model({
                  settings: that.settings,
                  appState: that.options.appState
                }, { parse: true });
                var response = that.options.appState.get('lastAuthResponse');
                that.model.url = response._links.next.href;
                that.model.set('devicePostureJwt', data.jwt);
                that.model.set('stateToken', response.stateToken);
                that.model.save()
                  .done(data => {
                    that.options.appState.trigger('change:transaction', that.options.appState, {data});
                  });
              });
          });
      } else if (status === 'FACTOR_CHALLENGE') {
        console.log('Error! Ended up in FACTOR_CHALLENGE without being in FACTOR_REQUIRED first, do not mess around like that');
      }
    },

    mockLoopback: function (that, nonce) {
      var baseUrl = '/loopback/factorVerifyChallenge/';
      that.doLoopback(baseUrl, '5000', nonce)
        .fail(() => {
          that.doLoopback(baseUrl, '5002', nonce)
            .fail(() => {
              that.doLoopback(baseUrl, '5004', nonce)
                .fail(() => {
                  that.doLoopback(baseUrl, '5006', nonce)
                    .fail(() => {
                      that.doLoopback(baseUrl, '5008', nonce)
                        .done(data => {
                          var Model = BaseLoginModel.extend(_.extend({
                            parse: function (attributes) {
                              this.settings = attributes.settings;
                              this.appState = attributes.appState;
                              return _.omit(attributes, ['settings', 'appState']);
                            }
                          }, _.result(this, 'Model')));
                          that.model = new Model({
                            settings: that.settings,
                            appState: that.options.appState
                          }, { parse: true });
                          var response = that.options.appState.get('lastAuthResponse');
                          that.model.url = response._links.next.href;
                          that.model.set('devicePostureJwt', data.jwt);
                          that.model.set('stateToken', response.stateToken);
                          that.model.save()
                            .done(data => {
                              that.options.appState.trigger('change:transaction', that.options.appState, {data});
                            });
                        });
                    });
                });
            });
        });
    },

    doLoopback: function (baseUrl, port, nonce) {
      return $.post({
        url: baseUrl + `${port}`,
        method: 'POST',
        data: JSON.stringify({
          requestType: 'userChallenge',
          nonce: nonce,
        }),
        contentType: 'application/json',
      });
    },

  });
});