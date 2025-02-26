/*
 * Copyright (C) 2015 EDF SA
 *
 * This file is part of slurm-web.
 *
 * slurm-web is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * slurm-web is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with slurm-web.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

define([
  'jquery',
  'async',
  'handlebars',
  'text!../../js/core/login/login.hbs',
  'token-utils',
  'ajax-utils',
  'error-utils',
  'user-utils',
  'fake-placeholder'
], function($, async, Handlebars, template, tokenUtils, ajaxUtils, errorUtils, userUtils, fakePlaceholder) {
  template = Handlebars.compile(template);

  return function(config) {
    function loginAction(options) {
      function loginOnCluster(cluster, callback) {
        // skip authentication if not enabled on cluster
        // or automatic login disabled and not current cluster
        if (!cluster.authentication.enabled || !config.AUTOLOGIN && config.cluster.id !== cluster.id) {
          callback(null, null);
          return;
        }

        // login on cluster, call route /login
        if (userUtils.getUser(cluster)) {
          // don't do anything if user already authenticated on cluster
          callback(null, null);
          return;
        }

        $.ajax(cluster.api.url + cluster.api.path + '/login', options)
          .done(function(response) {
            tokenUtils.setToken(cluster, response.id_token);
            userUtils.setUser(cluster, response);
            callback(null, null);
          })
          .fail(function(error) {
            return callback(true, error);
          });
      };

      // user knows best where to log in
      // always try to log first in the current cluster
      var p = window.clusters.indexOf(config.cluster);
      var currFirst = window.clusters.slice(p,p+1).concat(window.clusters.slice(0,p),window.clusters.slice(p+1));
      async.mapSeries(currFirst, loginOnCluster, function(err, result) {
        var clusterId = currFirst.indexOf(config.cluster); //0

        if (err && !userUtils.getUser(config.cluster)) {
          errorUtils.setError(JSON.parse(result[clusterId].responseText).message);
          return;
        }

        $(document).trigger('logged');
        $(document).trigger('show', { page: config.STARTPAGE });
      });
    }

    this.init = function() {
      var context;
      var options = ajaxUtils.getAjaxOptions(false);
      options.type = 'POST';

      function submitLogin(e) {
        var form = {
          login: $('#loginform #login').val(),
          password: $('#loginform #password').val()
        };

        if (e.type === 'keypress' && e.which !== 13) {
          return;
        }

        if (!form.login || !form.password) {
          errorUtils.setError('You have to provide both your user id and your password');
        } else {
          options.data = JSON.stringify({
            login: form.login,
            password: form.password
          });
          loginAction(options);
        }
      }

      function submitGuest() {
        options.data = JSON.stringify({
          guest: true
        });
        loginAction(options);
      }

      if(config.PWDTYPE) {
        context = {
          pwdtype: '('+config.PWDTYPE+')'
        };
      }
      $('#main').append(template(context));
      $(document).trigger('pageLoaded');

      if (config.cluster.authentication.guest) {
        $('#loginform #guest').show();
      }

      // bind login form events
      $('#loginform #user').on('click', submitLogin);
      $('#loginform input').on('keypress', submitLogin);
      $('#loginform #guest').on('click', submitGuest);
    };

    this.destroy = function() {
      $('#login input').off('keypress');
      $('#login #user').off('click');
      $('#login #guest').off('click');
      $('#login').remove();
    };

    return this;
  };
});
