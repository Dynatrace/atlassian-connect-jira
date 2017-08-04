const request = require("request");
const language = require("./../resources/language");
const async = require("async");
const _ = require("lodash");
const util = require("../util");
const moment = require("moment-timezone");

module.exports = function (app, addon, logger) {
    app.get("/dynatrace-query", addon.authenticate(), (req, res) => {
      const httpClient = addon.httpClient(req);

      async.parallel([
          (cb) => util.getPid(req, httpClient, cb),
          (cb) => util.getTenant(req, httpClient, cb),
      ], (e, results) => {
        const pid = results[0];
        const tenant = results[1];
        const tenantUrl = tenant.tenant;
        const tenantToken = tenant.token;

        const query = {
            placeholderQuery : "app www.easytravel.com users,failurerate",
            query: "",
            result: [ 
                { 
                    measureName : "Active Users",
                    value : "345"
                },
                {
                    measureName : "Failure Rate",
                    value : "3.45%"
                }
            ]
        }

        res.render("dynatrace-query", query);
      });
    });
};
